import { describe, expect, it } from "vitest";
import { targetInitial } from "../../../tests/fixtures/schema-fixtures.ts";
import { FindingSchema, ReducedResultsSchema, SampleFileSchema, TargetExecutionSchema } from "../../schema/index.ts";
import type { Finding, Reason, SampleFile, Status, TargetExecution } from "../../schema/index.ts";
import type { ReduceInput, ReductionItem } from "../contract.ts";
import { reduce, reduceSet } from "./reduce.ts";

const item = (status: Status, over: Partial<ReductionItem> = {}): ReductionItem => ({
  status,
  reasons: [],
  complete: true,
  notRun: [],
  ...over,
});

describe("reduceSet", () => {
  it("refuses an empty set", () => {
    expect(reduceSet([])).toEqual({ ok: false, error: { code: "empty_set" } });
  });

  it("applies the ordered rule", () => {
    const status = (...s: Status[]) => {
      const r = reduceSet(s.map((x) => item(x, x === "needs_review" ? { reasons: ["not_enabled"] } : x === "not_tested" ? { reasons: ["check_error"] } : {})));
      return r.ok ? r.outcome.status : "error";
    };
    expect(status("passed", "failed", "not_tested")).toBe("failed");
    expect(status("passed", "needs_review", "not_tested")).toBe("not_tested");
    expect(status("passed", "needs_review", "not_applicable")).toBe("needs_review");
    expect(status("not_applicable", "not_applicable")).toBe("not_applicable");
    expect(status("not_applicable", "passed")).toBe("passed");
    expect(status("passed")).toBe("passed");
  });

  it("keeps the reasons of the winning status only, distinct and sorted", () => {
    const r = reduceSet([
      item("needs_review", { reasons: ["not_enabled"] }),
      item("needs_review", { reasons: ["cannot_tell", "not_enabled"] }),
      item("passed"),
    ]);
    expect(r).toEqual({ ok: true, outcome: { status: "needs_review", reasons: ["cannot_tell", "not_enabled"], complete: true, notRun: [] } });
    const f = reduceSet([item("failed"), item("not_tested", { reasons: ["check_error"] })]);
    expect(f.ok && f.outcome.reasons).toEqual([]);
  });

  it("is complete only when every item is, and unions notRun", () => {
    const r = reduceSet([
      item("failed", { complete: false, notRun: ["custom/b", "axe/a"] }),
      item("passed", { notRun: ["axe/a"] }),
    ]);
    expect(r.ok && r.outcome).toEqual({ status: "failed", reasons: [], complete: false, notRun: ["axe/a", "custom/b"] });
  });
});

// ---------------------------------------------------------------------------

const RULESET = "rgaa-4.1.2";

function sample(): SampleFile {
  return SampleFileSchema.parse({
    project: { name: "x", ruleset: RULESET },
    processes: [{ id: "signup", name: "Sign up", steps: ["s1", "s2", "s3"] }],
    pages: [
      {
        id: "home",
        url: "https://example.com/",
        kinds: ["home"],
        states: [{ id: "menu", steps: [{ click: "role=button" }], expect: { visible: "role=menu" } }],
      },
      { id: "s1", url: "https://example.com/s1", kinds: ["process_step"] },
      { id: "s2", url: "https://example.com/s2", kinds: ["process_step"] },
    ],
  });
}

const DECLARED = ["home/initial", "home/menu", "s1/initial", "s2/initial"];

function target(targetId: string, established = true): TargetExecution {
  const t = targetInitial();
  t.targetId = targetId;
  if (targetId.endsWith("/menu")) {
    t.steps = [{ action: "click", ok: established }];
    t.expect = { declared: true, metBeforeSteps: false, met: established };
    t.prerequisitesMet = established ? ["state"] : [];
  }
  t.established = established;
  return TargetExecutionSchema.parse(t);
}

function f(test: string, targetId: string, status: Status, reason?: Reason, over: Partial<Finding> = {}): Finding {
  return FindingSchema.parse({
    ruleset: RULESET,
    test,
    targetId,
    status,
    ...(reason === undefined ? {} : { reason }),
    complete: !(status === "not_tested"),
    notRun: [],
    requirementFacts: {},
    observations: [],
    ...over,
  });
}

/** Criterion 1.1 with tests 1.1.1, 1.1.2; every finding passed unless overridden. */
function input(overrides: Record<string, [Status, Reason?]> = {}, unestablished: string[] = []): ReduceInput {
  const findings: Finding[] = [];
  for (const test of ["1.1.1", "1.1.2"]) {
    for (const t of DECLARED) {
      const o = overrides[`${test} ${t}`];
      if (unestablished.includes(t)) findings.push(f(test, t, "not_tested", "target_not_established"));
      else findings.push(o ? f(test, t, o[0], o[1]) : f(test, t, "passed"));
    }
  }
  return {
    ruleset: RULESET,
    criteria: [{ id: "1.1", tests: ["1.1.1", "1.1.2"] }],
    sample: sample(),
    targets: DECLARED.map((t) => target(t, !unestablished.includes(t))),
    findings,
  };
}

