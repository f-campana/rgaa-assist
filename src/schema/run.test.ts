import { describe, expect, it } from "vitest";
import { finding, observation, specSample, targetInitial, targetState } from "../../tests/fixtures/schema-fixtures.ts";
import {
  CriterionOnPageInProcessSchema,
  CriterionOnTargetSchema,
  EffectiveLevelRecordSchema,
  FindingSchema,
  ObservationSchema,
  RunFileSchema,
  SampleWarningSchema,
  TargetExecutionSchema,
} from "./run.ts";
import { SAMPLE_UNVERIFIABLE, StatementsSchema, WHAT_THIS_IS_NOT } from "./statements.ts";

const ok = (schema: { safeParse: (x: unknown) => { success: boolean } }, x: unknown) => schema.safeParse(x).success;

describe("TargetExecution", () => {
  it("accepts an established initial target and an established declared state", () => {
    expect(ok(TargetExecutionSchema, targetInitial())).toBe(true);
    expect(ok(TargetExecutionSchema, targetState())).toBe(true);
  });

  it("never meets state on initial, or on a target that was not established", () => {
    expect(ok(TargetExecutionSchema, { ...targetInitial(), prerequisitesMet: ["state"] })).toBe(false);
    const t = targetState();
    t.established = false;
    t.steps = [{ action: "click", ok: false, error: "timeout" }];
    t.expect = { declared: true, metBeforeSteps: false, met: null };
    expect(ok(TargetExecutionSchema, t)).toBe(false);
    t.prerequisitesMet = [];
    expect(ok(TargetExecutionSchema, t)).toBe(true);
  });

  it("never meets assistive_tech in v1", () => {
    expect(ok(TargetExecutionSchema, { ...targetInitial(), prerequisitesMet: ["assistive_tech"] })).toBe(false);
  });

  it("is not established with a failed step or an expectation met before the steps", () => {
    const a = targetState();
    a.steps = [{ action: "click", ok: false, error: "no element" }];
    expect(ok(TargetExecutionSchema, a)).toBe(false);
    const b = targetState();
    b.expect = { declared: true, metBeforeSteps: true, met: true };
    expect(ok(TargetExecutionSchema, b)).toBe(false);
    b.established = false;
    b.prerequisitesMet = [];
    expect(ok(TargetExecutionSchema, b)).toBe(true);
  });

  it("refuses an outcome for an undeclared expect and an unknown step action", () => {
    expect(ok(TargetExecutionSchema, { ...targetInitial(), expect: { declared: false, metBeforeSteps: null, met: true } })).toBe(false);
    expect(ok(TargetExecutionSchema, { ...targetState(), steps: [{ action: "hover", ok: true }] })).toBe(false);
  });
});

describe("Observation", () => {
  it("accepts each outcome with its evidence", () => {
    expect(ok(ObservationSchema, observation())).toBe(true);
    expect(ok(ObservationSchema, observation({ outcome: "inapplicable" }))).toBe(true);
    expect(ok(ObservationSchema, observation({ outcome: "cannot_tell", evidence: [] }))).toBe(true);
    expect(
      ok(ObservationSchema, observation({ outcome: "fault", evidence: [{ id: "e", kind: "dom_node", locator: "#a", snippet: "<object>" }] })),
    ).toBe(true);
    expect(ok(ObservationSchema, observation({ outcome: "error", evidence: [], error: { kind: "scope_unreadable", message: "frame" } }))).toBe(
      true,
    );
  });

  it("refuses no_fault or inapplicable without scope_examined evidence", () => {
    expect(ok(ObservationSchema, observation({ evidence: [] }))).toBe(false);
    expect(ok(ObservationSchema, observation({ outcome: "inapplicable", evidence: [{ id: "e", kind: "text" }] }))).toBe(false);
  });

  it("refuses a fault without evidence, and error without its kind", () => {
    expect(ok(ObservationSchema, observation({ outcome: "fault", evidence: [] }))).toBe(false);
    expect(ok(ObservationSchema, observation({ outcome: "error", evidence: [] }))).toBe(false);
    expect(ok(ObservationSchema, observation({ error: { kind: "check_error", message: "x" } }))).toBe(false);
  });

  it("refuses an unknown outcome and a confidence field", () => {
    expect(ok(ObservationSchema, observation({ outcome: "probably_fine" }))).toBe(false);
    expect(ok(ObservationSchema, observation({ confidence: 0.8 }))).toBe(false);
  });
});

