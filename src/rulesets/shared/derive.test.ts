import { describe, expect, it } from "vitest";
import { entry116, entry116Full, observation, targetInitial, targetState } from "../../../tests/fixtures/schema-fixtures.ts";
import { CoverageEntrySchema, FindingSchema } from "../../schema/index.ts";
import type { CoverageEntry, Level, Observation, Outcome, TargetExecution } from "../../schema/index.ts";
import type { DeriveFindingsInput } from "../contract.ts";
import { deriveFindings } from "./derive.ts";

const ADVISORY = "axe/object-alt"; // partial routes, evidence_only
const FAILURE = "custom/object-image-alternatives"; // resolving, failure
const SECOND = "custom/second-resolver"; // resolving, evidence_only
const ROUTES = ["text-alternative-and-role", "adjacent-link", "replace-mechanism"];

/** Entry 1.1.6 at full, structural, with an optional second resolving link and a second requirement. */
function entry(opts: { second?: boolean; twoRequirements?: boolean; edit?: (e: Record<string, any>) => void } = {}): CoverageEntry {
  const e = entry116Full();
  e.enabled = "full";
  if (opts.second) {
    e.links.push({ check: SECOND, requirement: "object-alternative", routes: ROUTES, scope: "whole", faultMeans: "evidence_only" });
  }
  if (opts.twoRequirements) {
    const r = structuredClone(e.requirements[0]);
    r.id = "other";
    r.routes = r.routes.map((x: Record<string, unknown>) => ({ ...x, id: `other-${String(x.id)}` }));
    e.requirements.push(r);
    e.links.push({ check: "custom/other", requirement: "other", routes: r.routes.map((x: { id: string }) => x.id), scope: "whole", faultMeans: "failure" });
  }
  opts.edit?.(e);
  return CoverageEntrySchema.parse(e);
}

let n = 0;
function obs(checkId: string, outcome: Outcome, over: Record<string, unknown> = {}): Observation {
  n += 1;
  const evidence =
    outcome === "fault"
      ? [{ id: "ev", kind: "dom_node", locator: "object" }]
      : outcome === "no_fault" || outcome === "inapplicable"
        ? [{ id: "ev", kind: "scope_examined" }]
        : [];
  return observation({
    id: `obs-${String(n).padStart(3, "0")}`,
    checkId,
    outcome,
    evidence,
    ...(outcome === "error" ? { error: { kind: "check_error", message: "timeout" } } : {}),
    ...over,
  }) as Observation;
}

function run(e: CoverageEntry, observations: Observation[], opts: { level?: Level; target?: TargetExecution } = {}) {
  const input: DeriveFindingsInput = {
    ruleset: "rgaa-4.1.2",
    target: opts.target ?? (targetInitial() as TargetExecution),
    observations,
    entries: [{ entry: e, level: opts.level ?? "full" }],
  };
  const r = deriveFindings(input);
  if (!r.ok) throw new Error(JSON.stringify(r.rejections));
  const f = r.findings[0];
  if (f === undefined) throw new Error("no finding");
  expect(FindingSchema.safeParse(f).success).toBe(true);
  return f;
}

