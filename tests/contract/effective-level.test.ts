/**
 * Contract tests for `effectiveLevel` (spec 6.3, decisions Q32, Q36).
 *
 * The approval log, the evaluation summary and the check versions are built
 * through their schemas. Approver roles are written out (`ROLES`), not read
 * from `requiredApprovers`, so a wrong role rule there would show here too.
 */
import { describe, expect, it } from "vitest";
import { effectiveLevel } from "../../src/rulesets/shared/index.ts";
import { CoverageEntrySchema, EffectiveLevelRecordSchema } from "../../src/schema/index.ts";
import type { ApprovalLog, CoverageEntry, EffectiveLevelRecord, EvaluationSummary } from "../../src/schema/index.ts";
import { ROLES, approve, demote, entry, log, measurement, rawEntry, summary, versionsOf } from "./helpers.ts";
import type { EntrySpec } from "./helpers.ts";

function run(
  e: CoverageEntry,
  approvals: ApprovalLog,
  evaluation: EvaluationSummary | null = summary(measurement(e)),
  checkVersions: Record<string, string> = versionsOf(e),
): EffectiveLevelRecord {
  const r = effectiveLevel({ entry: e, approvals, evaluation, checkVersions });
  EffectiveLevelRecordSchema.parse(r);
  return r;
}

/** A full entry with no `failure` link: `full` needs `fabien` only. Needs keyboard, as in 6.3. */
const KB: EntrySpec = { needs: ["keyboard"], links: [{ check: "custom/res", kind: "resolving" }] };
/** A full entry with a `failure` link: `full` needs all three roles. */
const FL: EntrySpec = { links: [{ check: "custom/res", kind: "resolving_failure" }] };

