/**
 * `custom/11-8-optgroup-label-attribute` (RGAA test 11.8.2). Implements the
 * record's `examines` text in `src/rulesets/rgaa-4.1.2/checks.json`.
 *
 * Every <optgroup> with a <select> ancestor, in every document and shadow
 * tree; S is its nearest <select> ancestor. Per optgroup O, in order:
 * (1) S is not inside a form (no flat-tree ancestor that is a form or has role form, null form owner): cannot_tell.
 * (2) S is not rendered, not exposed, or not visible (opacity 0, or no part at least 4 px square
 *     inside the page's scrollable area and every clipping ancestor): cannot_tell.
 * (3) O's parent is not S: cannot_tell.
 * (4) O has a hidden attribute, computed display none, aria-hidden="true" or inert: cannot_tell.
 * (5) O has a <legend> child: cannot_tell.
 * (6) O has a label attribute, whatever its value: holds.
 * (7) otherwise: fault.
 *
 * RECORD: "inside every clipping ancestor" is computed from overflow (and paint containment) of
 * the ancestors in S's containing-block chain, the CSS clip property, and clip-path inset().
 * Visibility needs positive evidence (Q59): any style that can hide S and that the check does not
 * measure makes visibility unknown, so step (2) gives cannot_tell, unless the measured part is
 * already under 4 pixels square. On S, any flat-tree ancestor or a hosting frame element: a
 * clip-path other than inset() (Q57); a clip-path (inset() included) or clip on an ancestor off
 * the containing-block chain; a mask; filter or backdrop-filter; opacity below 1; a transform
 * other than an axis-aligned translation or scale (rotation, skew, 3D, rotate, motion path). Also
 * S fixed to the viewport and outside it, S outside the visible part of a document whose viewport cannot scroll (overflow hidden or clip
 * on its root or body, scrolling="no" on its frame element), and S in such a document when a
 * hosting frame element is shown only in part.
 * RECORD: for S inside a frame, the frame elements that host its document count as ancestors for
 * opacity, and S is not visible when such a frame element is not visible by the same rule. The
 * record speaks of "the page's scrollable area" without saying how frames enter it.
 */
import type { CheckDefinition, CheckResult } from "../../types.ts";
import type { CheckId } from "../../../schema/index.ts";
import type { PageRead } from "../family-c/read.ts";
import { assemble, exposure, partsOf } from "../family-c/result.ts";
import type { Verdict } from "../family-c/result.ts";
import type { Unmeasured } from "../family-c/scan.js";

export const CHECK_ID = "custom/11-8-optgroup-label-attribute" as CheckId;

export const definition: CheckDefinition = {
  id: CHECK_ID,
  version: "1.0.5",
  defaultOptions: { listCap: 50 },
};

/** What step (2) says for each style or situation the check does not measure. */
const UNMEASURED: Record<Unmeasured, string> = {
  "clip-path": "a clip-path the check does not measure (a shape other than inset(), a box keyword, url(), or an unparsed value) on it, an ancestor or a hosting frame element",
  "off-chain": "a clip-path or clip on an ancestor outside its containing-block chain (or that of a hosting frame element), not measured there",
  mask: "a mask on it, an ancestor or a hosting frame element",
  filter: "a filter or backdrop-filter on it, an ancestor or a hosting frame element",
  opacity: "an opacity below 1 on it, an ancestor or a hosting frame element",
  transform: "a transform the check does not resolve (rotation, skew, 3D, rotate, motion path) on it, an ancestor or a hosting frame element",
  fixed: "it or a hosting frame element is fixed to the viewport and lies outside it, where scrolling never brings it",
  "no-scroll": "it or a hosting frame element lies outside the visible part of a document that cannot scroll",
  "partial-frame": "its document cannot scroll and a hosting frame element is shown only in part",
};

export function derive(read: PageRead, options: Readonly<Record<string, unknown>>): CheckResult {
  const listCap = typeof options["listCap"] === "number" ? options["listCap"] : 50;
  const { parts, unread } = partsOf(read, (f) => f.scan?.optgroups);
  const verdicts: Verdict[] = [];
  for (const { frame, value } of parts) {
    for (const o of value.groups) {
      const v = (kind: Verdict["kind"], branch: string): void => {
        verdicts.push({ kind, branch, frame, element: o });
      };
      const s = value.selects[o.select];
      if (s === undefined) {
        v("cannot_tell", "Its select element could not be read.");
        continue;
      }
      const sAt = `its select (${s.locator})`;
      if (!s.inForm) {
        v("cannot_tell", `Step (1): ${sAt} is not inside a form (no form or role=form ancestor, no form owner); criterion 11.8 is asked of each form.`);
        continue;
      }
      if (s.notRendered) {
        v("cannot_tell", `Step (2): ${sAt} is not rendered.`);
        continue;
      }
      if (s.ariaHidden || s.inert) {
        v("cannot_tell", `Step (2): ${sAt} is not exposed (aria-hidden="true" or inert on it, an ancestor or a hosting frame element).`);
        continue;
      }
      if (s.opacityZero) {
        v("cannot_tell", `Step (2): ${sAt} is not visible (computed opacity 0 on it or an ancestor).`);
        continue;
      }
      if (s.visible === null) {
        const why = s.unmeasured.map((u) => UNMEASURED[u]).join("; ") || "a style the check does not measure";
        v("cannot_tell", `Step (2): whether ${sAt} is visible is not known: ${why}.`);
        continue;
      }
      if (s.visible === false) {
        v("cannot_tell", `Step (2): ${sAt} is not visible (no part at least 4 pixels square inside the page's scrollable area and every clipping ancestor).`);
        continue;
      }
      if (!frame.host.known) {
        v("cannot_tell", "The frame element hosting this document could not be read, so step (2) cannot be ruled out.");
        continue;
      }
      const exposed = exposure(frame, s.ax);
      if (exposed === false) {
        v("cannot_tell", `Step (2): ${sAt} is absent or ignored in the accessibility tree.`);
        continue;
      }
      if (exposed === null) {
        v("cannot_tell", `The accessibility node of ${sAt} could not be read, so step (2) cannot be ruled out.`);
        continue;
      }
      if (!o.parentIsSelect) {
        v("cannot_tell", "Step (3): the optgroup's parent is not its select (it is nested in another element of the list).");
        continue;
      }
      if (o.hiddenAttr || o.displayNone || o.ariaHidden || o.inertAttr) {
        v("cannot_tell", 'Step (4): the optgroup has a hidden attribute, computed display none, aria-hidden="true" or inert.');
        continue;
      }
      if (o.legendChild) {
        v("cannot_tell", "Step (5): the optgroup has a legend child, a labelling form the RGAA 4.1.2 text does not consider.");
        continue;
      }
      if (o.hasLabel) {
        v("ok", "Step (6): the optgroup has a label attribute.");
        continue;
      }
      v("fault", "Step (7): the optgroup has no label attribute.");
    }
  }
  return assemble(
    { checkId: CHECK_ID, verdicts, unread, what: "optgroup element(s) in a select", listCap },
    read,
    (f) => f.scan?.optgroups.ok === true,
  );
}
