import { describe, expect, it } from "vitest";
import { CaseResultSchema, EvaluationSummarySchema, caseMatches, tabulate } from "./evaluation.ts";
import type { CaseResult } from "./evaluation.ts";

const H = "b".repeat(64);

function result(over: Partial<CaseResult> = {}): CaseResult {
  return {
    case: "obj-valid-1",
    expected: { status: "passed" },
    actual: { kind: "finding", status: "passed", complete: true },
    missingObservations: [],
    matched: true,
    ...over,
  };
}

function summary(cases: CaseResult[]): Record<string, any> {
  return {
    schemaVersion: 1,
    ruleset: { id: "rgaa-4.1.2", version: "4.1.2" },
    corpus: { name: "working", set: "working", hash: H },
    toolVersion: "0.0.0",
    createdAt: "2026-12-01T10:00:00Z",
    links: [
      {
        test: "1.1.6",
        check: "custom/object-image-alternatives",
        requirement: "object-alternative",
        checkVersion: "1",
        scope: { branches: ["valid"], routes: ["adjacent-link"], description: "d" },
        cases,
        table: tabulate(cases),
      },
    ],
    entries: [
      {
        test: "1.1.6",
        entryHash: H,
        level: "full",
        checkVersions: { "axe/object-alt": "4.14.0", "custom/object-image-alternatives": "1" },
        scope: { branches: ["valid"], routes: ["adjacent-link"], description: "d" },
        cases,
        table: tabulate(cases),
      },
    ],
    engine: { cases: [], table: tabulate([]) },
  };
}

describe("caseMatches", () => {
  it("needs a finding with the expected status, and the reason and completeness when stated", () => {
    expect(caseMatches({ status: "passed" }, { kind: "finding", status: "passed", complete: true })).toBe(true);
    expect(caseMatches({ status: "passed" }, { kind: "finding", status: "needs_review", reason: "not_enabled", complete: true })).toBe(false);
    expect(caseMatches({ status: "passed" }, { kind: "crash", message: "boom" })).toBe(false);
    expect(caseMatches({ status: "not_tested", reason: "missing_observation" }, { kind: "finding", status: "not_tested", reason: "check_error", complete: false })).toBe(false);
    expect(caseMatches({ status: "failed", complete: false }, { kind: "finding", status: "failed", complete: true })).toBe(false);
    expect(caseMatches({ status: "failed" }, { kind: "finding", status: "failed", complete: false })).toBe(true);
  });
});

describe("tabulate", () => {
  it("counts cases by expected row and actual column, crashes and missing observations", () => {
    const t = tabulate([
      result(),
      result({ case: "b", actual: { kind: "finding", status: "needs_review", reason: "cannot_tell", complete: true }, matched: false }),
      result({ case: "c", expected: { status: "failed" }, actual: { kind: "crash", message: "x" }, matched: false }),
      result({ case: "d", expected: { status: "failed" }, actual: { kind: "finding", status: "not_tested", reason: "missing_observation", complete: false }, missingObservations: ["axe/object-alt"], matched: false }),
    ]);
    expect(t.cases).toBe(4);
    expect(t.expected.passed).toEqual({ passed: 1, failed: 0, not_applicable: 0, needs_review: 1, not_tested: 0, crash: 0 });
    expect(t.expected.failed).toEqual({ passed: 0, failed: 0, not_applicable: 0, needs_review: 0, not_tested: 1, crash: 1 });
    expect(t.missingObservations).toBe(1);
  });
});

describe("evaluation summary", () => {
  it("accepts a consistent summary", () => {
    const r = EvaluationSummarySchema.safeParse(summary([result()]));
    expect(r.success ? [] : r.error.issues).toEqual([]);
  });

  it("refuses a matched flag that disagrees with the result", () => {
    expect(CaseResultSchema.safeParse(result({ matched: false })).success).toBe(false);
    expect(
      CaseResultSchema.safeParse(result({ actual: { kind: "finding", status: "needs_review", reason: "not_enabled", complete: true } })).success,
    ).toBe(false);
  });

  it("refuses a table that is not the tabulation of its cases", () => {
    const s = summary([result()]);
    s.entries[0].table.expected.passed.passed = 2;
    expect(EvaluationSummarySchema.safeParse(s).success).toBe(false);
  });

  it("accepts a table whose keys come in another order", () => {
    const s = summary([result()]);
    const t = tabulate([result()]);
    s.entries[0].table = { cases: t.cases, missingObservations: t.missingObservations, expected: t.expected };
    expect(Object.keys(s.entries[0].table)).not.toEqual(Object.keys(t));
    expect(EvaluationSummarySchema.safeParse(s).success).toBe(true);
  });

  it("holds at most one measurement per test and per link", () => {
    const s = summary([result()]);
    s.entries.push({ ...s.entries[0], level: "fail_only" });
    expect(EvaluationSummarySchema.safeParse(s).success).toBe(false);
    const t = summary([result()]);
    t.links.push({ ...t.links[0] });
    expect(EvaluationSummarySchema.safeParse(t).success).toBe(false);
  });

  it("holds no rate or confidence", () => {
    const s = summary([result()]);
    s.entries[0].confidence = 0.99;
    expect(EvaluationSummarySchema.safeParse(s).success).toBe(false);
  });
});
