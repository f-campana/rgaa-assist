import type { ReduceInput, ReduceResult, ReductionItem, ReductionOutcome } from "../contract.ts";
import { NotImplementedError } from "./not-implemented.ts";

/**
 * The one ordered rule of spec 8.4, over one set of results:
 * 1. `failed` if any item is failed;
 * 2. otherwise `not_tested` if any is not tested;
 * 3. otherwise `needs_review` if any needs review;
 * 4. otherwise `not_applicable` if all are not applicable;
 * 5. otherwise `passed`.
 *
 * An empty set gives `{ ok: false, error: { code: "empty_set" } }`. It never
 * reduces to `passed` or `not_applicable`.
 *
 * The outcome's `reasons` are the distinct reasons of the items whose status
 * equals the outcome's status, sorted (JavaScript string order); empty for
 * `passed`, `failed` and `not_applicable`. `complete` is true when every item
 * is complete. `notRun` is the sorted union of the items' `notRun`.
 */
export function reduceSet(
  items: readonly ReductionItem[],
): { ok: true; outcome: ReductionOutcome } | { ok: false; error: { code: "empty_set" } } {
  void items;
  throw new NotImplementedError("reduceSet");
}

/**
 * Results per criterion at the four levels of spec 8.4, from the findings of
 * one run. Ruleset-neutral: every plug-in reuses it.
 *
 * Declared targets: for each sample page, `<page>/initial`, then
 * `<page>/<state>` for each declared state in order.
 *
 * ## Validation first (all-or-nothing, codes in `ReductionError`)
 *
 * Every declared target has exactly one `TargetExecution` and no execution is
 * for an undeclared target; every finding is of `input.ruleset`, for a test of
 * `criteria` and a declared target; every (test, declared target) pair has
 * exactly one finding. Otherwise return `{ ok: false, errors }`, every
 * problem once, in this order: targets, then findings.
 *
 * ## Levels (each uses `reduceSet`; a finding enters as an item with
 * `reasons` = `[reason]` or `[]`)
 *
 * 1. **Criterion on a target** (`criterionOnTarget`): for each criterion and
 *    each declared target, over the findings of the criterion's tests on that
 *    target. `tests` lists them in official order.
 * 2. **Criterion on a page** (`criterionOnPage`): for each criterion and page,
 *    over the level-1 results of the page's declared targets. `targets` lists
 *    them in declared order. A page that passes as loaded and fails with a
 *    state is failed.
 * 3. **Process-aware** (`criterionOnPageInProcess`): for each criterion and
 *    page. `processes`: ids of the sample processes whose `steps` contain the
 *    page, in sample order. If none, the result equals level 2, with
 *    `pages: [page]` and `missingSteps: []`. Otherwise `pages` is the union of
 *    those processes' steps, in order of first appearance, without
 *    duplicates. The set holds, for each step: when the step is not a sample
 *    page, one item
 *    `{ status: not_tested, reasons: [target_not_established], complete: false, notRun: [] }`;
 *    otherwise the step's level-2 result, always. A step that is a sample
 *    page is never replaced by a synthetic item: its level-2 result already
 *    holds `not_tested` for each target that was not established, and it
 *    keeps a `failed` found on another of its targets (8.2: a known fault
 *    still gives `failed`). `missingSteps` lists, in `pages` order, the steps
 *    that are not sample pages and the steps whose `<step>/initial` target
 *    was not established. When it is not empty, `complete` is false. So step
 *    1 failed and step 2 missing gives `failed`, incomplete; step 1 passed
 *    and step 2 missing gives `not_tested`; and a step whose `initial` target
 *    was not established but whose declared state failed contributes
 *    `failed`.
 *    (Amended by the orchestrator on 2026-11-16, before the freeze.)
 * 4. **Criterion on the sample** (`criterionOnSample`): for each criterion,
 *    over the level-3 results of every sample page. `pages` lists them in
 *    sample order.
 *
 * An empty set at any level is an error (`empty_set`, with the level, the
 * criterion and the target, page or `sample` in `at`).
 *
 * ## Order (8.8)
 *
 * Each array is sorted by criterion in official order, then: level 1 by page
 * in sample order and target in declared order; levels 2 and 3 by page in
 * sample order. No rate or count is computed.
 */
export function reduce(input: ReduceInput): ReduceResult {
  void input;
  throw new NotImplementedError("reduce");
}