describe("deriveFindings: the cases of spec 8.3", () => {
  it("advisory fault, resolving cannot_tell: alternative_unresolved, fault kept as evidence", () => {
    const adv = obs(ADVISORY, "fault");
    const f = run(entry(), [adv, obs(FAILURE, "cannot_tell")]);
    expect(f).toMatchObject({ status: "needs_review", reason: "alternative_unresolved", complete: true });
    expect(f.observations).toContain(adv.id);
  });

  // A valid entry without a resolving link cannot be candidate full, so this case only runs below full.
  it("advisory fault, no resolving check: unresolved, needs_review below full", () => {
    const e = entry({ edit: (x) => { x.links = x.links.slice(0, 1); x.candidate = "none"; x.enabled = "none"; } });
    const f = run(e, [obs(ADVISORY, "fault")], { level: "none" });
    expect(f).toMatchObject({ status: "needs_review", reason: "not_enabled" });
    expect(run(e, [obs(ADVISORY, "fault")], { level: "none" }).requirementFacts).toEqual({ "object-alternative": ["unresolved"] });
  });

  it("advisory fault, resolving no_fault: passed", () => {
    const adv = obs(ADVISORY, "fault");
    const f = run(entry(), [adv, obs(FAILURE, "no_fault")]);
    expect(f).toMatchObject({ status: "passed", requirementFacts: { "object-alternative": ["satisfied"] } });
    expect(f.reason).toBeUndefined();
    expect(f.observations).toContain(adv.id);
  });

  it("resolving failure fault: failed", () => {
    expect(run(entry(), [obs(ADVISORY, "no_fault"), obs(FAILURE, "fault")])).toMatchObject({
      status: "failed",
      requirementFacts: { "object-alternative": ["violation"] },
    });
  });

  it("failure fault and resolving no_fault: checks_disagree", () => {
    const f = run(entry({ second: true }), [obs(ADVISORY, "no_fault"), obs(FAILURE, "fault"), obs(SECOND, "no_fault")]);
    expect(f).toMatchObject({ status: "needs_review", reason: "checks_disagree", requirementFacts: { "object-alternative": ["dispute"] } });
  });

  it("the same dispute plus a missing check on the requirement: not_tested, dispute recorded", () => {
    const f = run(entry({ second: true }), [obs(FAILURE, "fault"), obs(SECOND, "no_fault")]);
    expect(f).toMatchObject({
      status: "not_tested",
      reason: "missing_observation",
      complete: false,
      notRun: [ADVISORY],
      requirementFacts: { "object-alternative": ["error", "dispute"] },
    });
  });

  it("the same dispute with the error on another requirement: not_tested", () => {
    const f = run(entry({ second: true, twoRequirements: true }), [
      obs(ADVISORY, "no_fault"),
      obs(FAILURE, "fault"),
      obs(SECOND, "no_fault"),
      obs("custom/other", "error"),
    ]);
    expect(f).toMatchObject({ status: "not_tested", reason: "check_error", notRun: ["custom/other"] });
    expect(f.requirementFacts).toEqual({ "object-alternative": ["dispute"], other: ["error"] });
  });

  it("resolving no_fault and resolving inapplicable: checks_disagree", () => {
    const f = run(entry({ second: true }), [obs(ADVISORY, "no_fault"), obs(FAILURE, "no_fault"), obs(SECOND, "inapplicable")]);
    expect(f).toMatchObject({ status: "needs_review", reason: "checks_disagree" });
  });

  it("undisputed failure fault plus another check's error: failed, incomplete", () => {
    const f = run(entry(), [obs(ADVISORY, "error"), obs(FAILURE, "fault")]);
    expect(f).toMatchObject({ status: "failed", complete: false, notRun: [ADVISORY] });
    expect(f.requirementFacts).toEqual({ "object-alternative": ["error", "violation"] });
  });

  it("advisory fault, resolving inapplicable: not_applicable when structural", () => {
    const adv = obs(ADVISORY, "fault");
    const f = run(entry(), [adv, obs(FAILURE, "inapplicable")]);
    expect(f).toMatchObject({ status: "not_applicable", requirementFacts: { "object-alternative": ["inapplicable"] } });
    expect(f.observations).toContain(adv.id);
    const j = run(entry({ edit: (x) => (x.applicability = "judgment") }), [adv, obs(FAILURE, "inapplicable")]);
    expect(j).toMatchObject({ status: "needs_review", reason: "judgment_required" });
  });

  it("every requirement inapplicable on an always entry: needs_review, cannot_tell", () => {
    const adv = obs(ADVISORY, "fault");
    const f = run(entry({ edit: (x) => (x.applicability = "always") }), [adv, obs(FAILURE, "inapplicable")]);
    expect(f).toMatchObject({ status: "needs_review", reason: "cannot_tell", requirementFacts: { "object-alternative": ["inapplicable"] } });
    expect(f.observations).toContain(adv.id);
  });

  it("one satisfied and one inapplicable requirement on an always entry: needs_review, cannot_tell (Q43)", () => {
    const mixed = () => [obs(ADVISORY, "no_fault"), obs(FAILURE, "no_fault"), obs("custom/other", "inapplicable")];
    const f = run(entry({ twoRequirements: true, edit: (x) => (x.applicability = "always") }), mixed());
    expect(f).toMatchObject({ status: "needs_review", reason: "cannot_tell" });
    expect(f.requirementFacts).toEqual({ "object-alternative": ["satisfied"], other: ["inapplicable"] });
    expect(run(entry({ twoRequirements: true }), mixed()).status).toBe("passed");
    const j = run(entry({ twoRequirements: true, edit: (x) => (x.applicability = "judgment") }), mixed());
    expect(j.status).toBe("passed");
    expect(j.reason).toBeUndefined();
  });

  it("a violation beside an inapplicable requirement on an always entry: still failed", () => {
    const f = run(entry({ twoRequirements: true, edit: (x) => (x.applicability = "always") }), [
      obs(ADVISORY, "no_fault"),
      obs(FAILURE, "fault"),
      obs("custom/other", "inapplicable"),
    ]);
    expect(f).toMatchObject({ status: "failed", requirementFacts: { "object-alternative": ["violation"], other: ["inapplicable"] } });
    expect(f.reason).toBeUndefined();
  });

  it("an advisory inapplicable alone on an always entry changes nothing: passed", () => {
    const f = run(entry({ edit: (x) => (x.applicability = "always") }), [obs(ADVISORY, "inapplicable"), obs(FAILURE, "no_fault")]);
    expect(f).toMatchObject({ status: "passed", requirementFacts: { "object-alternative": ["satisfied"] } });
  });

  it("an always entry still passes on a resolving no_fault", () => {
    const f = run(entry({ edit: (x) => (x.applicability = "always") }), [obs(ADVISORY, "no_fault"), obs(FAILURE, "no_fault")]);
    expect(f.status).toBe("passed");
  });
});

