/**
 * Family B: closed shadow trees, read through the Chrome DevTools Protocol.
 *
 * A script in the page cannot reach a closed shadow root, so `scanDocument`
 * never sees one. Both records abstain on a listed element or attribute
 * inside a shadow tree, and on a shadow root the check cannot read. To tell
 * the two apart instead of abstaining on every page, this pass asks each CDP
 * target of the page for its whole DOM, shadow roots included
 * (`DOM.getDocument` with `pierce`), and looks inside every closed shadow root
 * (user-agent shadow roots are the browser's own and are skipped).
 *
 * Read only: `DOM.getDocument` changes nothing in the page.
 *
 * RECORD: when a target's DOM cannot be read through CDP, the check cannot
 * know whether a closed shadow root exists there, and abstains as on "a
 * shadow root the check cannot read". Both records name only that case.
 *
 * Everything inside a shadow tree only ever leads to "cannot tell", so the
 * matching here is deliberately loose: an element whose local name, or an
 * attribute whose name (or local part after a prefix), is a listed or
 * obsolete name once ASCII-lowercased counts. CDP gives no namespace for an
 * element, so the HTML-namespace distinctions of the records are not made
 * here; they could only turn one abstention into another.
 */
import type { CDPSession } from "playwright";
import type { CheckContext } from "../../types.ts";

/** The subset of a CDP `DOM.Node` this pass reads. */
interface CdpNode {
  nodeType: number;
  nodeName: string;
  localName?: string;
  attributes?: string[];
  children?: CdpNode[];
  shadowRoots?: CdpNode[];
  shadowRootType?: "user-agent" | "open" | "closed";
  templateContent?: CdpNode;
  contentDocument?: CdpNode;
}

export interface ClosedShadowHit {
  check: "E" | "A";
  detail: string;
  locator: string;
  snippet: string;
}

export interface ClosedShadowReading {
  /** Closed shadow roots found, in every CDP target read. */
  closedRoots: number;
  /** Elements visited inside closed shadow roots. */
  elements: number;
  hits: ClosedShadowHit[];
  /** Hits counted, kept or not. */
  totals: { E: number; A: number };
  /** CDP targets whose DOM could not be read, with the reason. */
  unreadable: string[];
}

export interface ClosedShadowNames {
  /** 10.1.1: listed elements and multicol, nobr, spacer. */
  elementNames: readonly string[];
  /** 10.1.2: listed attributes and the obsolete ones. */
  attributeNames: readonly string[];
  sampleCap: number;
  timeoutMs: number;
}

const asciiLower = (s: string): string => s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));

function startTag(node: CdpNode): string {
  const attrs = node.attributes ?? [];
  let s = `<${node.localName ?? node.nodeName}`;
  for (let i = 0; i + 1 < attrs.length; i += 2) {
    let v = attrs[i + 1] ?? "";
    if (v.length > 80) v = `${v.slice(0, 80)}…`;
    s += ` ${attrs[i]}="${v.replace(/"/g, "&quot;")}"`;
  }
  return `${s}>`;
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not finish within ${ms} ms`)), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

export async function readClosedShadowRoots(ctx: CheckContext, names: ClosedShadowNames): Promise<ClosedShadowReading> {
  const elementNames = new Set(names.elementNames);
  const attributeNames = new Set(names.attributeNames);
  const reading: ClosedShadowReading = { closedRoots: 0, elements: 0, hits: [], totals: { E: 0, A: 0 }, unreadable: [] };

  const sessions: { session: CDPSession; url: string }[] = [];
  for (const info of ctx.frames) {
    let session: CDPSession;
    try {
      session = await withTimeout(ctx.cdpFor(info.frame), names.timeoutMs, "opening a CDP session");
    } catch (e) {
      reading.unreadable.push(`frame ${info.frame.url() || "(no address)"}: no CDP session (${(e as Error).message})`);
      continue;
    }
    if (!sessions.some((s) => s.session === session)) sessions.push({ session, url: info.frame.url() });
  }

  const push = (check: "E" | "A", detail: string, path: string[], node: CdpNode): void => {
    reading.totals[check]++;
    if (reading.totals[check] <= names.sampleCap) {
      const locator = path.join(" > ").replace(/ > >> /g, " >> ").replace(/>> > /g, ">> ");
      reading.hits.push({ check, detail, locator, snippet: startTag(node) });
    }
  };

  const visit = (node: CdpNode, path: string[], inClosed: boolean): void => {
    const here = node.nodeType === 1 ? [...path, node.localName ?? node.nodeName] : path;
    if (node.nodeType === 1 && inClosed) {
      reading.elements++;
      const local = node.localName ?? node.nodeName;
      if (elementNames.has(asciiLower(local))) push("E", local, here, node);
      const attrs = node.attributes ?? [];
      for (let i = 0; i < attrs.length; i += 2) {
        const name = attrs[i] ?? "";
        const localPart = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
        if (attributeNames.has(asciiLower(name)) || attributeNames.has(asciiLower(localPart))) push("A", `${local}@${name}`, here, node);
      }
    }
    for (const c of node.children ?? []) visit(c, here, inClosed);
    if (node.templateContent) visit(node.templateContent, [...here, ">> template-content >>"], inClosed);
    for (const root of node.shadowRoots ?? []) {
      if (root.shadowRootType === "user-agent") continue;
      const closed = root.shadowRootType === "closed";
      if (closed) reading.closedRoots++;
      visit(root, [...here, closed ? ">> closed-shadow-root >>" : ">> shadow-root >>"], inClosed || closed);
    }
    // A same-process frame's document is part of this target's tree; an
    // out-of-process one is read through its own session.
    if (node.contentDocument) visit(node.contentDocument, [...here, ">> frame-document >>"], inClosed);
  };

  for (const { session, url } of sessions) {
    try {
      const { root } = (await withTimeout(
        session.send("DOM.getDocument", { depth: -1, pierce: true }),
        names.timeoutMs,
        "DOM.getDocument",
      )) as { root: CdpNode };
      visit(root, [], false);
    } catch (e) {
      reading.unreadable.push(`document ${url || "(no address)"}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  return reading;
}
