/**
 * Contract tests for `reduceSet` and `reduce` (spec 8.2, 8.4, 8.8).
 */
import { describe, expect, it } from "vitest";
import { reduce, reduceSet } from "../../src/rulesets/shared/index.ts";
import type { ReduceInput, ReductionItem } from "../../src/rulesets/contract.ts";
import { ReducedResultsSchema } from "../../src/schema/index.ts";
import type { Finding, ReducedResults, Reason, SampleFile, Status } from "../../src/schema/index.ts";
import { F, RULESET, declaredTargets, executions, finding, sample, shuffled } from "./helpers.ts";

// ---------------------------------------------------------------------------
// reduceSet: the ordered rule
// ---------------------------------------------------------------------------

function item(status: Status, reasons: Reason[] = [], complete = true, notRun: string[] = []): ReductionItem {
  return { status, reasons, complete, notRun };
}

const P = () => item("passed");
const FA = () => item("failed");
const NA = () => item("not_applicable");
const NR = (r: Reason = "not_enabled") => item("needs_review", [r]);
const NT = (r: Reason = "check_error") => item("not_tested", [r], false);

function outcome(items: ReductionItem[]) {
  const r = reduceSet(items);
  if (!r.ok) throw new Error(`reduceSet failed: ${JSON.stringify(r)}`);
  return r.outcome;
}

describe("reduceSet: the ordered rule of 8.4", () => {
  it("1. failed if any is failed", () => {
    expect(outcome([P(), NA(), NR(), NT(), FA()]).status).toBe("failed");
    expect(outcome([FA(), P()]).status).toBe("failed");
  });

  it("2. otherwise not_tested if any is not tested", () => {
    expect(outcome([P(), NA(), NR(), NT()]).status).toBe("not_tested");
    expect(outcome([NT(), P()]).status).toBe("not_tested");
  });

  it("3. otherwise needs_review if any needs review", () => {
    expect(outcome([P(), NA(), NR()]).status).toBe("needs_review");
    expect(outcome([NA(), NR()]).status).toBe("needs_review");
  });

  it("4. otherwise not_applicable if all are not applicable", () => {
    expect(outcome([NA(), NA()]).status).toBe("not_applicable");
    expect(outcome([NA()]).status).toBe("not_applicable");
  });

  it("5. otherwise passed: all passed, or passed beside not_applicable", () => {
    expect(outcome([P(), P()]).status).toBe("passed");
    expect(outcome([NA(), P(), NA()]).status).toBe("passed");
  });

  it("a set of one reduces to its own status", () => {
    for (const s of ["passed", "failed", "not_applicable", "needs_review", "not_tested"] as const) {
      const one = s === "needs_review" ? NR() : s === "not_tested" ? NT() : item(s);
      expect(outcome([one]).status).toBe(s);
    }
  });

  it("an empty set is an error, never passed or not_applicable", () => {
    expect(reduceSet([])).toEqual({ ok: false, error: { code: "empty_set" } });
  });

  it("reasons: the distinct reasons of the items with the winning status, sorted", () => {
    expect(outcome([NR("not_enabled"), NR("cannot_tell"), NR("not_enabled"), P()]).reasons).toEqual(["cannot_tell", "not_enabled"]);
    expect(outcome([NT("missing_observation"), NR("cannot_tell"), NT("check_error")]).reasons).toEqual(["check_error", "missing_observation"]);
  });

  it("reasons are empty for passed, failed and not_applicable", () => {
    expect(outcome([FA(), NT(), NR()]).reasons).toEqual([]);
    expect(outcome([P(), NA()]).reasons).toEqual([]);
    expect(outcome([NA()]).reasons).toEqual([]);
  });

  it("complete when every item is complete; notRun is the sorted union", () => {
    const o = outcome([item("failed", [], false, ["custom/b"]), item("passed", [], false, ["custom/c", "custom/a"]), item("passed", [], false, ["custom/b"])]);
    expect(o).toEqual({ status: "failed", reasons: [], complete: false, notRun: ["custom/a", "custom/b", "custom/c"] });
    expect(outcome([P(), NA()])).toEqual({ status: "passed", reasons: [], complete: true, notRun: [] });
  });

  it("a known fault stays failed beside an incomplete item, and the outcome is incomplete", () => {
    expect(outcome([FA(), NT("check_error")])).toMatchObject({ status: "failed", complete: false });
  });

  it("the order of the items does not matter", () => {
    const items = [NR("cannot_tell"), item("passed", [], false, ["custom/z"]), NR("checks_disagree"), NA()];
    const a = outcome(items);
    expect(outcome([...items].reverse())).toEqual(a);
    expect(outcome(shuffled(items))).toEqual(a);
  });
});

