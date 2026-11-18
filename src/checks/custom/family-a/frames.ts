/**
 * The frame clauses of `custom/8-5-page-title-present` (step 3) and
 * `custom/8-3-default-lang-present` (step 1): every rendered `iframe` or
 * `frame` (one with a layout box, in the top-level document or in a document
 * nested through frames, shadow trees included), whether its document can be
 * read, and what it holds.
 */
import type { CDPSession, Frame } from "playwright";
import type { CheckContext, FrameInfo } from "../../types.ts";
import type { DocInfo } from "./document-type.ts";
import { evaluateRemote, inFrame, releaseGroup } from "./page.ts";

/** What `page/frame-doc.js` returns. */
export interface FrameDoc extends DocInfo {
  headTitleQualifies: boolean;
  renderedText: boolean;
  unrenderedText: boolean;
  textNodes: number;
}

export type RenderedFrame =
  | { url: string; readable: false; reason: string; elementKnown: boolean }
  | {
      url: string;
      readable: true;
      doc: FrameDoc;
      elementKnown: boolean;
      /**
       * Whether the frame's accessibility tree holds a static text node, not
       * ignored, with a non-whitespace character. `null` when the check could
       * not read it.
       */
      exposedText(): Promise<boolean | null>;
    };

const XHTML = "http://www.w3.org/1999/xhtml";

interface ElementLike {
  namespaceURI: string | null;
  localName: string;
  getClientRects(): { length: number };
}

/**
 * Whether the frame's element is an `iframe` or `frame` with a layout box.
 * `null` when the element cannot be reached (its parent document cannot be read).
 */
async function frameElementState(frame: Frame): Promise<{ isFrame: boolean; rendered: boolean } | null> {
  try {
    const handle = await frame.frameElement();
    try {
      return await handle.evaluate(
        (el: ElementLike, ns: string) => ({
          isFrame: el.namespaceURI === ns && (el.localName === "iframe" || el.localName === "frame"),
          rendered: el.getClientRects().length > 0,
        }),
        XHTML,
      );
    } finally {
      await handle.dispose().catch(() => undefined);
    }
  } catch {
    return null;
  }
}

interface ElementIndexLike {
  ownerDocument: { querySelectorAll(s: string): ArrayLike<unknown> };
}

/** Index of the frame's element among the `iframe, frame` elements of its parent document, or -1. */
async function frameElementIndex(frame: Frame): Promise<number> {
  try {
    const handle = await frame.frameElement();
    try {
      return await handle.evaluate((el: ElementIndexLike) => Array.prototype.indexOf.call(el.ownerDocument.querySelectorAll("iframe, frame"), el));
    } finally {
      await handle.dispose().catch(() => undefined);
    }
  } catch {
    return -1;
  }
}

const GROUP = "rgaa-assist-family-a-frames";

/**
 * Whether the document of `info` exposes static text with a non-whitespace
 * character. It reaches the document from the main world of its CDP
 * session's own frame: directly when the frame has its own session (main or
 * out-of-process), otherwise through `contentDocument` from that frame down.
 * `null` when the path cannot be followed (a cross-origin document in the
 * same process, or a frame element in a shadow tree).
 */
async function exposedTextOf(ctx: CheckContext, info: FrameInfo): Promise<boolean | null> {
  let session: CDPSession;
  try {
    session = await ctx.cdpFor(info.frame);
  } catch {
    return null;
  }
  const path: number[] = [];
  let node: FrameInfo = info;
  for (;;) {
    const parent = node.parent;
    if (parent === null) break;
    let parentSession: CDPSession | undefined;
    try {
      parentSession = await ctx.cdpFor(parent.frame);
    } catch {
      return null;
    }
    if (parentSession !== session) break;
    const index = await frameElementIndex(node.frame);
    if (index < 0) return null;
    path.unshift(index);
    node = parent;
  }
  try {
    const doc = await evaluateRemote(
      session,
      `(function (p) { var d = document; for (var i = 0; i < p.length; i++) { var f = d.querySelectorAll("iframe, frame")[p[i]]; d = f ? f.contentDocument : null; if (!d) return null; } return d; })(${JSON.stringify(path)})`,
      GROUP,
    );
    if (doc.objectId === undefined) return null;
    const r = (await session.send("Accessibility.queryAXTree", { objectId: doc.objectId, role: "StaticText" })) as {
      nodes: { ignored?: boolean; name?: { value?: unknown } }[];
    };
    return r.nodes.some((n) => n.ignored !== true && typeof n.name?.value === "string" && /\S/u.test(n.name.value));
  } catch {
    return null;
  } finally {
    await releaseGroup(session, GROUP);
  }
}

/**
 * Every frame of the target, other than the main frame, whose element is a
 * rendered `iframe` or `frame`. A frame whose element cannot be reached is
 * kept (as if rendered), since it might be one.
 */
export async function renderedFrames(ctx: CheckContext, blank: readonly number[]): Promise<RenderedFrame[]> {
  const out: RenderedFrame[] = [];
  for (const info of ctx.frames) {
    if (info.parent === null) continue;
    const url = info.frame.url() || "(no address)";
    const state = await frameElementState(info.frame);
    if (state !== null && !(state.isFrame && state.rendered)) continue;
    const elementKnown = state !== null;
    if (!info.readable) {
      out.push({ url, readable: false, reason: info.unreadableReason ?? "the engine could not run a script in it", elementKnown });
      continue;
    }
    let doc: FrameDoc;
    try {
      doc = await inFrame<FrameDoc>(info.frame, "frame-doc", { blank });
    } catch (e) {
      out.push({ url, readable: false, reason: `the evaluation failed: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`, elementKnown });
      continue;
    }
    out.push({ url, readable: true, doc, elementKnown, exposedText: () => exposedTextOf(ctx, info) });
  }
  return out;
}

/**
 * Whether a readable framed document holds a text node with a non-whitespace
 * character that is rendered or exposed. `unknown` when every such node is
 * unrendered and the accessibility tree could not be read: the caller counts
 * it as exposed, which can only make it abstain.
 */
export async function holdsRenderedOrExposedText(frame: Extract<RenderedFrame, { readable: true }>): Promise<"yes" | "no" | "unknown"> {
  if (frame.doc.renderedText) return "yes";
  if (!frame.doc.unrenderedText) return "no";
  const exposed = await frame.exposedText();
  if (exposed === null) return "unknown";
  return exposed ? "yes" : "no";
}