describe("deriveFindings: levels, reasons and targets", () => {
  it("a violation at none is not failed", () => {
    expect(run(entry(), [obs(ADVISORY, "no_fault"), obs(FAILURE, "fault")], { level: "none" })).toMatchObject({
      status: "needs_review",
      reason: "not_enabled",
    });
    expect(run(entry(), [obs(ADVISORY, "no_fault"), obs(FAILURE, "fault")], { level: "fail_only" }).status).toBe("failed");
  });

  it("fail_only never passes", () => {
    expect(run(entry(), [obs(ADVISORY, "no_fault"), obs(FAILURE, "no_fault")], { level: "fail_only" })).toMatchObject({
      status: "needs_review",
      reason: "not_enabled",
    });
  });

  it("not_tested reasons: missing, then scope_unreadable, then check_error", () => {
    const unreadable = obs(FAILURE, "error", { error: { kind: "scope_unreadable", message: "frame" } });
    expect(run(entry(), [unreadable]).reason).toBe("missing_observation");
    expect(run(entry(), [unreadable, obs(ADVISORY, "error")]).reason).toBe("scope_unreadable");
    expect(run(entry(), [obs(FAILURE, "error"), obs(ADVISORY, "no_fault")]).reason).toBe("check_error");
  });

  it("needs_review precedence: assistive_tech, no_check, not_enabled, prerequisite, dispute", () => {
    const at = entry({ edit: (x) => (x.needs = ["assistive_tech"]) });
    expect(run(at, [], { level: "none" }).reason).toBe("missing_observation");
    expect(run(at, [obs(ADVISORY, "no_fault"), obs(FAILURE, "no_fault")]).reason).toBe("assistive_tech_required");
    const none = CoverageEntrySchema.parse({ ...entry116(), links: [] });
    expect(run(none, [], { level: "none" })).toMatchObject({ status: "needs_review", reason: "no_check", complete: true, notRun: [] });
    const state = entry({ edit: (x) => (x.needs = ["state"]) });
    const ok = [obs(ADVISORY, "no_fault"), obs(FAILURE, "no_fault")];
    expect(run(state, ok).reason).toBe("prerequisite_unmet");
    const onState = (targetState() as TargetExecution);
    expect(run(state, ok.map((o) => ({ ...o, targetId: onState.targetId })), { target: onState }).status).toBe("passed");
  });

  it("unresolved with a resolving cannot_tell and no fault gives cannot_tell", () => {
    expect(run(entry(), [obs(ADVISORY, "no_fault"), obs(FAILURE, "cannot_tell")]).reason).toBe("cannot_tell");
  });

  it("a resolving evidence_only fault is unresolved", () => {
    const f = run(entry({ second: true }), [obs(ADVISORY, "no_fault"), obs(FAILURE, "no_fault"), obs(SECOND, "fault")]);
    expect(f).toMatchObject({ status: "needs_review", reason: "alternative_unresolved" });
    expect(f.requirementFacts).toEqual({ "object-alternative": ["unresolved"] });
  });

  it("a target that was not established", () => {
    const t = targetState();
    t.established = false;
    t.steps = [{ action: "click", ok: false, error: "not found" }];
    t.expect = { declared: true, metBeforeSteps: false, met: null };
    t.prerequisitesMet = [];
    const f = run(entry(), [], { target: t as TargetExecution });
    expect(f).toEqual({
      ruleset: "rgaa-4.1.2",
      test: "1.1.6",
      targetId: "home/menu-open",
      status: "not_tested",
      reason: "target_not_established",
      complete: false,
      notRun: [ADVISORY, FAILURE],
      requirementFacts: {},
      observations: [],
    });
    t.expect = { declared: true, metBeforeSteps: true, met: null };
    expect(run(entry(), [], { target: t as TargetExecution }).reason).toBe("expect_already_met");
  });

  it("ignores observations of unlinked checks and sorts findings by test", () => {
    const a = entry();
    const b = CoverageEntrySchema.parse({ ...entry116Full(), test: "1.10.1" });
    const c = CoverageEntrySchema.parse({ ...entry116Full(), test: "1.2.1" });
    const r = deriveFindings({
      ruleset: "rgaa-4.1.2",
      target: targetInitial() as TargetExecution,
      observations: [obs(ADVISORY, "no_fault"), obs(FAILURE, "no_fault"), obs("axe/unlinked", "fault")],
      entries: [{ entry: b, level: "none" }, { entry: a, level: "full" }, { entry: c, level: "none" }],
    });
    expect(r.ok && r.findings.map((f) => f.test)).toEqual(["1.1.6", "1.2.1", "1.10.1"]);
    expect(r.ok && r.findings[0]?.observations.length).toBe(2);
  });
});