// ---------------------------------------------------------------------------
// reduce: building inputs
// ---------------------------------------------------------------------------

type Criteria = { id: string; tests: string[] }[];

/**
 * A reduce input with one finding per test and declared target. `pick`
 * chooses the finding; by default `passed`. Targets listed in
 * `notEstablished` get a not-established execution and, unless `pick` says
 * otherwise, a `not_tested` finding with `target_not_established`.
 */
function build(
  s: SampleFile,
  criteria: Criteria,
  pick: (test: string, targetId: string) => Finding | undefined = () => undefined,
  notEstablished: string[] = [],
): ReduceInput {
  const findings: Finding[] = [];
  for (const t of declaredTargets(s)) {
    for (const c of criteria) {
      for (const test of c.tests) {
        findings.push(pick(test, t) ?? (notEstablished.includes(t) ? F.notTested(test, t) : F.passed(test, t)));
      }
    }
  }
  return { ruleset: RULESET, criteria, sample: s, targets: executions(s, notEstablished), findings };
}

function reduced(input: ReduceInput): ReducedResults {
  const r = reduce(input);
  if (!r.ok) throw new Error(`reduce failed: ${JSON.stringify(r.errors)}`);
  return ReducedResultsSchema.parse(r.reduced);
}

function errors(input: ReduceInput) {
  const r = reduce(input);
  expect(r.ok).toBe(false);
  expect("reduced" in r).toBe(false);
  return r.ok ? [] : r.errors;
}

const onTarget = (r: ReducedResults, criterion: string, targetId: string) =>
  r.criterionOnTarget.find((x) => x.criterion === criterion && x.targetId === targetId);
const onPage = (r: ReducedResults, criterion: string, pageId: string) =>
  r.criterionOnPage.find((x) => x.criterion === criterion && x.pageId === pageId);
const inProcess = (r: ReducedResults, criterion: string, pageId: string) =>
  r.criterionOnPageInProcess.find((x) => x.criterion === criterion && x.pageId === pageId);
const onSample = (r: ReducedResults, criterion: string) => r.criterionOnSample.find((x) => x.criterion === criterion);

const C11: Criteria = [{ id: "1.1", tests: ["1.1.1", "1.1.2"] }];

// ---------------------------------------------------------------------------
// reduce: the four levels
// ---------------------------------------------------------------------------

