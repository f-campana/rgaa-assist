import { describe, expect, it } from "vitest";
import { entry116Full } from "../../../tests/fixtures/schema-fixtures.ts";
import { CoverageEntrySchema, EffectiveLevelRecordSchema, entryHash } from "../../schema/index.ts";
import type { ApprovalLog, ApprovalLogEvent, CoverageEntry, EvaluationSummary, Level } from "../../schema/index.ts";
import { effectiveLevel } from "./effective-level.ts";

const SHA = "0".repeat(64);
const AT = "2026-11-16T10:00:00Z";
const ALL_ROLES = [
  { role: "fabien", name: "Fabien" },
  { role: "orchestrator", name: "Fable 5.2" },
  { role: "codex", name: "Codex" },
] as const;

function entry(enabled: Level = "full", edit?: (e: Record<string, any>) => void): CoverageEntry {
  const e = entry116Full();
  e.enabled = enabled;
  edit?.(e);
  return CoverageEntrySchema.parse(e);
}

type Ev = { kind: "approval"; level: "full" | "fail_only"; hash?: string; roles?: readonly string[]; test?: string } | { kind: "demotion"; level: "none" | "fail_only"; test?: string };

function log(e: CoverageEntry, ...evs: Ev[]): ApprovalLog {
  const events: ApprovalLogEvent[] = evs.map((ev, i) =>
    ev.kind === "approval"
      ? {
          seq: i + 1,
          kind: "approval",
          test: ev.test ?? e.test,
          entryHash: ev.hash ?? entryHash(e),
          level: ev.level,
          approvers: ALL_ROLES.filter((r) => (ev.roles ?? ["fabien", "orchestrator", "codex"]).includes(r.role)).map((r) => ({ ...r })),
          corpusCases: ["case-1"],
          evaluationSummaryHash: SHA,
          at: AT,
        }
      : { seq: i + 1, kind: "demotion", test: ev.test ?? e.test, level: ev.level, reason: "regression", by: "Codex", at: AT },
  );
  return { schemaVersion: 1, events };
}

function evaluation(e: CoverageEntry, over: Record<string, unknown> = {}): EvaluationSummary {
  return {
    entries: [
      {
        test: e.test,
        entryHash: entryHash(e),
        level: "full",
        checkVersions: { "axe/object-alt": "4.14.0", "custom/object-image-alternatives": "1" },
        cases: [{ case: "case-1", matched: true }],
        ...over,
      },
    ],
  } as unknown as EvaluationSummary;
}

const VERSIONS = { "axe/object-alt": "4.14.0", "custom/object-image-alternatives": "1" };

function run(e: CoverageEntry, approvals: ApprovalLog, ev: EvaluationSummary | null = evaluation(e), versions: Record<string, string> = VERSIONS) {
  const r = effectiveLevel({ entry: e, approvals, evaluation: ev, checkVersions: versions });
  expect(EffectiveLevelRecordSchema.safeParse(r).success).toBe(true);
  return r;
}

describe("effectiveLevel", () => {
  it("runs at the authorised level when everything holds", () => {
    const e = entry();
    expect(run(e, log(e, { kind: "approval", level: "full" }))).toEqual({
      test: "1.1.6",
      enabled: "full",
      authorised: "full",
      effective: "full",
      blockedBy: null,
    });
  });

  it("not_enabled first, while still reporting the authorised level", () => {
    const e = entry("none");
    expect(run(e, log(e, { kind: "approval", level: "full" }))).toMatchObject({ authorised: "full", effective: "none", blockedBy: "not_enabled" });
  });

  it("no_approval, ignoring other tests' events", () => {
    const e = entry();
    expect(run(e, log(e, { kind: "approval", level: "full", test: "1.1.1" })).blockedBy).toBe("no_approval");
  });

  it("approved_content_differs after an edit", () => {
    const approved = entry();
    const edited = entry("full", (x) => (x.needs = ["keyboard"]));
    expect(run(edited, log(approved, { kind: "approval", level: "full" }))).toMatchObject({ authorised: "none", blockedBy: "approved_content_differs" });
  });

  it("approvers_insufficient: an entry with a failure link needs orchestrator and codex at full", () => {
    const e = entry();
    expect(run(e, log(e, { kind: "approval", level: "full", roles: ["fabien"] })).blockedBy).toBe("approvers_insufficient");
  });

  it("demotions after the last approval cap it; those before do not count", () => {
    const e = entry("fail_only");
    expect(run(e, log(e, { kind: "approval", level: "full" }, { kind: "demotion", level: "fail_only" }), evaluation(e))).toMatchObject({
      authorised: "fail_only",
      effective: "fail_only",
    });
    const f = entry();
    expect(run(f, log(f, { kind: "demotion", level: "none" }, { kind: "approval", level: "full" })).effective).toBe("full");
  });

  it("after a demotion only a new approval raises the level again", () => {
    const e = entry();
    const r = run(e, log(e, { kind: "approval", level: "full" }, { kind: "demotion", level: "fail_only" }));
    expect(r).toMatchObject({ authorised: "fail_only", blockedBy: "enabled_mismatch" });
  });

  it("enabled_mismatch on an unlogged lowering", () => {
    const e = entry("fail_only");
    expect(run(e, log(e, { kind: "approval", level: "full" })).blockedBy).toBe("enabled_mismatch");
  });

  it("not_measured", () => {
    const e = entry();
    const l = log(e, { kind: "approval", level: "full" });
    expect(run(e, l, null).blockedBy).toBe("not_measured");
    expect(run(e, l, evaluation(e, { entryHash: SHA })).blockedBy).toBe("not_measured");
    expect(run(e, l, evaluation(e, { level: "fail_only" })).blockedBy).toBe("not_measured");
    expect(run(e, l, evaluation(e, { test: "1.1.1" })).blockedBy).toBe("not_measured");
  });

  it("check versions, then corpus cases", () => {
    const e = entry();
    const l = log(e, { kind: "approval", level: "full" });
    expect(run(e, l, evaluation(e), { "axe/object-alt": "4.14.0" }).blockedBy).toBe("check_version_unknown");
    expect(run(e, l, evaluation(e), { ...VERSIONS, "axe/object-alt": "4.15.0" }).blockedBy).toBe("check_version_changed");
    expect(run(e, l, evaluation(e, { checkVersions: { "axe/object-alt": "4.14.0" } })).blockedBy).toBe("check_version_changed");
    expect(run(e, l, evaluation(e, { cases: [] })).blockedBy).toBe("corpus_cases_failing");
    expect(run(e, l, evaluation(e, { cases: [{ case: "a", matched: true }, { case: "b", matched: false }] })).blockedBy).toBe("corpus_cases_failing");
  });
});