describe("Finding", () => {
  it("needs a reason from the status's own list for needs_review and not_tested", () => {
    expect(ok(FindingSchema, finding())).toBe(true);
    expect(ok(FindingSchema, finding({ reason: undefined }))).toBe(false);
    expect(ok(FindingSchema, finding({ reason: "check_error" }))).toBe(false);
    expect(ok(FindingSchema, finding({ status: "not_tested", reason: "check_error", complete: false, notRun: ["axe/object-alt"] }))).toBe(true);
    expect(ok(FindingSchema, finding({ status: "not_tested", reason: "not_enabled" }))).toBe(false);
  });

  it("has no reason on passed, failed or not_applicable", () => {
    const facts = { requirementFacts: { r: ["satisfied"] } };
    expect(ok(FindingSchema, finding({ ...facts, status: "passed", reason: undefined }))).toBe(true);
    expect(ok(FindingSchema, finding({ ...facts, status: "passed", reason: "not_enabled" }))).toBe(false);
    expect(ok(FindingSchema, finding({ status: "failed", reason: "check_error" }))).toBe(false);
    expect(ok(FindingSchema, finding({ status: "not_applicable", reason: "judgment_required" }))).toBe(false);
  });

  it("is incomplete when a check did not run or the target was not established", () => {
    expect(ok(FindingSchema, finding({ status: "failed", reason: undefined, notRun: ["axe/object-alt"], complete: true }))).toBe(false);
    expect(ok(FindingSchema, finding({ status: "failed", reason: undefined, notRun: ["axe/object-alt"], complete: false }))).toBe(true);
    expect(
      ok(FindingSchema, finding({ status: "not_tested", reason: "target_not_established", complete: true, requirementFacts: {}, observations: [] })),
    ).toBe(false);
  });

  it("stores a model suggestion only on needs_review", () => {
    const suggestion = {
      provider: "anthropic",
      model: "m",
      promptVersion: "1",
      schemaVersion: "1",
      proposedStatus: "passed",
      rationale: "r",
      evidenceSent: ["ev-1"],
    };
    expect(ok(FindingSchema, finding({ suggestion }))).toBe(true);
    expect(ok(FindingSchema, finding({ status: "failed", reason: undefined, suggestion }))).toBe(false);
  });

  it("lists facts in canonical order, with satisfied and inapplicable alone, and no violation with a dispute", () => {
    expect(ok(FindingSchema, finding({ requirementFacts: { r: ["error", "dispute"] } }))).toBe(true);
    expect(ok(FindingSchema, finding({ requirementFacts: { r: ["dispute", "error"] } }))).toBe(false);
    expect(ok(FindingSchema, finding({ requirementFacts: { r: ["error", "error"] } }))).toBe(false);
    expect(ok(FindingSchema, finding({ requirementFacts: { r: ["unresolved", "satisfied"] } }))).toBe(false);
    expect(ok(FindingSchema, finding({ requirementFacts: { r: ["dispute", "violation"] } }))).toBe(false);
    expect(ok(FindingSchema, finding({ requirementFacts: { r: ["confident"] } }))).toBe(false);
  });
});

describe("reduced results", () => {
  const base = { criterion: "1.1", complete: true, notRun: [] };

  it("carry reasons only for needs_review and not_tested", () => {
    expect(ok(CriterionOnTargetSchema, { ...base, status: "passed", reasons: [], targetId: "home/initial", tests: ["1.1.1"] })).toBe(true);
    expect(ok(CriterionOnTargetSchema, { ...base, status: "passed", reasons: ["not_enabled"], targetId: "home/initial", tests: ["1.1.1"] })).toBe(
      false,
    );
    expect(ok(CriterionOnTargetSchema, { ...base, status: "needs_review", reasons: [], targetId: "home/initial", tests: ["1.1.1"] })).toBe(false);
    expect(
      ok(CriterionOnTargetSchema, { ...base, status: "needs_review", reasons: ["check_error"], targetId: "home/initial", tests: ["1.1.1"] }),
    ).toBe(false);
  });

  it("mark a process result with a missing step as incomplete", () => {
    const r = { ...base, status: "failed", reasons: [], pageId: "signup-1", processes: ["signup"], pages: ["signup-1", "signup-2"], missingSteps: ["signup-2"] };
    expect(ok(CriterionOnPageInProcessSchema, r)).toBe(false);
    expect(ok(CriterionOnPageInProcessSchema, { ...r, complete: false })).toBe(true);
  });

  it("hold no rate or score", () => {
    expect(ok(CriterionOnTargetSchema, { ...base, status: "passed", reasons: [], targetId: "home/initial", tests: ["1.1.1"], rate: 1 })).toBe(false);
  });
});