describe("reduce: the four levels (8.4)", () => {
  it("a page that passes as loaded and fails in a declared state is failed, at every level above the target", () => {
    const s = sample([{ id: "home", states: ["menu"] }]);
    const input = build(s, C11, (test, t) => (test === "1.1.1" && t === "home/menu" ? F.failed(test, t) : undefined));
    expect(reduced(input)).toEqual({
      ruleset: RULESET,
      criterionOnTarget: [
        { criterion: "1.1", targetId: "home/initial", tests: ["1.1.1", "1.1.2"], status: "passed", reasons: [], complete: true, notRun: [] },
        { criterion: "1.1", targetId: "home/menu", tests: ["1.1.1", "1.1.2"], status: "failed", reasons: [], complete: true, notRun: [] },
      ],
      criterionOnPage: [
        { criterion: "1.1", pageId: "home", targets: ["home/initial", "home/menu"], status: "failed", reasons: [], complete: true, notRun: [] },
      ],
      criterionOnPageInProcess: [
        {
          criterion: "1.1",
          pageId: "home",
          processes: [],
          pages: ["home"],
          missingSteps: [],
          status: "failed",
          reasons: [],
          complete: true,
          notRun: [],
        },
      ],
      criterionOnSample: [{ criterion: "1.1", pages: ["home"], status: "failed", reasons: [], complete: true, notRun: [] }],
    });
  });

  it("level 1: over the criterion's tests on the target, listed in official order, reasons merged", () => {
    const s = sample([{ id: "home" }]);
    const criteria: Criteria = [{ id: "1.1", tests: ["1.1.2", "1.1.10"] }];
    const input = build(s, criteria, (test, t) => F.review(test, t, test === "1.1.2" ? "not_enabled" : "cannot_tell"));
    const r = reduced({ ...input, findings: [...input.findings].reverse() });
    expect(onTarget(r, "1.1", "home/initial")).toEqual({
      criterion: "1.1",
      targetId: "home/initial",
      tests: ["1.1.2", "1.1.10"],
      status: "needs_review",
      reasons: ["cannot_tell", "not_enabled"],
      complete: true,
      notRun: [],
    });
  });

  it("a state-only pass never makes the page pass a test that needs state", () => {
    const s = sample([{ id: "home", states: ["menu"] }]);
    const criteria: Criteria = [{ id: "1.1", tests: ["1.1.1"] }];
    const input = build(s, criteria, (test, t) => (t === "home/initial" ? F.review(test, t, "prerequisite_unmet") : undefined));
    const r = reduced(input);
    expect(onPage(r, "1.1", "home")).toMatchObject({ status: "needs_review", reasons: ["prerequisite_unmet"] });
    expect(onSample(r, "1.1")).toMatchObject({ status: "needs_review", reasons: ["prerequisite_unmet"] });
  });

  it("incompleteness and notRun travel up every level", () => {
    const s = sample([{ id: "home", states: ["menu"] }, { id: "about" }]);
    const input = build(s, C11, (test, t) =>
      test === "1.1.2" && t === "home/menu" ? finding(test, t, "failed", { notRun: ["custom/x"] }) : undefined,
    );
    const r = reduced(input);
    expect(onTarget(r, "1.1", "home/menu")).toMatchObject({ status: "failed", complete: false, notRun: ["custom/x"] });
    expect(onTarget(r, "1.1", "home/initial")).toMatchObject({ complete: true, notRun: [] });
    expect(onPage(r, "1.1", "home")).toMatchObject({ status: "failed", complete: false, notRun: ["custom/x"] });
    expect(onPage(r, "1.1", "about")).toMatchObject({ status: "passed", complete: true });
    expect(onSample(r, "1.1")).toMatchObject({ status: "failed", complete: false, notRun: ["custom/x"], pages: ["home", "about"] });
  });

  it("level 4: over the process-aware results of all pages", () => {
    // `b` passes on its own but is in a process with `a`, which fails.
    const s = sample([{ id: "a" }, { id: "b" }, { id: "c" }], [{ id: "p", steps: ["a", "b"] }]);
    const criteria: Criteria = [{ id: "1.1", tests: ["1.1.1"] }];
    const input = build(s, criteria, (test, t) => (t === "a/initial" ? F.failed(test, t) : t === "c/initial" ? F.na(test, t) : undefined));
    const r = reduced(input);
    expect(onPage(r, "1.1", "b")?.status).toBe("passed");
    expect(inProcess(r, "1.1", "b")?.status).toBe("failed");
    expect(onSample(r, "1.1")).toMatchObject({ status: "failed", pages: ["a", "b", "c"] });
  });
});

// ---------------------------------------------------------------------------
// reduce: processes
// ---------------------------------------------------------------------------

