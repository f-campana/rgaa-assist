/**
 * `custom/8-5-page-title-present` (RGAA test 8.5.1). Implements the record in
 * `src/rulesets/rgaa-4.1.2/checks.json` as written, in its order:
 *
 * 1. Content type neither text/html nor application/xhtml+xml, or a document
 *    element that is not an HTML html element: cannot_tell.
 * 2. No HTML title element in the document tree, in any template content, in
 *    any shadow tree, and no noscript text containing "<title" in any ASCII
 *    case: fault.
 * 3. The first title element of the document tree is a child of document.head
 *    and its text qualifies: no_fault, unless a rendered iframe or frame holds
 *    a document that cannot be read, or one with rendered or exposed text and
 *    no qualifying title child of its head; then cannot_tell.
 * 4. Otherwise cannot_tell. Never inapplicable.
 *
 * Qualifying text: a character of general category L or N that is not on the
 * pinned list of blank-looking characters (`blank-characters.json`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CDPSession } from "playwright";
import type { CheckId } from "../../../schema/index.ts";
import type { CheckContext, CheckDefinition, CheckProvider, CheckRunResult, RawEvidence } from "../../types.ts";
import { holdsRenderedOrExposedText, renderedFrames } from "../family-a/frames.ts";
import { describe, evaluateRemote, inFrame, releaseGroup } from "../family-a/page.ts";
import type { CdpNode } from "../family-a/page.ts";
import { cannotTell, checkError, fault, firstLine, frameNote, mainFrameOrFailure, noFault, scope, text } from "../family-a/result.ts";

export const ID: CheckId = "custom/8-5-page-title-present";

interface BlankList {
  version: string;
  codePoints: string[];
}

const blankList = JSON.parse(readFileSync(join(import.meta.dirname, "blank-characters.json"), "utf8")) as BlankList;
/** The pinned blank-looking characters, as code points. */
export const BLANK_CODE_POINTS: readonly number[] = blankList.codePoints.map((u) => {
  const m = /^U\+([0-9A-F]{4,6})$/.exec(u);
  if (m === null) throw new Error(`bad code point ${u} in blank-characters.json`);
  return Number.parseInt(m[1] ?? "", 16);
});

export const definition: CheckDefinition = {
  id: ID,
  version: "1.0.0",
  defaultOptions: { blankCharacters: { version: blankList.version, codePoints: blankList.codePoints } },
};

interface TitleMain {
  xmlViewer: boolean;
  contentType: string;
  rootIsHtmlHtml: boolean;
  inTree: number;
  inTemplate: number;
  inShadow: number;
  noscriptWithTitle: number;
  first: { childOfHead: boolean; qualifies: boolean; text: string; locator: string; snippet: string } | null;
  headLocator: string | null;
  headSnippet: string | null;
}

const GROUP = "rgaa-assist-8-5";