describe("deriveFindings: validation", () => {
  it("lists every problem in order and derives nothing", () => {
    const bad = targetInitial();
    bad.prerequisitesMet = ["assistive_tech"];
    const e = entry();
    const r = deriveFindings({
      ruleset: "rgaa-4.1.2",
      target: bad as TargetExecution,
      observations: [
        obs(ADVISORY, "no_fault", { id: "o1" }),
        obs(ADVISORY, "no_fault", { id: "o1" }),
        obs(FAILURE, "no_fault", { targetId: "other/initial" }),
        { ...obs(FAILURE, "fault"), evidence: [] },
      ],
      entries: [
        { entry: e, level: "full" },
        { entry: { ...e, requirements: [] } as unknown as CoverageEntry, level: "none" },
        { entry: CoverageEntrySchema.parse({ ...entry116Full(), enabled: "fail_only" }), level: "full" },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejections.map((x) => x.code)).toEqual([
      "target_invalid",
      "entry_invalid",
      "duplicate_entry",
      "level_above_enabled",
      "duplicate_observation",
      "duplicate_observation_id",
      "observation_other_target",
      "observation_invalid",
      "duplicate_observation",
    ]);
    expect(r.rejections[3]).toEqual({ code: "level_above_enabled", test: "1.1.6", level: "full", enabled: "fail_only" });
    expect(r.rejections[6]).toMatchObject({ code: "observation_other_target", targetId: "other/initial" });
  });

  it("observations on a target that was not established", () => {
    const t = targetInitial();
    t.established = false;
    const r = deriveFindings({ ruleset: "x", target: t as TargetExecution, observations: [obs(ADVISORY, "no_fault")], entries: [] });
    expect(r).toEqual({ ok: false, rejections: [{ code: "observations_on_unestablished_target", count: 1 }] });
  });
});