/** The entry of `spec`, edited by `edit` on its plain form, then parsed. */
function edited(spec: EntrySpec, edit: (raw: Record<string, any>) => void): CoverageEntry {
  const raw = rawEntry(spec);
  edit(raw);
  return CoverageEntrySchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Approval covers content, not a level
// ---------------------------------------------------------------------------

describe("approval covers content (6.3, Q36)", () => {
  it("an approved, measured full entry runs at full", () => {
    const e = entry(KB);
    expect(run(e, log(approve(e, "full", ROLES.fabien)))).toEqual({
      test: "1.1.1",
      enabled: "full",
      authorised: "full",
      effective: "full",
      blockedBy: null,
    });
  });

  it("6.3 contract test: a full entry approved with needs [keyboard]; removing keyboard makes it run as none until approved again", () => {
    const approved = entry(KB);
    const changed = entry({ ...KB, needs: [] });
    const approvals = log(approve(approved, "full", ROLES.fabien));
    // Even a measurement of the changed content does not stand in for an approval.
    expect(run(changed, approvals, summary(measurement(changed)))).toEqual({
      test: "1.1.1",
      enabled: "full",
      authorised: "none",
      effective: "none",
      blockedBy: "approved_content_differs",
    });
    const reapproved = log(approve(approved, "full", ROLES.fabien), approve(changed, "full", ROLES.fabien));
    expect(run(changed, reapproved, summary(measurement(changed)))).toMatchObject({ effective: "full", blockedBy: null });
  });

  const edits: [string, EntrySpec, (raw: Record<string, any>) => void][] = [
    ["a requirement's wording", KB, (r) => (r.requirements[0].statement = "Requirement r1, reworded.")],
    ["a route's wording", KB, (r) => (r.requirements[0].routes[1].statement = "Route b, reworded.")],
    ["a link demoted from failure to evidence_only", FL, (r) => (r.links[0].faultMeans = "evidence_only")],
    ["the rationale", KB, (r) => (r.rationale.text = "Why, said differently.")],
    ["a citation in the rationale", KB, (r) => (r.rationale.citations[0].quote = "another citation")],
    ["applicability", KB, (r) => (r.applicability = "judgment")],
    ["a prerequisite added", KB, (r) => r.needs.push("media")],
  ];

  for (const [what, spec, edit] of edits) {
    it(`editing ${what} on an approved entry makes it run as none`, () => {
      const before = entry(spec);
      const after = edited(spec, edit);
      const r = run(after, log(approve(before, "full", ROLES.all)), summary(measurement(after)));
      expect(r).toMatchObject({ authorised: "none", effective: "none", blockedBy: "approved_content_differs" });
    });
  }

  it("lowering candidate is an edit too: the entry runs as none", () => {
    const before = entry(FL);
    const after = entry({ ...FL, candidate: "fail_only", enabled: "fail_only" });
    const r = run(after, log(approve(before, "full", ROLES.all), demote(before, "fail_only")), summary(measurement(after)));
    expect(r).toMatchObject({ effective: "none", blockedBy: "approved_content_differs" });
  });

  it("reordering an array is an edit (contract notes: arrays hashed in stored order)", () => {
    const spec: EntrySpec = {
      links: [
        { check: "custom/res", kind: "resolving" },
        { check: "custom/res2", kind: "resolving" },
      ],
    };
    const before = entry(spec);
    const after = edited(spec, (r) => r.links.reverse());
    expect(run(after, log(approve(before, "full", ROLES.fabien)), summary(measurement(after)))).toMatchObject({
      effective: "none",
      blockedBy: "approved_content_differs",
    });
  });
});

// ---------------------------------------------------------------------------
// Lowering, and raising again
// ---------------------------------------------------------------------------

describe("lowering is free with a logged demotion", () => {
  it("full lowered to fail_only, logged: runs at fail_only", () => {
    const full = entry(FL);
    const lowered = entry({ ...FL, candidate: "full", enabled: "fail_only" });
    const r = run(lowered, log(approve(full, "full", ROLES.all), demote(full, "fail_only")), summary(measurement(full)));
    expect(r).toEqual({ test: "1.1.1", enabled: "fail_only", authorised: "fail_only", effective: "fail_only", blockedBy: null });
  });

  it("full lowered to none, logged: runs as none, not_enabled", () => {
    const full = entry(FL);
    const lowered = entry({ ...FL, candidate: "full", enabled: "none" });
    const r = run(lowered, log(approve(full, "full", ROLES.all), demote(full, "none")));
    expect(r).toEqual({ test: "1.1.1", enabled: "none", authorised: "none", effective: "none", blockedBy: "not_enabled" });
  });

  it("an unlogged lowering runs as none (enabled_mismatch)", () => {
    const full = entry(FL);
    const lowered = entry({ ...FL, candidate: "full", enabled: "fail_only" });
    const r = run(lowered, log(approve(full, "full", ROLES.all)), summary(measurement(full)));
    expect(r).toMatchObject({ authorised: "full", effective: "none", blockedBy: "enabled_mismatch" });
  });

  it("the lowest demotion after the approval caps it: a later demotion to a higher level raises nothing", () => {
    const full = entry(FL);
    const atFailOnly = entry({ ...FL, candidate: "full", enabled: "fail_only" });
    const r = run(atFailOnly, log(approve(full, "full", ROLES.all), demote(full, "none"), demote(full, "fail_only")));
    expect(r).toMatchObject({ authorised: "none", effective: "none", blockedBy: "enabled_mismatch" });
  });
});

describe("raising after a demotion needs the approver again", () => {
  it("full → fail_only → full without a new approval: none", () => {
    const e = entry(FL);
    const r = run(e, log(approve(e, "full", ROLES.all), demote(e, "fail_only")));
    expect(r).toEqual({ test: "1.1.1", enabled: "full", authorised: "fail_only", effective: "none", blockedBy: "enabled_mismatch" });
  });

  it("full → none → full without a new approval: none", () => {
    const e = entry(FL);
    const r = run(e, log(approve(e, "full", ROLES.all), demote(e, "none")));
    expect(r).toEqual({ test: "1.1.1", enabled: "full", authorised: "none", effective: "none", blockedBy: "enabled_mismatch" });
  });

  it("an old approval record with the same hash and level never restores the level", () => {
    const e = entry(FL);
    const r = run(e, log(approve(e, "full", ROLES.all), approve(e, "full", ROLES.all), demote(e, "fail_only")));
    expect(r).toMatchObject({ authorised: "fail_only", effective: "none", blockedBy: "enabled_mismatch" });
    const s = run(e, log(approve(e, "full", ROLES.all), demote(e, "none"), demote(e, "none")));
    expect(s).toMatchObject({ authorised: "none", effective: "none" });
  });

  it("a new approval after the demotion does restore it", () => {
    const e = entry(FL);
    expect(run(e, log(approve(e, "full", ROLES.all), demote(e, "fail_only"), approve(e, "full", ROLES.all)))).toMatchObject({
      authorised: "full",
      effective: "full",
      blockedBy: null,
    });
    expect(run(e, log(approve(e, "full", ROLES.all), demote(e, "none"), approve(e, "full", ROLES.all)))).toMatchObject({
      authorised: "full",
      effective: "full",
    });
  });

  it("a new approval at a lower level replaces the old one: the last approval fixes the level", () => {
    const e = entry({ ...FL, candidate: "full", enabled: "fail_only" });
    expect(run(e, log(approve(e, "full", ROLES.all), approve(e, "fail_only", ROLES.pair)))).toMatchObject({
      authorised: "fail_only",
      effective: "fail_only",
    });
  });

  it("events for other tests are ignored", () => {
    const e = entry(FL);
    const other = entry({ ...FL, test: "1.1.2" });
    expect(run(e, log(approve(e, "full", ROLES.all), demote(other, "none"), approve(other, "fail_only", ROLES.pair)))).toMatchObject({
      authorised: "full",
      effective: "full",
    });
    expect(run(e, log(approve(other, "full", ROLES.all)))).toMatchObject({ effective: "none", blockedBy: "no_approval" });
  });
});

// ---------------------------------------------------------------------------
// Approver roles
// ---------------------------------------------------------------------------

describe("approver roles (6.3)", () => {
  it("full, no failure link: fabien is enough; orchestrator and codex are not", () => {
    const e = entry(KB);
    expect(run(e, log(approve(e, "full", ROLES.fabien))).effective).toBe("full");
    expect(run(e, log(approve(e, "full", ROLES.pair)))).toMatchObject({
      authorised: "none",
      effective: "none",
      blockedBy: "approvers_insufficient",
    });
  });

  it("full with a failure link: fabien, orchestrator and codex together", () => {
    const e = entry(FL);
    expect(run(e, log(approve(e, "full", ROLES.all))).effective).toBe("full");
    for (const roles of [ROLES.fabien, ROLES.pair, ["fabien", "codex"] as const, ["fabien", "orchestrator"] as const]) {
      expect(run(e, log(approve(e, "full", [...roles])))).toMatchObject({ effective: "none", blockedBy: "approvers_insufficient" });
    }
  });

  it("fail_only: orchestrator and codex together; fabien alone is not enough", () => {
    const e = entry({ ...FL, candidate: "full", enabled: "fail_only" });
    const m = summary(measurement(e, { level: "fail_only" }));
    expect(run(e, log(approve(e, "fail_only", ROLES.pair)), m)).toMatchObject({ authorised: "fail_only", effective: "fail_only" });
    expect(run(e, log(approve(e, "fail_only", ROLES.all)), m)).toMatchObject({ effective: "fail_only" });
    for (const roles of [ROLES.fabien, ["orchestrator"] as const, ["codex"] as const]) {
      expect(run(e, log(approve(e, "fail_only", [...roles])), m)).toMatchObject({ effective: "none", blockedBy: "approvers_insufficient" });
    }
  });

  it("the roles are judged against the approved level, not the demoted one", () => {
    // Approved at full by fabien alone on an entry with a failure link: never valid,
    // and a demotion to fail_only does not make it valid.
    const e = entry({ ...FL, candidate: "full", enabled: "fail_only" });
    expect(run(e, log(approve(e, "full", ROLES.fabien), demote(e, "fail_only")))).toMatchObject({
      authorised: "none",
      effective: "none",
      blockedBy: "approvers_insufficient",
    });
  });
});

// ---------------------------------------------------------------------------
// Check-version suspension
// ---------------------------------------------------------------------------

describe("check-version suspension (6.3: checks are pinned too)", () => {
  it("a linked check changes version: the entry runs as none", () => {
    const e = entry(KB);
    const r = run(e, log(approve(e, "full", ROLES.fabien)), summary(measurement(e)), { "custom/res": "2.0.0" });
    expect(r).toEqual({ test: "1.1.1", enabled: "full", authorised: "full", effective: "none", blockedBy: "check_version_changed" });
  });

  it("a new measurement passing on the new version restores the authorised level, with no new approval", () => {
    const e = entry(KB);
    const approvals = log(approve(e, "full", ROLES.fabien));
    const r = run(e, approvals, summary(measurement(e, { checkVersions: { "custom/res": "2.0.0" } })), { "custom/res": "2.0.0" });
    expect(r).toMatchObject({ authorised: "full", effective: "full", blockedBy: null });
  });

  it("it never rises above the authorised level, so it never undoes a demotion", () => {
    const full = entry(FL);
    const lowered = entry({ ...FL, candidate: "full", enabled: "fail_only" });
    const approvals = log(approve(full, "full", ROLES.all), demote(full, "fail_only"));
    const newMeasurement = summary(measurement(lowered, { level: "full", checkVersions: { "custom/res": "2.0.0" } }));
    expect(run(lowered, approvals, newMeasurement, { "custom/res": "2.0.0" })).toMatchObject({
      authorised: "fail_only",
      effective: "fail_only",
    });
    // And the entry raised back to full stays at none.
    expect(run(full, approvals, newMeasurement, { "custom/res": "2.0.0" })).toMatchObject({
      effective: "none",
      blockedBy: "enabled_mismatch",
    });
  });

  it("it never applies to edited content", () => {
    const approved = entry(KB);
    const changed = entry({ ...KB, needs: [] });
    const r = run(changed, log(approve(approved, "full", ROLES.fabien)), summary(measurement(changed, { checkVersions: { "custom/res": "2.0.0" } })), {
      "custom/res": "2.0.0",
    });
    expect(r).toMatchObject({ effective: "none", blockedBy: "approved_content_differs" });
  });

  it("a measurement that lacks a linked check's version: check_version_changed", () => {
    const e = entry({
      links: [
        { check: "custom/res", kind: "resolving" },
        { check: "custom/res2", kind: "resolving" },
      ],
    });
    const r = run(e, log(approve(e, "full", ROLES.fabien)), summary(measurement(e, { checkVersions: { "custom/res": "1.0.0" } })));
    expect(r).toMatchObject({ effective: "none", blockedBy: "check_version_changed" });
  });

  it("versions of checks the entry does not link do not matter", () => {
    const e = entry(KB);
    const r = run(e, log(approve(e, "full", ROLES.fabien)), summary(measurement(e, { checkVersions: { "custom/res": "1.0.0", "axe/other": "3" } })), {
      "custom/res": "1.0.0",
      "axe/other": "4",
    });
    expect(r).toMatchObject({ effective: "full", blockedBy: null });
  });
});

// ---------------------------------------------------------------------------
// Each blockedBy code, and their order
// ---------------------------------------------------------------------------

describe("blockedBy: each code", () => {
  it("not_enabled", () => {
    const e = entry({ ...KB, candidate: "full", enabled: "none" });
    expect(run(e, log(approve(e, "full", ROLES.fabien)))).toEqual({
      test: "1.1.1",
      enabled: "none",
      authorised: "full",
      effective: "none",
      blockedBy: "not_enabled",
    });
  });

  it("no_approval", () => {
    const e = entry(KB);
    expect(run(e, log())).toEqual({ test: "1.1.1", enabled: "full", authorised: "none", effective: "none", blockedBy: "no_approval" });
  });

  it("no_approval: a demotion alone is not an approval", () => {
    const e = entry({ ...KB, enabled: "fail_only", candidate: "full" });
    expect(run(e, log(demote(e, "fail_only")))).toMatchObject({ effective: "none", blockedBy: "no_approval" });
  });

  it("not_measured: no evaluation summary", () => {
    const e = entry(KB);
    expect(run(e, log(approve(e, "full", ROLES.fabien)), null)).toMatchObject({ authorised: "full", effective: "none", blockedBy: "not_measured" });
  });

  it("not_measured: no measurement for this test", () => {
    const e = entry(KB);
    const other = entry({ ...KB, test: "1.1.2" });
    expect(run(e, log(approve(e, "full", ROLES.fabien)), summary(measurement(other)))).toMatchObject({ blockedBy: "not_measured" });
  });

  it("not_measured: the measurement is of other content", () => {
    const old = entry(KB);
    const current = entry({ ...KB, needs: [] });
    expect(run(current, log(approve(current, "full", ROLES.fabien)), summary(measurement(old)))).toMatchObject({
      effective: "none",
      blockedBy: "not_measured",
    });
  });

  it("not_measured: measured below the authorised level", () => {
    const e = entry(FL);
    expect(run(e, log(approve(e, "full", ROLES.all)), summary(measurement(e, { level: "fail_only" })))).toMatchObject({
      authorised: "full",
      effective: "none",
      blockedBy: "not_measured",
    });
  });

  it("a measurement above the authorised level is enough", () => {
    const e = entry({ ...FL, candidate: "full", enabled: "fail_only" });
    expect(run(e, log(approve(e, "fail_only", ROLES.pair)), summary(measurement(e, { level: "full" })))).toMatchObject({
      effective: "fail_only",
    });
  });

  it("check_version_unknown: a linked check has no current version", () => {
    const e = entry(KB);
    expect(run(e, log(approve(e, "full", ROLES.fabien)), summary(measurement(e)), {})).toMatchObject({
      authorised: "full",
      effective: "none",
      blockedBy: "check_version_unknown",
    });
  });

  it("corpus_cases_failing: a case did not match", () => {
    const e = entry(KB);
    expect(run(e, log(approve(e, "full", ROLES.fabien)), summary(measurement(e, { cases: [true, false] })))).toMatchObject({
      authorised: "full",
      effective: "none",
      blockedBy: "corpus_cases_failing",
    });
  });

  it("corpus_cases_failing: the measurement has no case", () => {
    const e = entry(KB);
    expect(run(e, log(approve(e, "full", ROLES.fabien)), summary(measurement(e, { cases: [] })))).toMatchObject({
      blockedBy: "corpus_cases_failing",
    });
  });
});

describe("blockedBy: the first rule that applies wins", () => {
  const two: EntrySpec = {
    links: [
      { check: "custom/res", kind: "resolving" },
      { check: "custom/res2", kind: "resolving" },
    ],
  };

  it("not_enabled before no_approval", () => {
    const e = entry({ ...KB, candidate: "full", enabled: "none" });
    expect(run(e, log(), null, {})).toMatchObject({ authorised: "none", blockedBy: "not_enabled" });
  });

  it("not_enabled before approved_content_differs", () => {
    const approved = entry(KB);
    const changed = entry({ ...KB, needs: [], candidate: "full", enabled: "none" });
    expect(run(changed, log(approve(approved, "full", ROLES.fabien)))).toMatchObject({ authorised: "none", blockedBy: "not_enabled" });
  });

  it("no_approval before not_measured", () => {
    const e = entry(KB);
    expect(run(e, log(), null, {})).toMatchObject({ blockedBy: "no_approval" });
  });

  it("approved_content_differs before approvers_insufficient", () => {
    const approved = entry(KB);
    const changed = entry({ ...KB, needs: [] });
    expect(run(changed, log(approve(approved, "full", ROLES.pair)))).toMatchObject({ blockedBy: "approved_content_differs" });
  });

  it("approvers_insufficient before enabled_mismatch", () => {
    const e = entry(FL);
    expect(run(e, log(approve(e, "fail_only", ["orchestrator"])))).toMatchObject({ authorised: "none", blockedBy: "approvers_insufficient" });
  });

  it("enabled_mismatch before not_measured", () => {
    const e = entry(FL);
    expect(run(e, log(approve(e, "fail_only", ROLES.pair)), null)).toMatchObject({ authorised: "fail_only", blockedBy: "enabled_mismatch" });
  });

  it("not_measured before check_version_unknown", () => {
    const e = entry(KB);
    expect(run(e, log(approve(e, "full", ROLES.fabien)), null, {})).toMatchObject({ blockedBy: "not_measured" });
  });

  it("check_version_unknown before check_version_changed", () => {
    const e = entry(two);
    expect(run(e, log(approve(e, "full", ROLES.fabien)), summary(measurement(e)), { "custom/res": "2.0.0" })).toMatchObject({
      blockedBy: "check_version_unknown",
    });
  });

  it("check_version_changed before corpus_cases_failing", () => {
    const e = entry(KB);
    expect(run(e, log(approve(e, "full", ROLES.fabien)), summary(measurement(e, { cases: [false] })), { "custom/res": "2.0.0" })).toMatchObject({
      blockedBy: "check_version_changed",
    });
  });
});
