/**
 * `custom/6-2-link-content-name` (RGAA test 6.2.1). Implements the record's
 * `examines` text in `src/rulesets/rgaa-4.1.2/checks.json`.
 *
 * Every HTML <a href>, SVG <a href | xlink:href>, and element with an
 * explicit role="link", in every document and shadow tree. The name is
 * computed from content only (`scan.js`, `contentName`). Per element, in
 * the record's order:
 * (1) the collected text has a character that is neither whitespace nor Private Use Area: holds.
 * (2) not rendered, aria-hidden on it or an ancestor, or not exposed in the accessibility tree: cannot_tell.
 * (3) content the name computation does not cover, an image whose alternative could not be computed,
 *     CSS generated content, or only Private Use Area characters: cannot_tell.
 * (4) a non-empty aria-labelledby (resolving to text), aria-label, title or xlink:title: cannot_tell.
 * (5) role="link" on an element that is not an <a> with href: cannot_tell.
 * (6) otherwise: fault.
 *
 * RECORD: "explicit role=\"link\"" is read as the first token of the role attribute, compared
 * ignoring ASCII case (the record of 11.8.2 states that rule; this one does not say).
 */
import type { CheckDefinition, CheckResult } from "../../types.ts";
import type { CheckId } from "../../../schema/index.ts";
import type { PageRead } from "../family-c/read.ts";
import { assemble, exposure, partsOf } from "../family-c/result.ts";
import type { Verdict } from "../family-c/result.ts";

export const CHECK_ID = "custom/6-2-link-content-name" as CheckId;

export const definition: CheckDefinition = {
  id: CHECK_ID,
  version: "1.0.1",
  defaultOptions: { listCap: 50 },
};

export function derive(read: PageRead, options: Readonly<Record<string, unknown>>): CheckResult {
  const listCap = typeof options["listCap"] === "number" ? options["listCap"] : 50;
  const { parts, unread } = partsOf(read, (f) => f.scan?.links);
  const verdicts: Verdict[] = [];
  for (const { frame, value } of parts) {
    for (const el of value) {
      const v = (kind: Verdict["kind"], branch: string): void => {
        verdicts.push({ kind, branch, frame, element: el });
      };
      if (el.name === "name") {
        v("ok", "Step (1): its content gives text that is neither whitespace nor Private Use Area characters.");
        continue;
      }
      if (el.notRendered === true) {
        v("cannot_tell", "Step (2): no name from content, and the link is not rendered.");
        continue;
      }
      if (el.ariaHidden === true) {
        v("cannot_tell", 'Step (2): no name from content, and aria-hidden="true" on it, an ancestor or a hosting frame element.');
        continue;
      }
      if (el.inert === true) {
        v("cannot_tell", "Step (2): no name from content, and inert (on it, an ancestor or a hosting frame element).");
        continue;
      }
      // The scan asks the accessibility tree only for links steps (3) to (5) would not take
      // (`ax` is then a number); for the others every remaining step gives cannot_tell anyway.
      if (typeof el.ax === "number") {
        const exposed = exposure(frame, el.ax);
        if (exposed === false) {
          v("cannot_tell", "Step (2): no name from content, and absent or ignored in the accessibility tree.");
          continue;
        }
        if (exposed === null) {
          v("cannot_tell", "No name from content; its node in the accessibility tree could not be read, so step (2) cannot be ruled out.");
          continue;
        }
      }
      if (el.blocking === true) {
        v("cannot_tell", "Step (3): no name from content, but it holds an object, embed, canvas, iframe, video, audio, math, form control or button, whose contribution is not computed.");
        continue;
      }
      if (el.altUncomputed === true) {
        v("cannot_tell", "Step (3): no name from content, but it holds an image whose alternative could not be computed.");
        continue;
      }
      if (el.generated === true) {
        v("cannot_tell", "Step (3): no name from content, but it or a descendant has CSS generated content (::before or ::after).");
        continue;
      }
      if (el.name === "pua") {
        v("cannot_tell", "Step (3): its content is only Private Use Area characters (an icon font, for example).");
        continue;
      }
      if (el.attributeName === true) {
        v("cannot_tell", "Step (4): no name from content, but aria-labelledby, aria-label, title or xlink:title gives one; whether a name from an attribute alone is accepted is not decided.");
        continue;
      }
      if (!el.isAnchorWithHref) {
        v("cannot_tell", 'Step (5): role="link" on an element that is not an <a> with href; it is a link only if a script handles its navigation.');
        continue;
      }
      if (!frame.host.known || typeof el.ax !== "number") {
        v("cannot_tell", "No name from content; the frame element hosting this document could not be read, so step (2) cannot be ruled out.");
        continue;
      }
      v("fault", "Step (6): an <a> with href, rendered and exposed, whose content gives no name, with no aria-labelledby, aria-label, title or xlink:title either.");
    }
  }
  return assemble(
    { checkId: CHECK_ID, verdicts, unread, what: "link(s) (a with href, SVG a with href or xlink:href, role=link)", listCap },
    read,
    (f) => f.scan?.links.ok === true,
  );
}