describe("reduce: processes (8.4 level 3)", () => {
  const C: Criteria = [{ id: "1.1", tests: ["1.1.1"] }];

  it("step 1 failed and step 2 missing: failed, incomplete, with the missing step named", () => {
    const s = sample([{ id: "s1" }], [{ id: "signup", steps: ["s1", "s2"] }]);
    const r = reduced(build(s, C, (test, t) => F.failed(test, t)));
    expect(inProcess(r, "1.1", "s1")).toEqual({
      criterion: "1.1",
      pageId: "s1",
      processes: ["signup"],
      pages: ["s1", "s2"],
      missingSteps: ["s2"],
      status: "failed",
      reasons: [],
      complete: false,
      notRun: [],
    });
  });

  it("step 1 passed and step 2 missing: not_tested", () => {
    const s = sample([{ id: "s1" }], [{ id: "signup", steps: ["s1", "s2"] }]);
    const r = reduced(build(s, C));
    expect(inProcess(r, "1.1", "s1")).toMatchObject({
      status: "not_tested",
      reasons: ["target_not_established"],
      complete: false,
      missingSteps: ["s2"],
    });
    // The page's own result is kept beside it.
    expect(onPage(r, "1.1", "s1")).toMatchObject({ status: "passed", complete: true });
    expect(onSample(r, "1.1")?.status).toBe("not_tested");
  });

  it("a step that is a sample page but whose initial target was not established counts as missing", () => {
    const s = sample([{ id: "s1" }, { id: "s2" }], [{ id: "signup", steps: ["s1", "s2"] }]);
    const r = reduced(build(s, C, undefined, ["s2/initial"]));
    for (const page of ["s1", "s2"]) {
      expect(inProcess(r, "1.1", page)).toMatchObject({
        status: "not_tested",
        reasons: ["target_not_established"],
        complete: false,
        processes: ["signup"],
        pages: ["s1", "s2"],
        missingSteps: ["s2"],
      });
    }
  });

  it("amended rule: a step whose initial target was not established but whose declared state failed contributes failed", () => {
    const s = sample([{ id: "s1" }, { id: "s2", states: ["open"] }], [{ id: "signup", steps: ["s1", "s2"] }]);
    const input = build(s, C, (test, t) => (t === "s2/open" ? F.failed(test, t) : undefined), ["s2/initial"]);
    const r = reduced(input);
    expect(onPage(r, "1.1", "s2")).toMatchObject({ status: "failed", complete: false });
    for (const page of ["s1", "s2"]) {
      expect(inProcess(r, "1.1", page)).toMatchObject({ status: "failed", reasons: [], complete: false, missingSteps: ["s2"] });
    }
    expect(onSample(r, "1.1")).toMatchObject({ status: "failed", complete: false });
  });

  it("a step whose initial target was established but a declared state was not: not missing, still not_tested", () => {
    const s = sample([{ id: "s1" }, { id: "s2", states: ["open"] }], [{ id: "signup", steps: ["s1", "s2"] }]);
    const r = reduced(build(s, C, undefined, ["s2/open"]));
    expect(inProcess(r, "1.1", "s1")).toMatchObject({
      status: "not_tested",
      reasons: ["target_not_established"],
      complete: false,
      missingSteps: [],
    });
  });

  it("a page in two processes is reduced over the steps of both, in order of first appearance", () => {
    const s = sample([{ id: "a" }, { id: "b" }, { id: "c" }], [
      { id: "p1", steps: ["a", "b"] },
      { id: "p2", steps: ["c", "b"] },
    ]);
    const r = reduced(build(s, C, (test, t) => (t === "c/initial" ? F.failed(test, t) : undefined)));
    expect(inProcess(r, "1.1", "a")).toMatchObject({ processes: ["p1"], pages: ["a", "b"], missingSteps: [], status: "passed", complete: true });
    expect(inProcess(r, "1.1", "b")).toMatchObject({ processes: ["p1", "p2"], pages: ["a", "b", "c"], missingSteps: [], status: "failed" });
    expect(inProcess(r, "1.1", "c")).toMatchObject({ processes: ["p2"], pages: ["c", "b"], status: "failed" });
  });

  it("a page in no process: the level-2 result, with pages [page] and no missing step", () => {
    const s = sample([{ id: "x" }, { id: "s1" }], [{ id: "signup", steps: ["s1", "s2"] }]);
    const r = reduced(build(s, C, (test, t) => (t === "x/initial" ? F.review(test, t, "cannot_tell") : undefined)));
    const page = onPage(r, "1.1", "x")!;
    expect(inProcess(r, "1.1", "x")).toEqual({
      criterion: page.criterion,
      pageId: "x",
      processes: [],
      pages: ["x"],
      missingSteps: [],
      status: page.status,
      reasons: page.reasons,
      complete: page.complete,
      notRun: page.notRun,
    });
    expect(page).toMatchObject({ status: "needs_review", reasons: ["cannot_tell"] });
  });
});

// ---------------------------------------------------------------------------
// reduce: order and determinism (8.8)
// ---------------------------------------------------------------------------

describe("reduce: order and determinism", () => {
  const s = () => sample([{ id: "b", states: ["s1", "s0"] }, { id: "a" }], [{ id: "p", steps: ["a", "b"] }]);
  const criteria: Criteria = [
    { id: "1.2", tests: ["1.2.1"] },
    { id: "1.10", tests: ["1.10.1", "1.10.2"] },
  ];
  const pick = (test: string, t: string) =>
    t === "b/s0" && test === "1.10.2" ? F.failed(test, t) : t === "a/initial" ? F.review(test, t, "checks_disagree") : undefined;

  it("arrays are sorted by criterion in official order, then page in sample order, then target in declared order", () => {
    const r = reduced(build(s(), criteria, pick));
    expect(r.criterionOnTarget.map((x) => `${x.criterion} ${x.targetId}`)).toEqual([
      "1.2 b/initial",
      "1.2 b/s1",
      "1.2 b/s0",
      "1.2 a/initial",
      "1.10 b/initial",
      "1.10 b/s1",
      "1.10 b/s0",
      "1.10 a/initial",
    ]);
    expect(r.criterionOnPage.map((x) => `${x.criterion} ${x.pageId}`)).toEqual(["1.2 b", "1.2 a", "1.10 b", "1.10 a"]);
    expect(r.criterionOnPage[0]?.targets).toEqual(["b/initial", "b/s1", "b/s0"]);
    expect(r.criterionOnPageInProcess.map((x) => `${x.criterion} ${x.pageId}`)).toEqual(["1.2 b", "1.2 a", "1.10 b", "1.10 a"]);
    expect(r.criterionOnPageInProcess[0]?.pages).toEqual(["a", "b"]);
    expect(r.criterionOnSample.map((x) => x.criterion)).toEqual(["1.2", "1.10"]);
    expect(r.criterionOnSample[0]?.pages).toEqual(["b", "a"]);
  });

  it("the same input twice gives deeply equal output", () => {
    expect(reduce(build(s(), criteria, pick))).toEqual(reduce(build(s(), criteria, pick)));
  });

  it("shuffling the targets and findings does not change the output", () => {
    const input = build(s(), criteria, pick);
    const a = reduce(input);
    expect(a.ok).toBe(true);
    expect(reduce({ ...input, targets: shuffled(input.targets), findings: shuffled(input.findings) })).toEqual(a);
    expect(reduce({ ...input, targets: [...input.targets].reverse(), findings: [...input.findings].reverse() })).toEqual(a);
  });
});

