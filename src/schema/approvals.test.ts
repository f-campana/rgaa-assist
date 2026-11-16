import { describe, expect, it } from "vitest";
import { entry116, entry116Full } from "../../tests/fixtures/schema-fixtures.ts";
import { ApprovalLogSchema, requiredApprovers } from "./approvals.ts";
import { CoverageEntrySchema } from "./coverage.ts";

const H = "a".repeat(64);

function approval(over: Record<string, unknown> = {}): Record<string, any> {
  return {
    seq: 1,
    kind: "approval",
    test: "1.1.6",
    entryHash: H,
    level: "full",
    approvers: [{ role: "fabien", name: "Fabien" }],
    corpusCases: ["obj-valid-1"],
    evaluationSummaryHash: H,
    at: "2026-12-01T10:00:00Z",
    ...over,
  };
}

function demotion(over: Record<string, unknown> = {}): Record<string, any> {
  return { seq: 2, kind: "demotion", test: "1.1.6", level: "fail_only", reason: "wrong passed in trial", by: "orchestrator", at: "2026-12-02T10:00:00Z", ...over };
}

const valid = (log: unknown) => ApprovalLogSchema.safeParse(log).success;

describe("approval log", () => {
  it("accepts an ordered log of approvals and demotions", () => {
    expect(valid({ schemaVersion: 1, events: [] })).toBe(true);
    expect(valid({ schemaVersion: 1, events: [approval(), demotion(), approval({ seq: 3 })] })).toBe(true);
  });

  it("is append-only: seq starts at 1 and has no gap or reordering", () => {
    expect(valid({ schemaVersion: 1, events: [approval({ seq: 2 })] })).toBe(false);
    expect(valid({ schemaVersion: 1, events: [demotion({ seq: 2 }), approval({ seq: 1 })] })).toBe(false);
    expect(valid({ schemaVersion: 1, events: [approval(), approval({ seq: 3 })] })).toBe(false);
  });

  it("never approves none, and never demotes to full", () => {
    expect(valid({ schemaVersion: 1, events: [approval({ level: "none" })] })).toBe(false);
    expect(valid({ schemaVersion: 1, events: [approval(), demotion({ level: "full" })] })).toBe(false);
  });

  it("needs corpus cases, named approvers and a hash on every approval", () => {
    expect(valid({ schemaVersion: 1, events: [approval({ corpusCases: [] })] })).toBe(false);
    expect(valid({ schemaVersion: 1, events: [approval({ approvers: [] })] })).toBe(false);
    expect(valid({ schemaVersion: 1, events: [approval({ approvers: [{ role: "someone", name: "x" }] })] })).toBe(false);
    expect(
      valid({ schemaVersion: 1, events: [approval({ approvers: [{ role: "codex", name: "a" }, { role: "codex", name: "b" }] })] }),
    ).toBe(false);
    expect(valid({ schemaVersion: 1, events: [approval({ entryHash: "abc" })] })).toBe(false);
  });

  it("needs a reason on every demotion", () => {
    expect(valid({ schemaVersion: 1, events: [approval(), demotion({ reason: "" })] })).toBe(false);
  });
});

describe("requiredApprovers", () => {
  it("full needs Fabien; fail_only needs the orchestrator and Codex", () => {
    const e = CoverageEntrySchema.parse(entry116());
    expect(requiredApprovers(e, "full")).toEqual(["fabien"]);
    expect(requiredApprovers(e, "fail_only")).toEqual(["orchestrator", "codex"]);
  });

  it("an entry with a failure link needs the orchestrator and Codex at full too", () => {
    const f = CoverageEntrySchema.parse(entry116Full());
    expect(requiredApprovers(f, "full")).toEqual(["fabien", "orchestrator", "codex"]);
  });
});
