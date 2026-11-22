/**
 * Reading a target for family C: every frame of `ctx.frames`, every shadow
 * tree in each (closed ones included, through CDP), the frame elements that
 * host each nested document, and the accessibility tree for the few elements
 * whose record asks whether they are exposed there.
 *
 * One `frame.evaluate` per frame does the DOM work (`scan.js`). CDP is used
 * for what a page script cannot see:
 * - closed shadow roots (`DOM.getDocument` with `pierce`), registered for
 *   the scan under a symbol on `globalThis`, and deleted afterwards;
 * - exposure in the accessibility tree (`Accessibility.getPartialAXTree` on
 *   the element's backend node).
 *
 * Nothing here changes the page beyond that symbol, which lives only while
 * the provider runs.
 */
import type { CDPSession } from "playwright";
import type { CheckContext, FrameInfo } from "../../types.ts";
import { familyC } from "./scan.js";
import { TEXTBOX_ROLE_LIST } from "../../../engine/sanitise.ts";
import type { HostChain, HostFacts, ScanArg, ScanResult } from "./scan.js";

/** Longest raw snippet the scan returns; the engine sanitises and caps again. */
export const SNIPPET_MAX = 400;

/** Exposure of one element in the accessibility tree: true, false, or null when it could not be read. */
export type Exposure = boolean | null;

export interface FrameRead {
  index: number;
  info: FrameInfo;
  /** The frame's address as Playwright reports it. */
  url: string;
  /** Locator of the frame elements that lead to this document, joined by ` >>> `; "" for the main frame. */
  prefix: string;
  host: HostChain;
  /** Present when the frame was read. */
  scan?: ScanResult;
  /** Why the frame could not be read, when it could not. */
  unread?: string;
  /** Accessibility look-ups by index in the scan's list. */
  ax: Map<number, Exposure>;
}

export interface PageRead {
  frames: FrameRead[];
}

const MAIN_HOST: HostChain = {
  known: true,
  notRendered: false,
  ariaHidden: false,
  inert: false,
  opacityZero: false,
  visible: true,
  unmeasured: [],
  partial: false,
  frameNoScroll: false,
};
const UNKNOWN_HOST: HostChain = { ...MAIN_HOST, known: false };

interface DomNode {
  nodeType: number;
  backendNodeId: number;
  shadowRootType?: string;
  children?: DomNode[];
  shadowRoots?: DomNode[];
  contentDocument?: DomNode;
  templateContent?: DomNode;
}

interface SessionState {
  session: CDPSession;
  frames: number[];
  /** Document nodes of this target: its own and those of same-process frames. */
  documents: number[];
}

const OBJECT_GROUP = "rgaa-assist-family-c";
const AX_BATCH = 64;

function message(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  return (text.split("\n").find((l) => l.trim().length > 0) ?? "unknown error").trim();
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("aborted");
}

/** Resolve or reject with the abort reason, whichever comes first. */
function abortable<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

function walkDom(node: DomNode, onClosed: (n: DomNode) => void, onDocument: (n: DomNode) => void): void {
  if (node.nodeType === 9) onDocument(node);
  if (node.nodeType === 11 && node.shadowRootType === "closed") onClosed(node);
  for (const c of node.children ?? []) walkDom(c, onClosed, onDocument);
  for (const c of node.shadowRoots ?? []) walkDom(c, onClosed, onDocument);
  if (node.contentDocument) walkDom(node.contentDocument, onClosed, onDocument);
  if (node.templateContent) walkDom(node.templateContent, onClosed, onDocument);
}

const REGISTER_CLOSED = `function (key) {
  const k = Symbol.for(key);
  const s = globalThis[k] ?? (globalThis[k] = {});
  if (!(s.closed instanceof Map)) s.closed = new Map();
  if (this.host) s.closed.set(this.host, this);
}`;

const FRAME_INDEX = `function (key) {
  const s = globalThis[Symbol.for(key)];
  return s && Array.isArray(s.ax) && typeof s.frameIndex === "number" ? s.frameIndex : -1;
}`;

const AX_LIST = `function (key) { return globalThis[Symbol.for(key)].ax; }`;

/**
 * List the closed shadow roots of one target and make them visible to the
 * scan; remember the target's document nodes for the accessibility phase.
 */