function asciiLower(s: string): string {
  return s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/**
 * A title element, or noscript text containing "<title", inside a closed
 * shadow tree of the top-level document, which page scripts cannot reach.
 * Read through CDP (`DOM.describeNode`, piercing shadow roots), without
 * entering framed documents.
 *
 * RECORD: CDP does not give an element's namespace, so inside a closed
 * shadow tree any element named title counts (an SVG title too). Step 2 then
 * does not hold and the check abstains where the record would fault on a
 * page whose only title-named element is an SVG title in a closed shadow tree.
 */
async function titleInClosedShadowTree(session: CDPSession): Promise<boolean> {
  try {
    const doc = await evaluateRemote(session, "document", GROUP);
    if (doc.objectId === undefined) throw new Error("no document object");
    const tree = await describe(session, doc.objectId, -1);
    const found = (node: CdpNode, closed: boolean): boolean => {
      if (closed && node.nodeType === 1) {
        if (asciiLower(node.localName) === "title") return true;
        if (asciiLower(node.localName) === "noscript" && (node.children ?? []).some((c) => c.nodeType === 3 && asciiLower(c.nodeValue).includes("<title"))) {
          return true;
        }
      }
      for (const c of node.children ?? []) if (found(c, closed)) return true;
      for (const s of node.shadowRoots ?? []) if (found(s, closed || s.shadowRootType === "closed")) return true;
      if (node.templateContent !== undefined && found(node.templateContent, closed)) return true;
      return false;
    };
    return found(tree, false);
  } finally {
    await releaseGroup(session, GROUP);
  }
}

async function frameProblems(ctx: CheckContext): Promise<{ examined: number; problems: string[] }> {
  const frames = await renderedFrames(ctx, BLANK_CODE_POINTS);
  const problems: string[] = [];
  for (const f of frames) {
    if (!f.readable) {
      problems.push(frameNote(f, `its document cannot be read (${f.reason})`));
      continue;
    }
    if (f.doc.headTitleQualifies) continue;
    const held = await holdsRenderedOrExposedText(f);
    if (held === "yes") problems.push(frameNote(f, "its document holds rendered or exposed text and no title element, child of its head, whose text qualifies"));
    // RECORD: when every non-whitespace text node of the framed document is
    // unrendered and its accessibility tree cannot be read (a cross-origin
    // document in the same process, or a frame element in a shadow tree), the
    // check cannot show the text is not exposed; it counts it as exposed and
    // abstains, which is narrower than the record (that would give no_fault
    // if the text is in fact not exposed).
    else if (held === "unknown") {
      problems.push(frameNote(f, "its document holds unrendered text whose exposure could not be read, and no title element, child of its head, whose text qualifies"));
    }
  }
  return { examined: frames.length, problems };
}

export async function examine(ctx: CheckContext): Promise<CheckRunResult> {
  const main = mainFrameOrFailure(ctx.frames);
  if ("outcome" in main) return main;
  let t: TitleMain;
  try {
    t = await inFrame<TitleMain>(main.frame, "title-main", { blank: BLANK_CODE_POINTS });
  } catch (e) {
    return checkError(`reading the top-level document failed: ${firstLine(e)}`);
  }

  // (1)
  // RECORD: the browser does not behave as step 1 assumes for one kind of
  // resource. An XML document served as application/xhtml+xml whose root is
  // not an XHTML html element (and that has no style information) is replaced
  // by Chromium's XML viewer: an XHTML page with an HTML html element and no
  // title, built around the source. Read literally, step 1 lets it through and
  // step 2 faults on the viewer. It is the case step 1 describes ("a page of
  // its own" wrapped around a resource), so it is answered cannot_tell here.
  if (t.xmlViewer) {
    return cannotTell(ID, [
      text(`Step 1: the top-level resource (served as ${t.contentType}) is shown in the browser's XML viewer, a page the browser builds around it; it is not an HTML document.`),
    ]);
  }
  if ((t.contentType !== "text/html" && t.contentType !== "application/xhtml+xml") || !t.rootIsHtmlHtml) {
    return cannotTell(ID, [
      text(
        `Step 1: the top-level document is served as ${t.contentType}${t.rootIsHtmlHtml ? "" : " and its document element is not an HTML html element"}; it may be a resource the browser wraps in a page of its own.`,
      ),
    ]);
  }

  // (2)
  if (t.inTree === 0 && t.inTemplate === 0 && t.inShadow === 0 && t.noscriptWithTitle === 0) {
    let closed: boolean;
    try {
      closed = await titleInClosedShadowTree(await ctx.cdpFor(main.frame));
    } catch (e) {
      return checkError(`reading the closed shadow trees of the top-level document failed: ${firstLine(e)}`);
    }
    if (!closed) {
      return fault(ID, "no-title-element", [
        {
          kind: "dom_node",
          locator: t.headLocator ?? "html",
          snippet: t.headSnippet ?? "",
          note: "Step 2: the page as examined has no title element anywhere: none in the document tree, in template contents or in shadow trees (open or closed), and no noscript text containing <title. This is where a title element is expected.",
        },
      ]);
    }
    return cannotTell(ID, [text("Step 4: the only title elements (or noscript text containing <title) are inside closed shadow trees. The wording does not say whether such an element gives the page a title.")]);
  }

  // (3)
  const first = t.first;
  if (first !== null && first.childOfHead && first.qualifies) {
    let frames: { examined: number; problems: string[] };
    try {
      frames = await frameProblems(ctx);
    } catch (e) {
      return checkError(`examining the frames failed: ${firstLine(e)}`);
    }
    const titleEvidence: RawEvidence = {
      kind: "dom_node",
      locator: first.locator,
      snippet: first.snippet,
      note: "The first title element of the document tree, a child of head, with qualifying text.",
    };
    if (frames.problems.length > 0) {
      return cannotTell(ID, [
        titleEvidence,
        text(
          `Step 3: the page holds ${frames.problems.length} rendered frame(s) the check abstains on; the wording does not say whether a framed document is a web page for this test. ${frames.problems.join(" | ")}`,
        ),
      ]);
    }
    return noFault(ID, [
      scope(
        `Step 3: the first title element of the top-level document tree is a child of head and its text holds a letter or digit that is not blank-looking (list ${blankList.version}). Rendered iframe or frame elements examined: ${frames.examined}, none without a qualifying title where text is rendered or exposed, none unreadable.`,
        first.locator,
      ),
      titleEvidence,
    ]);
  }

  // (4)
  const why: string[] = [];
  if (first === null) why.push("the document tree has no title element; the only ones are in template contents, shadow trees or noscript text");
  else {
    if (!first.childOfHead) why.push("the first title element is not a child of head");
    if (!first.qualifies) why.push("the first title element is empty or holds only whitespace, punctuation, symbols or blank-looking characters");
  }
  const evidence: RawEvidence[] = [text(`Step 4: ${why.join("; ")}. The wording does not say whether such an element gives the page a title.`)];
  if (first !== null) evidence.unshift({ kind: "dom_node", locator: first.locator, snippet: first.snippet, note: "The first title element of the document tree (the one document.title reads)." });
  return cannotTell(ID, evidence);
}

export const pageTitleProvider: CheckProvider = {
  name: "custom/8-5-page-title-present",
  checks: [definition],
  async run(ctx) {
    return new Map([[ID, await examine(ctx)]]);
  },
};
