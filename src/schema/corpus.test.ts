import { describe, expect, it } from "vitest";
import { entry116 } from "../../tests/fixtures/schema-fixtures.ts";
import { CorpusCaseSchema } from "./corpus.ts";

function testCase(over: Record<string, unknown> = {}): Record<string, any> {
  return {
    id: "obj-adjacent-link-valid",
    kind: "test",
    source: { kind: "planted", author: "case writer" },
    licence: "project's own",
    adaptation: null,
    files: ["index.html"],
    test: "1.1.6",
    branch: "valid",
    routes: ["adjacent-link"],
    expected: { fail_only: { status: "needs_review", reason: "not_enabled" }, full: { status: "passed" } },
    rationale: entry116().rationale,
    ...over,
  };
}

function engineCase(over: Record<string, unknown> = {}): Record<string, any> {
  return {
    id: "expect-already-met",
    kind: "engine",
    source: { kind: "planted", author: "case writer" },
    licence: "project's own",
    adaptation: null,
    files: ["index.html", "sample.json"],
    category: "target",
    description: "An expectation already true before the steps.",
    test: "1.1.6",
    expected: { status: "not_tested", reason: "expect_already_met", complete: false },
    ...over,
  };
}

const valid = (x: unknown) => CorpusCaseSchema.safeParse(x).success;

describe("corpus case", () => {
  it("accepts a test case and an engine case", () => {
    expect(valid(testCase())).toBe(true);
    expect(valid(engineCase())).toBe(true);
  });

  it("states an exact expected status for both enabled levels", () => {
    const c = testCase();
    delete c.expected.full;
    expect(valid(c)).toBe(false);
    expect(valid(testCase({ expected: { fail_only: { status: "needs_review", reason: "check_error" }, full: { status: "passed" } } }))).toBe(false);
  });

  it("needs a branch from 10.2 and a label that cites the official text", () => {
    expect(valid(testCase({ branch: "mostly_valid" }))).toBe(false);
    expect(valid(testCase({ rationale: { text: "because", citations: [] } }))).toBe(false);
  });

  it("records the source: an ACT case keeps its ACT label, which is not the RGAA label", () => {
    const act = {
      kind: "act",
      rule: "object-has-accessible-name",
      testCase: "passed-1",
      actLabel: "passed",
      url: "https://www.w3.org/WAI/standards-guidelines/act/rules/",
      pinned: "abc123",
    };
    expect(valid(testCase({ source: act, licence: "W3C", adaptation: "added a heading" }))).toBe(true);
    expect(valid(testCase({ source: { ...act, actLabel: undefined } }))).toBe(false);
    expect(valid(testCase({ adaptation: undefined }))).toBe(false);
  });

  it("refuses an engine case with an unknown category", () => {
    expect(valid(engineCase({ category: "network" }))).toBe(false);
  });
});