async function prepareSession(state: SessionState, key: string, signal: AbortSignal): Promise<void> {
  const { session } = state;
  const doc = (await abortable(session.send("DOM.getDocument", { depth: -1, pierce: true }), signal)) as { root: DomNode };
  const closed: DomNode[] = [];
  walkDom(
    doc.root,
    (n) => closed.push(n),
    (n) => state.documents.push(n.backendNodeId),
  );
  for (const root of closed) {
    throwIfAborted(signal);
    const r = await abortable(session.send("DOM.resolveNode", { backendNodeId: root.backendNodeId, objectGroup: OBJECT_GROUP }), signal);
    const objectId = r.object.objectId;
    if (objectId === undefined) throw new Error("a closed shadow root could not be resolved");
    await abortable(
      session.send("Runtime.callFunctionOn", { objectId, functionDeclaration: REGISTER_CLOSED, arguments: [{ value: key }], silent: true }),
      signal,
    );
  }
}

async function hostFacts(info: FrameInfo, parentHost: HostChain, key: string, signal: AbortSignal): Promise<HostFacts> {
  const handle = await abortable(info.frame.frameElement(), signal);
  try {
    const arg: ScanArg = { key, frameIndex: -1, host: parentHost, snippetMax: SNIPPET_MAX, textboxRoles: TEXTBOX_ROLE_LIST };
    return await abortable(
      handle.evaluate(familyC as unknown as (el: unknown, a: ScanArg) => HostFacts, arg),
      signal,
    );
  } finally {
    await handle.dispose().catch(() => undefined);
  }
}

/** Exposure of each element the scans asked about, in one target. */
async function lookUpExposure(state: SessionState, reads: FrameRead[], key: string, signal: AbortSignal): Promise<void> {
  const { session } = state;
  const wanted = new Set(state.frames.filter((i) => (reads[i]?.scan?.axCount ?? 0) > 0));
  if (wanted.size === 0) return;
  for (const backendNodeId of state.documents) {
    if (wanted.size === 0) break;
    throwIfAborted(signal);
    let docObject: string | undefined;
    try {
      const r = await abortable(session.send("DOM.resolveNode", { backendNodeId, objectGroup: OBJECT_GROUP }), signal);
      docObject = r.object.objectId;
    } catch {
      continue; // a document that went away: its frame stays unknown
    }
    if (docObject === undefined) continue;
    const idx = await abortable(
      session.send("Runtime.callFunctionOn", {
        objectId: docObject,
        functionDeclaration: FRAME_INDEX,
        arguments: [{ value: key }],
        returnByValue: true,
        silent: true,
      }),
      signal,
    ).catch(() => undefined);
    const frameIndex = idx?.result.value as unknown;
    if (typeof frameIndex !== "number" || !wanted.has(frameIndex)) continue;
    wanted.delete(frameIndex);
    const read = reads[frameIndex];
    if (read === undefined) continue;
    try {
      const list = await abortable(
        session.send("Runtime.callFunctionOn", {
          objectId: docObject,
          functionDeclaration: AX_LIST,
          arguments: [{ value: key }],
          objectGroup: OBJECT_GROUP,
          silent: true,
        }),
        signal,
      );
      const listId = list.result.objectId;
      if (listId === undefined) continue;
      const props = await abortable(session.send("Runtime.getProperties", { objectId: listId, ownProperties: true }), signal);
      const items = props.result.flatMap((p) => (/^\d+$/.test(p.name) && p.value?.objectId !== undefined ? [{ i: Number(p.name), objectId: p.value.objectId }] : []));
      // CDP pipelines requests on one session: send them in batches rather than one by one.
      for (let start = 0; start < items.length; start += AX_BATCH) {
        throwIfAborted(signal);
        await Promise.all(
          items.slice(start, start + AX_BATCH).map(async ({ i, objectId }) => {
            try {
              const d = await abortable(session.send("DOM.describeNode", { objectId }), signal);
              const ax = await abortable(
                session.send("Accessibility.getPartialAXTree", { backendNodeId: d.node.backendNodeId, fetchRelatives: false }),
                signal,
              );
              const node = ax.nodes.find((n) => n.backendDOMNodeId === d.node.backendNodeId) ?? ax.nodes[0];
              read.ax.set(i, node === undefined ? false : !node.ignored);
            } catch (e) {
              if (signal.aborted) throw e;
              read.ax.set(i, null);
            }
          }),
        );
      }
    } catch (e) {
      if (signal.aborted) throw e;
      // the list could not be read: every look-up of this frame stays unknown
    }
  }
}