// ---------------------------------------------------------------------------
// reduce: validation (all-or-nothing)
// ---------------------------------------------------------------------------

describe("reduce: validation errors", () => {
  const s = () => sample([{ id: "home", states: ["menu"] }]);
  const base = () => build(s(), C11);

  it("missing_target", () => {
    const input = base();
    expect(errors({ ...input, targets: input.targets.filter((t) => t.targetId !== "home/menu") })).toEqual([
      { code: "missing_target", targetId: "home/menu" },
    ]);
  });

  it("unknown_target: an execution for a target the sample does not declare", () => {
    const input = base();
    const ghost = executions(sample([{ id: "ghost" }]))[0]!;
    expect(errors({ ...input, targets: [...input.targets, ghost] })).toEqual([{ code: "unknown_target", targetId: "ghost/initial" }]);
  });

  it("unknown_target: a finding for a target the sample does not declare", () => {
    const input = base();
    expect(errors({ ...input, findings: [...input.findings, F.passed("1.1.1", "home/elsewhere")] })).toEqual([
      { code: "unknown_target", targetId: "home/elsewhere" },
    ]);
  });

  it("missing_finding", () => {
    const input = base();
    const findings = input.findings.filter((f) => !(f.test === "1.1.2" && f.targetId === "home/initial"));
    expect(errors({ ...input, findings })).toEqual([{ code: "missing_finding", test: "1.1.2", targetId: "home/initial" }]);
  });

  it("duplicate: two findings for one test and target", () => {
    const input = base();
    expect(errors({ ...input, findings: [...input.findings, F.failed("1.1.1", "home/menu")] })).toEqual([
      { code: "duplicate", test: "1.1.1", targetId: "home/menu" },
    ]);
  });

  it("duplicate: two executions of one target", () => {
    const input = base();
    expect(errors({ ...input, targets: [...input.targets, input.targets[0]!] })).toEqual([{ code: "duplicate", targetId: "home/initial" }]);
  });

  it("foreign_finding: a test that is not in criteria", () => {
    const input = base();
    expect(errors({ ...input, findings: [...input.findings, F.passed("9.9.9", "home/initial")] })).toEqual([
      { code: "foreign_finding", test: "9.9.9", targetId: "home/initial" },
    ]);
  });

  it("foreign_finding: a finding of another ruleset", () => {
    const input = base();
    const other = finding("1.1.1", "home/initial", "passed", { ruleset: "other-ruleset" });
    expect(errors({ ...input, findings: [...input.findings, other] })).toContainEqual({
      code: "foreign_finding",
      test: "1.1.1",
      targetId: "home/initial",
    });
  });

  it("empty_set: a criterion with no test", () => {
    const one = sample([{ id: "home" }]);
    const input = build(one, [...C11, { id: "1.3", tests: [] }]);
    expect(errors(input)).toContainEqual({ code: "empty_set", level: "criterion_on_target", criterion: "1.3", at: "home/initial" });
  });

  it("every problem once, targets before findings", () => {
    const input = base();
    const targets = input.targets.filter((t) => t.targetId !== "home/menu");
    const findings = input.findings.filter((f) => !(f.test === "1.1.1" && f.targetId === "home/initial"));
    expect(errors({ ...input, targets, findings })).toEqual([
      { code: "missing_target", targetId: "home/menu" },
      { code: "missing_finding", test: "1.1.1", targetId: "home/initial" },
    ]);
  });
});
