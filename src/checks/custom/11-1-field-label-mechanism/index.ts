/**
 * `custom/11-1-field-label-mechanism` (RGAA test 11.1.1). Implements the
 * record's `examines` text in `src/rulesets/rgaa-4.1.2/checks.json`.
 *
 * Form fields as the glossary lists them, in every document and shadow
 * tree (`scan.js`, `fieldClass`). Elements the record names as never
 * faulted (inputs of other types, option, optgroup, datalist, roles option,
 * checkbox, radio and switch, a combobox containing an input, a listbox a
 * combobox controls or owns) are cannot_tell. Per remaining field, in order:
 * (1) not rendered, or aria-hidden="true" or inert on it or an ancestor: cannot_tell.
 * (2) no aria-labelledby, aria-label or title attribute, no label in its labels list or
 *     with for equal to its id in its tree, and no label ancestor: fault.
 * (3) otherwise: cannot_tell.
 * Page: fault if any field has one; otherwise cannot_tell if there is any field; otherwise inapplicable.
 *
 * RECORD: "explicit role of ..." is read as the first token of the role attribute, compared
 * ignoring ASCII case (the record of 11.8.2 states that rule; this one does not say).
 * RECORD: "a combobox" whose aria-controls or aria-owns names a listbox is read as an element with
 * an explicit role=combobox or an <input list> (whose implicit role is combobox). This can only
 * remove faults.
 */
import type { CheckDefinition, CheckResult } from "../../types.ts";
import type { CheckId } from "../../../schema/index.ts";
import type { PageRead } from "../family-c/read.ts";
import { assemble, partsOf } from "../family-c/result.ts";
import type { Verdict } from "../family-c/result.ts";

export const CHECK_ID = "custom/11-1-field-label-mechanism" as CheckId;

export const definition: CheckDefinition = {
  id: CHECK_ID,
  version: "1.0.2",
  defaultOptions: { listCap: 50 },
};

export function derive(read: PageRead, options: Readonly<Record<string, unknown>>): CheckResult {
  const listCap = typeof options["listCap"] === "number" ? options["listCap"] : 50;
  const { parts, unread } = partsOf(read, (f) => f.scan?.fields);
  const verdicts: Verdict[] = [];
  // Elements the record never faults (options of a long list, for example) are listed after the
  // fields, so that they do not crowd the fields out of a capped list.
  const never: Verdict[] = [];
  for (const { frame, value } of parts) {
    for (const el of value) {
      const v = (kind: Verdict["kind"], branch: string): void => {
        verdicts.push({ kind, branch, frame, element: el });
      };
      if (el.cls.startsWith("never:")) {
        never.push({
          kind: "cannot_tell",
          frame,
          element: el,
          branch: `Not decided by the record (${el.cls.slice("never:".length)}): it may take a name from its content or another element, which no route of the test names.`,
        });
        continue;
      }
      if (el.notRendered === true) {
        v("cannot_tell", "Step (1): the field is not rendered.");
        continue;
      }
      if (el.ariaHidden === true) {
        v("cannot_tell", 'Step (1): aria-hidden="true" on the field or an ancestor.');
        continue;
      }
      if (el.inert === true) {
        v("cannot_tell", "Step (1): the field is inert.");
        continue;
      }
      if (!frame.host.known) {
        v("cannot_tell", "The frame element hosting this document could not be read, so step (1) cannot be ruled out.");
        continue;
      }
      const m = el.mechanisms;
      if (m === undefined) {
        v("cannot_tell", "Its labelling attributes could not be read.");
        continue;
      }
      if (!m.ariaLabelledby && !m.ariaLabel && !m.title && !m.labelsList && !m.labelAncestor) {
        v("fault", "Step (2): no aria-labelledby, aria-label or title attribute, no associated label, and no label ancestor; every condition of the test needs one of these.");
        continue;
      }
      const present = [
        m.ariaLabelledby ? "aria-labelledby" : "",
        m.ariaLabel ? "aria-label" : "",
        m.title ? "title" : "",
        m.labelsList ? "an associated label" : "",
        m.labelAncestor ? "a label ancestor" : "",
      ].filter((x) => x !== "");
      v("cannot_tell", `Step (3): it has ${present.join(", ")}; the check does not decide whether a present mechanism is sufficient.`);
    }
  }
  verdicts.push(...never);
  return assemble(
    { checkId: CHECK_ID, verdicts, unread, what: "form field(s) and related element(s)", listCap },
    read,
    (f) => f.scan?.fields.ok === true,
  );
}