/** Read every frame of the target. Throws only when aborted. */
export async function readPage(ctx: CheckContext): Promise<PageRead> {
  const { signal } = ctx;
  const key = `rgaa-assist/family-c/${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const reads: FrameRead[] = ctx.frames.map((info, index) => ({
    index,
    info,
    url: info.frame.url(),
    prefix: "",
    host: index === 0 ? MAIN_HOST : UNKNOWN_HOST,
    ...(info.readable ? {} : { unread: info.unreadableReason ?? "the engine could not run a script in this frame" }),
    ax: new Map<number, Exposure>(),
  }));
  const byFrame = new Map(ctx.frames.map((f, i) => [f.frame, i] as const));
  const sessions = new Map<CDPSession, SessionState>();

  try {
    // 1. CDP sessions, closed shadow roots.
    for (const read of reads) {
      if (read.unread !== undefined) continue;
      try {
        const session = await abortable(ctx.cdpFor(read.info.frame), signal);
        let state = sessions.get(session);
        if (state === undefined) {
          state = { session, frames: [], documents: [] };
          sessions.set(session, state);
        }
        state.frames.push(read.index);
      } catch (e) {
        if (signal.aborted) throw e;
        read.unread = `no CDP session for this frame: ${message(e)}`;
      }
    }
    for (const state of sessions.values()) {
      try {
        await prepareSession(state, key, signal);
      } catch (e) {
        if (signal.aborted) throw e;
        for (const i of state.frames) {
          const r = reads[i];
          if (r !== undefined) r.unread = `its shadow trees could not be listed: ${message(e)}`;
        }
      }
    }

    // 2. Host chains, parents first (ctx.frames lists parents before children).
    for (const read of reads) {
      if (read.index === 0) continue;
      const parentIndex = read.info.parent === null ? undefined : byFrame.get(read.info.parent.frame);
      const parent = parentIndex === undefined ? undefined : reads[parentIndex];
      if (parent === undefined || parent.unread !== undefined) continue; // host stays unknown
      try {
        const p = parent.host;
        const f = await hostFacts(read.info, p, key, signal);
        read.host = {
          known: p.known,
          notRendered: p.notRendered || f.notRendered,
          ariaHidden: p.ariaHidden || f.ariaHidden,
          inert: p.inert || f.inert,
          opacityZero: p.opacityZero || f.opacityZero,
          // false wins, then null (unknown), then true
          visible: p.visible === false || f.visible === false ? false : p.visible === null || f.visible === null ? null : true,
          unmeasured: [...new Set([...p.unmeasured, ...f.unmeasured])],
          partial: p.partial || !f.whole,
          frameNoScroll: f.noScroll,
        };
        read.prefix = parent.prefix === "" ? f.locator : `${parent.prefix} >>> ${f.locator}`;
      } catch (e) {
        if (signal.aborted) throw e;
        // host stays unknown
      }
    }

    // 3. One scan per readable frame.
    for (const read of reads) {
      if (read.unread !== undefined) continue;
      throwIfAborted(signal);
      const arg: ScanArg = { key, frameIndex: read.index, host: read.host, snippetMax: SNIPPET_MAX, textboxRoles: TEXTBOX_ROLE_LIST };
      try {
        read.scan = await abortable(read.info.frame.evaluate(familyC as unknown as (a: ScanArg) => ScanResult, arg), signal);
        read.url = read.scan.url || read.url;
      } catch (e) {
        if (signal.aborted) throw e;
        read.unread = `the evaluation failed: ${message(e)}`;
      }
    }

    // 4. Accessibility tree, only for the elements a scan asked about.
    for (const state of sessions.values()) {
      try {
        await lookUpExposure(state, reads, key, signal);
      } catch (e) {
        if (signal.aborted) throw e;
        // look-ups stay unknown: the elements concerned get cannot_tell
      }
    }
    return { frames: reads };
  } finally {
    await Promise.allSettled(
      reads
        .filter((r) => r.info.readable)
        .map((r) =>
          r.info.frame.evaluate((k: string) => {
            delete (globalThis as unknown as Record<symbol, unknown>)[Symbol.for(k)];
          }, key),
        ),
    );
    await Promise.allSettled(
      [...sessions.values()].map(async ({ session }) => {
        await session.send("Runtime.releaseObjectGroup", { objectGroup: OBJECT_GROUP }).catch(() => undefined);
        await session.send("DOM.disable").catch(() => undefined);
      }),
    );
  }
}
