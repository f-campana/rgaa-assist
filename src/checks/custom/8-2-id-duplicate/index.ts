/**
 * `custom/8-2-id-duplicate` (RGAA test 8.2.1, the condition that id values
 * are unique in the page). Implements the record in
 * `src/rulesets/rgaa-4.1.2/checks.json` as written:
 *
 * 1. No doctype node: cannot_tell.
 * 2. Collect the elements of the top-level document tree in the HTML, SVG or
 *    MathML namespace with a non-blank id (attribute in no namespace), hidden
 *    or not.
 * 3. Two equal values (code point for code point): fault on the first pair.
 * 4. Otherwise cannot_tell. Never no_fault, never inapplicable.
 *
 * Read only. The engine runs custom providers before axe, so the DOM is read
 * before any other check could change it; this provider is listed first.
 */
import type { CheckId } from "../../../schema/index.ts";
import type { CheckContext, CheckDefinition, CheckProvider, CheckRunResult } from "../../types.ts";
import { inFrame } from "../family-a/page.ts";
import { cannotTell, checkError, fault, firstLine, mainFrameOrFailure, scope, text } from "../family-a/result.ts";

export const ID: CheckId = "custom/8-2-id-duplicate";

export const definition: CheckDefinition = { id: ID, version: "1.0.0", defaultOptions: {} };

interface IdsResult {
  doctype: boolean;
  elements: number;
  collected: number;
  pair: { value: string; first: { locator: string; snippet: string }; second: { locator: string; snippet: string } } | null;
  duplicatedValues: number;
}

export async function examine(ctx: CheckContext): Promise<CheckRunResult> {
  const main = mainFrameOrFailure(ctx.frames);
  if ("outcome" in main) return main;
  let r: IdsResult;
  try {
    r = await inFrame<IdsResult>(main.frame, "ids");
  } catch (e) {
    return checkError(`reading the top-level document failed: ${firstLine(e)}`);
  }
  if (!r.doctype) {
    return cannotTell(ID, [
      text(
        "Step 1: document.doctype is null. The test applies to each document type declaration, and the DOM cannot show whether the source holds a declaration the parser dropped.",
      ),
    ]);
  }
  if (r.pair !== null) {
    // RECORD: "report the first such pair in tree order" does not say how two
    // pairs are ordered. Read here as the earliest element (in tree order)
    // that shares its value with a later element, paired with the first later
    // element holding that value. Which pair is reported never changes the
    // outcome.
    const others = r.duplicatedValues - 1;
    return fault(ID, `id=${r.pair.value}`, [
      {
        kind: "dom_node",
        locator: r.pair.first.locator,
        snippet: r.pair.first.snippet,
        note: `Step 3: the id value "${r.pair.value}" is held by this element and by a later one in the top-level document tree (first of the pair, in tree order).`,
      },
      {
        kind: "dom_node",
        locator: r.pair.second.locator,
        snippet: r.pair.second.snippet,
        note: `Step 3: the second element with the id value "${r.pair.value}".`,
      },
      ...(others > 0 ? [text(`${others} other id value(s) of the document tree are also held by more than one element; only the first pair is reported.`)] : []),
    ]);
  }
  return cannotTell(ID, [
    scope(
      `Step 4: ${r.collected} element(s) with a non-blank id in the top-level document tree (${r.elements} element(s) in all), no two with the same value. Template contents, shadow trees and framed documents are not examined, so this never shows that every id in the page is unique.`,
    ),
  ]);
}

export const idDuplicateProvider: CheckProvider = {
  name: "custom/8-2-id-duplicate",
  checks: [definition],
  async run(ctx) {
    return new Map([[ID, await examine(ctx)]]);
  },
};