describe("reduce", () => {
  it("produces every level, valid against the schema", () => {
    const r = reduce(input());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(ReducedResultsSchema.safeParse(r.reduced).success).toBe(true);
    expect(r.reduced.criterionOnTarget.map((x) => x.targetId)).toEqual(DECLARED);
    expect(r.reduced.criterionOnPage.map((x) => [x.pageId, x.targets])).toEqual([
      ["home", ["home/initial", "home/menu"]],
      ["s1", ["s1/initial"]],
      ["s2", ["s2/initial"]],
    ]);
    expect(r.reduced.criterionOnSample).toEqual([
      { criterion: "1.1", status: "not_tested", reasons: ["target_not_established"], complete: false, notRun: [], pages: ["home", "s1", "s2"] },
    ]);
  });

  it("a page that passes as loaded and fails with a state is failed", () => {
    const r = reduce(input({ "1.1.2 home/menu": ["failed"] }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.reduced.criterionOnPage[0]).toMatchObject({ pageId: "home", status: "failed" });
    expect(r.reduced.criterionOnPageInProcess[0]).toMatchObject({ pageId: "home", status: "failed", processes: [], pages: ["home"], missingSteps: [] });
  });

  it("process: a step that is not a sample page is not_tested, without hiding a failure", () => {
    const passed = reduce(input());
    if (!passed.ok) throw new Error("expected ok");
    expect(passed.reduced.criterionOnPageInProcess[1]).toEqual({
      criterion: "1.1",
      status: "not_tested",
      reasons: ["target_not_established"],
      complete: false,
      notRun: [],
      pageId: "s1",
      processes: ["signup"],
      pages: ["s1", "s2", "s3"],
      missingSteps: ["s3"],
    });
    const failed = reduce(input({ "1.1.1 s1/initial": ["failed"] }));
    if (!failed.ok) throw new Error("expected ok");
    expect(failed.reduced.criterionOnPageInProcess[2]).toMatchObject({ pageId: "s2", status: "failed", complete: false, missingSteps: ["s3"] });
  });

  it("process: a step whose initial target was not established is missing but keeps its own failure", () => {
    const i = input({}, ["s2/initial"]);
    i.sample.processes = [{ id: "p", name: "P", steps: ["s1", "home"] }];
    // home/initial not established, home/menu failed
    i.targets = DECLARED.map((t) => target(t, t !== "home/initial"));
    i.findings = i.findings.map((x) =>
      x.targetId === "home/initial"
        ? f(x.test, x.targetId, "not_tested", "target_not_established")
        : x.targetId === "home/menu" && x.test === "1.1.1"
          ? f(x.test, x.targetId, "failed")
          : x,
    );
    const r = reduce(i);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.reduced.criterionOnPageInProcess[1]).toMatchObject({
      pageId: "s1",
      status: "failed",
      complete: false,
      pages: ["s1", "home"],
      missingSteps: ["home"],
    });
  });

  it("validates all-or-nothing: targets, then findings", () => {
    const i = input();
    i.targets = [...i.targets.filter((t) => t.targetId !== "s1/initial"), target("ghost/initial"), target("home/menu")];
    i.findings = [
      ...i.findings.filter((x) => !(x.test === "1.1.2" && x.targetId === "s2/initial")),
      f("1.1.1", "home/initial", "passed"),
      f("2.1.1", "home/initial", "passed"),
      { ...f("1.1.1", "s2/initial", "passed"), ruleset: "other" },
      f("1.1.1", "ghost/initial", "passed"),
    ];
    const r = reduce(i);
    expect(r).toEqual({
      ok: false,
      errors: [
        { code: "duplicate", targetId: "home/menu" },
        { code: "missing_target", targetId: "s1/initial" },
        { code: "unknown_target", targetId: "ghost/initial" },
        { code: "duplicate", test: "1.1.1", targetId: "home/initial" },
        { code: "foreign_finding", test: "2.1.1", targetId: "home/initial" },
        { code: "foreign_finding", test: "1.1.1", targetId: "s2/initial" },
        { code: "missing_finding", test: "1.1.2", targetId: "s2/initial" },
      ],
    });
  });

  it("a criterion with no test is an empty set", () => {
    const i = input();
    i.criteria = [...i.criteria, { id: "1.2", tests: [] }];
    const r = reduce(i);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toEqual({ code: "empty_set", level: "criterion_on_target", criterion: "1.2", at: "home/initial" });
  });
});
