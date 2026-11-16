import type { ReduceInput, ReduceResult, ReductionError, ReductionItem, ReductionOutcome } from "../contract.ts";
import { INITIAL_STATE_ID, canonicalJson, compareDottedIds } from "../../schema/index.ts";
import type { Finding, ReducedResults, Status, TargetExecution } from "../../schema/index.ts";

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
  if (items.length === 0) return { ok: false, error: { code: "empty_set" } };
  const has = (s: Status) => items.some((i) => i.status === s);
  let status: Status;
  if (has("failed")) status = "failed";
  else if (has("not_tested")) status = "not_tested";
  else if (has("needs_review")) status = "needs_review";
  else if (items.every((i) => i.status === "not_applicable")) status = "not_applicable";
  else status = "passed";

  const reasons =
    status === "needs_review" || status === "not_tested"
      ? sortedUnique(items.filter((i) => i.status === status).flatMap((i) => i.reasons))
      : [];
  return {
    ok: true,
    outcome: {
      status,
      reasons,
      complete: items.every((i) => i.complete),
      notRun: sortedUnique(items.flatMap((i) => i.notRun)),
    },
  };
}

/** Distinct values, sorted in JavaScript string order. */
function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
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
  const { sample } = input;
  // Official order, whatever order the caller used.
  const criteria = [...input.criteria]
    .sort((a, b) => compareDottedIds(a.id, b.id))
    .map((c) => ({ id: c.id, tests: [...c.tests].sort(compareDottedIds) }));

  // Declared targets, in sample then declared order.
  const pageTargets = new Map<string, string[]>();
  const declared: string[] = [];
  for (const page of sample.pages) {
    const ids = [`${page.id}/${INITIAL_STATE_ID}`, ...page.states.map((s) => `${page.id}/${s.id}`)];
    pageTargets.set(page.id, ids);
    declared.push(...ids);
  }
  const declaredSet = new Set(declared);

  const errors: ReductionError[] = [];
  const seenErrors = new Set<string>();
  const report = (e: ReductionError) => {
    const key = canonicalJson(e);
    if (seenErrors.has(key)) return;
    seenErrors.add(key);
    errors.push(e);
  };

  // --- Targets ---
  const executions = new Map<string, TargetExecution[]>();
  for (const t of input.targets) {
    const list = executions.get(t.targetId);
    if (list === undefined) executions.set(t.targetId, [t]);
    else list.push(t);
  }
  for (const id of declared) {
    const n = executions.get(id)?.length ?? 0;
    if (n === 0) report({ code: "missing_target", targetId: id });
    else if (n > 1) report({ code: "duplicate", targetId: id });
  }
  for (const t of input.targets) {
    if (!declaredSet.has(t.targetId)) report({ code: "unknown_target", targetId: t.targetId });
  }

  // --- Findings ---
  const testsInCriteria = new Set(criteria.flatMap((c) => c.tests));
  const findingsByKey = new Map<string, Finding[]>();
  const keyOf = (test: string, targetId: string) => `${test}\u0000${targetId}`;
  for (const f of input.findings) {
    if (f.ruleset !== input.ruleset || !testsInCriteria.has(f.test)) {
      report({ code: "foreign_finding", test: f.test, targetId: f.targetId });
      continue;
    }
    if (!declaredSet.has(f.targetId)) {
      report({ code: "unknown_target", targetId: f.targetId });
      continue;
    }
    const k = keyOf(f.test, f.targetId);
    const list = findingsByKey.get(k);
    if (list === undefined) findingsByKey.set(k, [f]);
    else {
      list.push(f);
      report({ code: "duplicate", test: f.test, targetId: f.targetId });
    }
  }
  for (const c of criteria) {
    for (const test of c.tests) {
      for (const targetId of declared) {
        if (!findingsByKey.has(keyOf(test, targetId))) report({ code: "missing_finding", test, targetId });
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const findingAt = (test: string, targetId: string): Finding => {
    const f = findingsByKey.get(keyOf(test, targetId))?.[0];
    if (f === undefined) throw new Error("unreachable: validated above");
    return f;
  };
  const established = new Map(input.targets.map((t) => [t.targetId, t.established]));
  const pageIds = new Set(sample.pages.map((p) => p.id));

  const emptySets: ReductionError[] = [];
  const reduced: ReducedResults = {
    ruleset: input.ruleset,
    criterionOnTarget: [],
    criterionOnPage: [],
    criterionOnPageInProcess: [],
    criterionOnSample: [],
  };

  for (const c of criteria) {
    // Level 1.
    const onTarget = new Map<string, ReductionOutcome>();
    for (const targetId of declared) {
      const findings = c.tests.map((t) => findingAt(t, targetId));
      const r = reduceSet(findings.map(findingItem));
      if (!r.ok) {
        emptySets.push({ code: "empty_set", level: "criterion_on_target", criterion: c.id, at: targetId });
        continue;
      }
      onTarget.set(targetId, r.outcome);
      reduced.criterionOnTarget.push({ criterion: c.id, ...r.outcome, targetId, tests: c.tests });
    }
    if (emptySets.length > 0) continue;

    // Level 2.
    const onPage = new Map<string, ReductionOutcome>();
    for (const page of sample.pages) {
      const targets = pageTargets.get(page.id) ?? [];
      const r = reduceSet(targets.map((t) => outcomeItem(onTarget.get(t))));
      if (!r.ok) {
        emptySets.push({ code: "empty_set", level: "criterion_on_page", criterion: c.id, at: page.id });
        continue;
      }
      onPage.set(page.id, r.outcome);
      reduced.criterionOnPage.push({ criterion: c.id, ...r.outcome, pageId: page.id, targets });
    }

    // Level 3.
    const inProcess = new Map<string, ReductionOutcome>();
    for (const page of sample.pages) {
      const processes = sample.processes.filter((p) => p.steps.includes(page.id));
      const own = onPage.get(page.id);
      if (own === undefined) continue;
      if (processes.length === 0) {
        inProcess.set(page.id, own);
        reduced.criterionOnPageInProcess.push({
          criterion: c.id,
          ...own,
          pageId: page.id,
          processes: [],
          pages: [page.id],
          missingSteps: [],
        });
        continue;
      }
      const pages = [...new Set(processes.flatMap((p) => p.steps))];
      const items: ReductionItem[] = pages.map((step) =>
        pageIds.has(step)
          ? outcomeItem(onPage.get(step))
          : { status: "not_tested", reasons: ["target_not_established"], complete: false, notRun: [] },
      );
      const missingSteps = pages.filter(
        (step) => !pageIds.has(step) || established.get(`${step}/${INITIAL_STATE_ID}`) !== true,
      );
      const r = reduceSet(items);
      if (!r.ok) {
        emptySets.push({ code: "empty_set", level: "criterion_on_page_in_process", criterion: c.id, at: page.id });
        continue;
      }
      const outcome = { ...r.outcome, complete: r.outcome.complete && missingSteps.length === 0 };
      inProcess.set(page.id, outcome);
      reduced.criterionOnPageInProcess.push({
        criterion: c.id,
        ...outcome,
        pageId: page.id,
        processes: processes.map((p) => p.id),
        pages,
        missingSteps,
      });
    }

    // Level 4.
    const pages = sample.pages.map((p) => p.id);
    const r = reduceSet(pages.map((p) => outcomeItem(inProcess.get(p))));
    if (!r.ok) {
      emptySets.push({ code: "empty_set", level: "criterion_on_sample", criterion: c.id, at: "sample" });
      continue;
    }
    reduced.criterionOnSample.push({ criterion: c.id, ...r.outcome, pages });
  }
  if (emptySets.length > 0) return { ok: false, errors: emptySets };

  return { ok: true, reduced };
}

function findingItem(f: Finding): ReductionItem {
  return { status: f.status, reasons: f.reason === undefined ? [] : [f.reason], complete: f.complete, notRun: f.notRun };
}

function outcomeItem(o: ReductionOutcome | undefined): ReductionItem {
  if (o === undefined) throw new Error("unreachable: every lower-level result exists");
  return o;
}
