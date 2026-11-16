import type { SampleFile, SampleWarning } from "../../schema/index.ts";
import { NotImplementedError } from "./not-implemented.ts";

/**
 * Warnings about a sample (spec 7.5). Never blocks a run. Ruleset-neutral.
 *
 * Warnings, in this order:
 * 1. `fixed_kind_missing`, in `FIXED_PAGE_KINDS` order, for each fixed kind
 *    that no page has and `absentKinds` does not list;
 * 2. `service_without_page`, in `services` order, for each declared service
 *    that no page names in `service`;
 * 3. `process_step_not_in_pages`, in process then step order, for each step
 *    id that is not a page id;
 * 4. `process_step_without_process`, in page order, for each page with kind
 *    `process_step` that no process lists;
 * 5. `too_few_random_pages`, when `randomPages < required`, where
 *    `randomPages` counts pages whose only kind is `random`, `otherPages` is
 *    the number of the other pages, and `required = ceil(otherPages / 10)`.
 *    Pages are counted, not states.
 *
 * What the check cannot verify is `SAMPLE_UNVERIFIABLE`, carried by the
 * statements of every output, not returned here.
 */
export function checkSample(sample: SampleFile): SampleWarning[] {
  void sample;
  throw new NotImplementedError("checkSample");
}
