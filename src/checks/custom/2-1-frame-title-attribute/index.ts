/**
 * `custom/2-1-frame-title-attribute` (RGAA test 2.1.1). Implements the
 * record's `examines` text in `src/rulesets/rgaa-4.1.2/checks.json`.
 *
 * Every iframe and frame element of every document and shadow tree. Per
 * element, in the record's order:
 * (1) title attribute with a non-whitespace character: holds.
 * (2) title attribute empty or only whitespace: cannot_tell.
 * (3) no title, aria-hidden="true" on it, an ancestor or a hosting frame element: cannot_tell.
 * (4) no title, not rendered, or not exposed in the accessibility tree (inert included): cannot_tell.
 * (5) otherwise: fault. aria-label, aria-labelledby and role are ignored.
 */
import type { CheckDefinition, CheckResult } from "../../types.ts";
import type { CheckId } from "../../../schema/index.ts";
import type { PageRead } from "../family-c/read.ts";
import { assemble, exposure, partsOf } from "../family-c/result.ts";
import type { Verdict } from "../family-c/result.ts";

export const CHECK_ID = "custom/2-1-frame-title-attribute" as CheckId;

export const definition: CheckDefinition = {
  id: CHECK_ID,
  version: "1.0.3",
  defaultOptions: { listCap: 50 },
};

export function derive(read: PageRead, options: Readonly<Record<string, unknown>>): CheckResult {
  const listCap = typeof options["listCap"] === "number" ? options["listCap"] : 50;
  const { parts, unread } = partsOf(read, (f) => f.scan?.frames);
  const verdicts: Verdict[] = [];
  for (const { frame, value } of parts) {
    for (const el of value) {
      const v = (kind: Verdict["kind"], branch: string): void => {
        verdicts.push({ kind, branch, frame, element: el });
      };
      if (el.title === "text") v("ok", "Step (1): the title attribute has a non-whitespace character.");
      else if (el.title === "blank")
        v("cannot_tell", "Step (2): the title attribute is empty or only whitespace; the wording asks for the attribute, the glossary defines the title as its content.");
      else if (el.ariaHidden === true)
        v("cannot_tell", 'Step (3): no title attribute, and aria-hidden="true" on it, an ancestor or a hosting frame element; whether it is a technical frame needs judgment.');
      else if (el.notRendered === true) v("cannot_tell", "Step (4): no title attribute, and not rendered (display none, visibility hidden or collapse, or inside a frame that is not rendered).");
      else if (el.inert === true) v("cannot_tell", "Step (4): no title attribute, and inert (on it, an ancestor or a hosting frame element), so not exposed in the accessibility tree.");
      else if (!frame.host.known) v("cannot_tell", "No title attribute; the frame element hosting this document could not be read, so steps (3) and (4) cannot be ruled out.");
      else {
        const exposed = exposure(frame, el.ax);
        if (exposed === false) v("cannot_tell", "Step (4): no title attribute, and absent or ignored in the accessibility tree.");
        else if (exposed === null) v("cannot_tell", "No title attribute; its node in the accessibility tree could not be read, so step (4) cannot be ruled out.");
        else v("fault", "Step (5): no title attribute; rendered, exposed in the accessibility tree, not hidden with aria-hidden.");
      }
    }
  }
  return assemble(
    { checkId: CHECK_ID, verdicts, unread, what: "frame element(s) (iframe, frame)", listCap },
    read,
    (f) => f.scan?.frames.ok === true,
  );
}
