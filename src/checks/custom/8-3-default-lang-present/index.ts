/**
 * `custom/8-3-default-lang-present` (RGAA test 8.3.1). Implements the record
 * in `src/rulesets/rgaa-4.1.2/checks.json` as written, in its order:
 *
 * 1. The html element of the top-level document carries the indication its
 *    document type requires: no_fault, unless a rendered iframe or frame
 *    holds a document that cannot be read, or one with rendered or exposed
 *    text whose html element lacks the indication its own type requires;
 *    then cannot_tell.
 * 2. The html element has a lang or xml:lang attribute in any form:
 *    cannot_tell.
 * 3. Neither attribute, and an uncovered witness: fault on the first in tree
 *    order.
 * 4. Otherwise cannot_tell. Never inapplicable.
 *
 * Witness conditions (a) to (g) are checked in the page by
 * `../family-a/page/witness.js`, apart from (c) exposure and closed shadow
 * hosts, checked here through CDP. The pinned text fonts are in
 * `text-fonts.json`, with their version.
 *
 * RECORD: the browser does not keep one pinned family as written. Chromium
 * serialises BlinkMacSystemFont in the computed font-family as the quoted
 * name "system-ui", so, read literally, that list entry could never match and
 * text in the common system font stack (-apple-system, BlinkMacSystemFont,
 * "Segoe UI", …) would never be a witness. The page script reads a quoted
 * "system-ui" as BlinkMacSystemFont (and still refuses it when the page
 * defines a font face with either name). An author's own quoted "system-ui"
 * cannot be told apart from it; Chromium draws both with the system UI font.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CDPSession } from "playwright";
import type { CheckId } from "../../../schema/index.ts";
import type { CheckContext, CheckDefinition, CheckProvider, CheckRunResult } from "../../types.ts";
import { attributeValue, carriesIndication, describeType, documentType, requiredAttributes } from "../family-a/document-type.ts";
import type { DocInfo } from "../family-a/document-type.ts";
import { holdsRenderedOrExposedText, renderedFrames } from "../family-a/frames.ts";
import { arrayItems, callOn, describe, evaluateRemote, inFrame, pageExpression, releaseGroup } from "../family-a/page.ts";
import { cannotTell, checkError, fault, firstLine, frameNote, mainFrameOrFailure, noFault, scope, text } from "../family-a/result.ts";

export const ID: CheckId = "custom/8-3-default-lang-present";

interface FontList {
  version: string;
  families: string[];
}
const fontList = JSON.parse(readFileSync(join(import.meta.dirname, "text-fonts.json"), "utf8")) as FontList;

/** Unquoted generic families a witness may be drawn in. */
export const GENERIC_FAMILIES: readonly string[] = ["serif", "sans-serif", "monospace", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace"];

/** Elements allowed strictly between body and a witness (HTML namespace). */
export const PLAIN_CONTENT_ELEMENTS: readonly string[] = [
  "div", "main", "article", "section", "header", "footer", "nav", "aside", "address", "center", "p",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "dl", "dt", "dd", "blockquote", "figure", "figcaption",
  "table", "caption", "thead", "tbody", "tfoot", "tr", "td", "th", "span", "em", "strong", "b", "i", "u", "s",
  "small", "big", "mark", "abbr", "cite", "q", "dfn", "time", "data", "sub", "sup", "ins", "del", "bdi", "font",
];

export const definition: CheckDefinition = {
  id: ID,
  version: "1.0.0",
  defaultOptions: { textFonts: { version: fontList.version, families: fontList.families } },
};

function asciiLower(s: string): string {
  return s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

interface WitnessItem {
  locator: string;
  snippet: string;
}
interface WitnessData {
  items: WitnessItem[];
  stats: Record<string, number>;
  done: boolean;
  bodyEligible: boolean;
}

const GROUP = "rgaa-assist-8-3";
/** Candidates fetched per pass of the page script. */
const BATCH = 25;

/** Backend node ids of the static text nodes, not ignored, of the session's frame's full accessibility tree. */
async function exposedStaticText(session: CDPSession): Promise<Set<number>> {
  const r = (await session.send("Accessibility.getFullAXTree", {})) as {
    nodes: { ignored?: boolean; role?: { value?: unknown }; backendDOMNodeId?: number }[];
  };
  const out = new Set<number>();
  for (const n of r.nodes) {
    if (n.ignored !== true && n.role?.value === "StaticText" && typeof n.backendDOMNodeId === "number") out.add(n.backendDOMNodeId);
  }
  return out;
}

interface WitnessSearch {
  witness: WitnessItem | null;
  bodyEligible: boolean;
  stats: Record<string, number>;
  notExposed: number;
  underClosedShadowHost: number;
}

/**
 * The first uncovered witness in tree order: the first candidate of the page
 * script that is also (c) exposed and has no closed shadow host among body
 * and the elements down to its parent.
 */
async function firstUncoveredWitness(session: CDPSession): Promise<WitnessSearch> {
  const arg = {
    allowed: PLAIN_CONTENT_ELEMENTS,
    generics: GENERIC_FAMILIES,
    fonts: fontList.families.map(asciiLower),
    skip: 0,
    limit: BATCH,
  };
  let exposed: Set<number> | null = null;
  let notExposed = 0;
  let underClosedShadowHost = 0;
  try {
    for (;;) {
      const res = await evaluateRemote(session, pageExpression("witness", arg), GROUP);
      if (res.objectId === undefined) throw new Error("the witness script returned no object");
      const resultId = res.objectId;
      const data = (await callOn(session, resultId, "function () { return this.data; }", [], { byValue: true, objectGroup: GROUP })).value as WitnessData;
      for (let i = 0; i < data.items.length; i++) {
        const node = await callOn(session, resultId, "function (i) { return this.nodes[i]; }", [i], { byValue: false, objectGroup: GROUP });
        if (node.objectId === undefined) throw new Error("a candidate text node could not be reached");
        const described = await describe(session, node.objectId, 0);
        exposed ??= await exposedStaticText(session);
        if (!exposed.has(described.backendNodeId)) {
          notExposed++;
          continue;
        }
        const chain = await callOn(
          session,
          resultId,
          "function (i) { var out = []; var body = document.body; var e = this.nodes[i].parentNode; while (e !== null && e.nodeType === 1) { out.push(e); if (e === body) break; e = e.parentNode; } return out; }",
          [i],
          { byValue: false, objectGroup: GROUP },
        );
        if (chain.objectId === undefined) throw new Error("the ancestors of a candidate could not be reached");
        let host = false;
        for (const el of await arrayItems(session, chain.objectId)) {
          if (el.objectId === undefined) continue;
          const d = await describe(session, el.objectId, 0);
          if ((d.shadowRoots ?? []).length > 0) {
            host = true;
            break;
          }
        }
        if (host) {
          underClosedShadowHost++;
          continue;
        }
        const witness = data.items[i];
        if (witness === undefined) throw new Error("candidate list out of step");
        return { witness, bodyEligible: data.bodyEligible, stats: data.stats, notExposed, underClosedShadowHost };
      }
      if (data.done || data.items.length === 0) {
        return { witness: null, bodyEligible: data.bodyEligible, stats: data.stats, notExposed, underClosedShadowHost };
      }
      arg.skip += data.items.length;
      await releaseGroup(session, GROUP);
    }
  } finally {
    await releaseGroup(session, GROUP);
  }
}

function attributesNote(doc: DocInfo): string {
  const type = documentType(doc);
  const required = requiredAttributes(type);
  const values = required.map((name) => {
    const v = attributeValue(doc, name);
    return v === null ? `${name} absent` : `${name}="${v}"`;
  });
  return `document type ${describeType(type)} (content type ${doc.contentType}${doc.publicId ? `, doctype public identifier "${doc.publicId}"` : ""}), requiring ${required.join(" and ")}: ${values.join(", ")}`;
}

export async function examine(ctx: CheckContext): Promise<CheckRunResult> {
  const main = mainFrameOrFailure(ctx.frames);
  if ("outcome" in main) return main;
  let doc: DocInfo;
  try {
    doc = await inFrame<DocInfo>(main.frame, "doc-info");
  } catch (e) {
    return checkError(`reading the top-level document failed: ${firstLine(e)}`);
  }
  // RECORD: Chromium replaces an XML document that has no style information
  // with its XML viewer, a page of its own (an html element without lang
  // around the source and a sentence of its own). Read literally, step 3
  // could fault on the viewer's text, which is not the page's. The check
  // abstains, as custom/8-5-page-title-present does in its step 1.
  if (doc.xmlViewer) {
    return cannotTell(ID, [text(`The top-level resource (served as ${doc.contentType}) is shown in the browser's XML viewer, a page the browser builds around it; it is not examined.`)]);
  }
  const root = doc.root;
  if (root === null || !root.isHtmlHtml) {
    // RECORD: the record assumes the top-level document has an html element.
    // A document whose element is not an HTML html element (an SVG or other
    // XML document) is not covered by its steps; the check abstains.
    return cannotTell(ID, [text("The document element of the top-level document is not an HTML html element; the record's steps do not cover such a document.")]);
  }

  // (1)
  if (carriesIndication(doc)) {
    const htmlEvidence = { kind: "dom_node" as const, locator: "html", snippet: root.snippet, note: `Step 1: the html element carries the indication its document type requires; ${attributesNote(doc)}.` };
    let problems: string[];
    let examined: number;
    try {
      const frames = await renderedFrames(ctx, []);
      examined = frames.length;
      problems = [];
      for (const f of frames) {
        if (!f.readable) {
          problems.push(frameNote(f, `its document cannot be read (${f.reason})`));
          continue;
        }
        if (carriesIndication(f.doc)) continue;
        const held = await holdsRenderedOrExposedText(f);
        if (held === "yes") problems.push(frameNote(f, `its document holds rendered or exposed text and its html element lacks the indication its own type requires (${attributesNote(f.doc)})`));
        // RECORD: unrendered text whose exposure cannot be read (a
        // cross-origin document in the same process, or a frame element in a
        // shadow tree) is counted as exposed, so the check abstains where the
        // record might give no_fault.
        else if (held === "unknown") problems.push(frameNote(f, `its document holds unrendered text whose exposure could not be read, and its html element lacks the indication its own type requires (${attributesNote(f.doc)})`));
      }
    } catch (e) {
      return checkError(`examining the frames failed: ${firstLine(e)}`);
    }
    if (problems.length > 0) {
      return cannotTell(ID, [
        htmlEvidence,
        text(`Step 1: the wording does not say whether a framed document counts as part of the page for this test. ${problems.join(" | ")}`),
      ]);
    }
    return noFault(ID, [
      scope(`Step 1: the html element of the top-level document; ${attributesNote(doc)}. Rendered iframe or frame elements examined: ${examined}, none unreadable and none with rendered or exposed text lacking the indication.`, "html"),
      htmlEvidence,
    ]);
  }

  // (2)
  if (root.anyLangForm) {
    return cannotTell(ID, [
      {
        kind: "dom_node",
        locator: "html",
        snippet: root.snippet,
        note: `Step 2: the html element has a lang or xml:lang attribute, but not the indication its document type requires (empty, whitespace only, or not the required one); ${attributesNote(doc)}. The wording does not say whether such an attribute gives the indication.`,
      },
    ]);
  }

  // (3)
  let search: WitnessSearch;
  try {
    search = await firstUncoveredWitness(await ctx.cdpFor(main.frame));
  } catch (e) {
    return checkError(`looking for a witness failed: ${firstLine(e)}`);
  }
  if (search.witness !== null) {
    return fault(ID, "uncovered-witness", [
      {
        kind: "dom_node",
        locator: search.witness.locator,
        snippet: search.witness.snippet,
        note: "Step 3: this element's text is visible, exposed, ordinary text (a witness), and neither it nor any ancestor carries lang or xml:lang in any form.",
      },
      { kind: "dom_node", locator: "html", snippet: root.snippet, note: `Step 3: the html element has neither lang nor xml:lang; ${attributesNote(doc)}.` },
    ]);
  }

  // (4)
  const s = search.stats;
  const counts = [
    `${s["textNodes"] ?? 0} text node(s) reached under body through plain content elements without a role, aria-hidden, hidden, inert or language attribute`,
    `${s["notTwoLetters"] ?? 0} without two letters in a row`,
    `${s["font"] ?? 0} in a font outside the generic families and the pinned list ${fontList.version}, or defined by the page`,
    `${s["paint"] ?? 0} failing the paint conditions`,
    `${s["contrast"] ?? 0} failing the contrast conditions`,
    `${s["geometry"] ?? 0} failing the geometry conditions`,
    `${search.notExposed} not exposed in the accessibility tree`,
    `${search.underClosedShadowHost} under a closed shadow host`,
  ];
  return cannotTell(ID, [
    {
      kind: "dom_node",
      locator: "html",
      snippet: root.snippet,
      note: `Step 4: the html element has neither lang nor xml:lang, and no uncovered witness was found${search.bodyEligible ? "" : " (body is not an HTML body element, or carries a role, aria-hidden, hidden, inert or language attribute, or is a shadow host)"}: ${counts.join("; ")}. The second route may hold, but the check cannot show that every text element is covered.`,
    },
  ]);
}

export const defaultLangPresentProvider: CheckProvider = {
  name: "custom/8-3-default-lang-present",
  checks: [definition],
  async run(ctx) {
    return new Map([[ID, await examine(ctx)]]);
  },
};