describe("sample warnings and effective levels", () => {
  it("accept the five warnings of 7.5", () => {
    for (const w of [
      { code: "fixed_kind_missing", kind: "contact" },
      { code: "service_without_page", service: "account" },
      { code: "process_step_not_in_pages", process: "signup", step: "signup-3" },
      { code: "process_step_without_process", page: "orphan" },
      { code: "too_few_random_pages", randomPages: 0, otherPages: 4, required: 1 },
    ]) {
      expect(ok(SampleWarningSchema, w)).toBe(true);
    }
    expect(ok(SampleWarningSchema, { code: "fixed_kind_missing", kind: "search" })).toBe(false);
  });

  it("record blockedBy exactly when an entry runs at none", () => {
    const r = { test: "1.1.6", enabled: "full", authorised: "full", effective: "full", blockedBy: null };
    expect(ok(EffectiveLevelRecordSchema, r)).toBe(true);
    expect(ok(EffectiveLevelRecordSchema, { ...r, effective: "none" })).toBe(false);
    expect(ok(EffectiveLevelRecordSchema, { ...r, effective: "none", blockedBy: "check_version_changed" })).toBe(true);
  });
});

function statements(): Record<string, any> {
  return {
    covered: { ruleset: { id: "rgaa-4.1.2", version: "4.1.2" }, pagesExamined: ["home"], targetsExamined: ["home/initial"], testsDecided: 0 },
    notCovered: {
      testsForReview: [{ test: "1.1.6", targetId: "home/initial", reason: "not_enabled" }],
      testsNotTested: [],
      targetsNotExamined: [],
      sampleUnverifiable: [...SAMPLE_UNVERIFIABLE],
    },
    whatThisIsNot: WHAT_THIS_IS_NOT,
  };
}

describe("statements and the run file", () => {
  it("require the exact claim-boundary sentence and the sample limits", () => {
    expect(ok(StatementsSchema, statements())).toBe(true);
    expect(ok(StatementsSchema, { ...statements(), whatThisIsNot: "This site conforms." })).toBe(false);
    const s = statements();
    s.notCovered.sampleUnverifiable = s.notCovered.sampleUnverifiable.slice(1);
    expect(ok(StatementsSchema, s)).toBe(false);
    const t = statements();
    t.covered.conformanceRate = 0.5;
    expect(ok(StatementsSchema, t)).toBe(false);
  });

  it("accepts a minimal run file", () => {
    const hash = "0".repeat(64);
    const run = {
      schemaVersion: 1,
      statements: statements(),
      manifest: {
        toolVersion: "0.0.0",
        rulesets: [
          { id: "rgaa-4.1.2", version: "4.1.2", sourceCommit: "ca4019f", coverageMapHash: hash, evaluationSummaryHash: null, approvalLogHash: hash },
        ],
        versions: { axeCore: "4.14.0", playwright: "x", browser: "chromium x" },
        os: "darwin",
        locale: "en-GB",
        timeouts: { expect: 5000 },
        checkOptions: { "axe/object-alt": {} },
        sampleFileHash: hash,
        startedAt: "2026-11-16T10:00:00Z",
        endedAt: "2026-11-16T10:01:00Z",
        model: null,
      },
      sample: specSample(),
      sampleWarnings: [],
      targets: [targetInitial()],
      observations: [observation()],
      effectiveLevels: [
        { ruleset: "rgaa-4.1.2", levels: [{ test: "1.1.6", enabled: "none", authorised: "none", effective: "none", blockedBy: "not_enabled" }] },
      ],
      findings: [finding()],
      reduced: [
        {
          ruleset: "rgaa-4.1.2",
          criterionOnTarget: [],
          criterionOnPage: [],
          criterionOnPageInProcess: [],
          criterionOnSample: [],
        },
      ],
      evidenceFiles: [],
      modelDisclosures: [],
    };
    const r = RunFileSchema.safeParse(run);
    expect(r.success ? [] : r.error.issues).toEqual([]);
    expect(ok(RunFileSchema, { ...run, statements: undefined })).toBe(false);
  });
});
