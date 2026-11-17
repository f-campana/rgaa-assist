/**
 * Contract tests for `deriveFindings` (spec 8.2, 8.3, 8.5).
 *
 * Unless a test says otherwise: an established `initial` target, an entry
 * enabled and run at `full`, `structural`, no prerequisite, one requirement
 * `r1`. Check ids name their role: `custom/res*` resolving, `custom/fail`
 * a `failure` link that is not resolving, `axe/adv` advisory.
 */
import { describe, expect, it } from "vitest";
import { deriveFindings } from "../../src/rulesets/shared/index.ts";
import type { Level, Observation, Outcome, Status } from "../../src/schema/index.ts";
import { CoverageEntrySchema } from "../../src/schema/index.ts";
import type { LinkSpec } from "./helpers.ts";
import {
  RULESET,
  T_INITIAL,
  T_STATE,
  derive1,
  deriveRaw,
  entry,
  obs,
  rawEntry,
  rawObservation,
  rawTarget,
  target,
  unestablished,
} from "./helpers.ts";

const LEVELS: Level[] = ["none", "fail_only", "full"];

/** Resolving link plus advisory link on r1. */
const resAdv = () =>
  entry({
    links: [
      { check: "custom/res", kind: "resolving" },
      { check: "axe/adv", kind: "advisory" },
    ],
  });

// ---------------------------------------------------------------------------
// The case table of spec 8.3: one test per row
// ---------------------------------------------------------------------------

describe("8.3 case table", () => {
  it("An advisory fault. The resolving check answers cannot_tell → needs_review, alternative_unresolved, with the fault as evidence", () => {
    const f = derive1(resAdv(), [obs("axe/adv", "fault"), obs("custom/res", "cannot_tell")]);
    expect(f.status).toBe("needs_review");
    expect(f.reason).toBe("alternative_unresolved");
    expect(f.observations).toContain("o:axe/adv");
    expect(f.requirementFacts).toEqual({ r1: ["unresolved"] });
    expect(f.complete).toBe(true);
  });

  it("An advisory fault. No resolving check → cannot be a full entry (6.2), so derivation refuses it; below full it is unresolved", () => {
    // Spec 6.2: a test may be `full` only when every requirement has a
    // resolving link. The first half of the row cannot occur on a full entry.
    const raw = rawEntry({ links: [{ check: "axe/adv", kind: "advisory" }], enabled: "full", candidate: "full" });
    const r = deriveRaw({ target: target(), observations: [obs("axe/adv", "fault")], entries: [{ entry: raw, level: "full" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejections.map((x) => x.code)).toEqual(["entry_invalid"]);
    // At level none the requirement is unresolved and the fault is kept.
    const e = entry({ links: [{ check: "axe/adv", kind: "advisory" }], enabled: "none" });
    const f = derive1(e, [obs("axe/adv", "fault")]);
    expect(f.status).toBe("needs_review");
    expect(f.requirementFacts).toEqual({ r1: ["unresolved"] });
    expect(f.observations).toEqual(["o:axe/adv"]);
  });

  it("An advisory fault. The resolving check reports no_fault → passed, with the advisory fault kept as evidence", () => {
    const f = derive1(resAdv(), [obs("axe/adv", "fault"), obs("custom/res", "no_fault")]);
    expect(f.status).toBe("passed");
    expect(f.reason).toBeUndefined();
    expect(f.observations).toEqual(["o:axe/adv", "o:custom/res"]);
    expect(f.requirementFacts).toEqual({ r1: ["satisfied"] });
  });

  it("The resolving check reports a fault through a failure link → failed", () => {
    const e = entry({ links: [{ check: "custom/res", kind: "resolving_failure" }] });
    const f = derive1(e, [obs("custom/res", "fault")]);
    expect(f.status).toBe("failed");
    expect(f.reason).toBeUndefined();
    expect(f.requirementFacts).toEqual({ r1: ["violation"] });
    expect(f.complete).toBe(true);
  });

  it("A failure fault. A resolving check reports no_fault → needs_review, checks_disagree", () => {
    const e = entry({
      links: [
        { check: "custom/fail", kind: "failure_partial" },
        { check: "custom/res", kind: "resolving" },
      ],
    });
    const f = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "no_fault")]);
    expect(f.status).toBe("needs_review");
    expect(f.reason).toBe("checks_disagree");
    expect(f.requirementFacts).toEqual({ r1: ["dispute"] });
  });

  it("The same two, plus an errored or missing check on the same requirement → not_tested; the dispute stays recorded", () => {
    const e = entry({
      links: [
        { check: "custom/fail", kind: "failure_partial" },
        { check: "custom/res", kind: "resolving" },
        { check: "custom/res2", kind: "resolving" },
      ],
    });
    const errored = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "no_fault"), obs("custom/res2", "error")]);
    expect(errored.status).toBe("not_tested");
    expect(errored.reason).toBe("check_error");
    expect(errored.requirementFacts).toEqual({ r1: ["error", "dispute"] });
    expect(errored.complete).toBe(false);
    expect(errored.notRun).toEqual(["custom/res2"]);

    const missing = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "no_fault")]);
    expect(missing.status).toBe("not_tested");
    expect(missing.reason).toBe("missing_observation");
    expect(missing.requirementFacts).toEqual({ r1: ["error", "dispute"] });
    expect(missing.notRun).toEqual(["custom/res2"]);
  });

  it("The same dispute, with the error on another requirement → not_tested", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/fail", kind: "failure_partial", req: "r1" },
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });
    const f = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "no_fault"), obs("custom/res2", "error")]);
    expect(f.status).toBe("not_tested");
    expect(f.reason).toBe("check_error");
    expect(f.requirementFacts).toEqual({ r1: ["dispute"], r2: ["error"] });
    expect(f.complete).toBe(false);
  });

  it("One resolving check reports no_fault, another reports inapplicable → needs_review, checks_disagree", () => {
    const e = entry({
      links: [
        { check: "custom/res", kind: "resolving" },
        { check: "custom/res2", kind: "resolving" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "no_fault"), obs("custom/res2", "inapplicable")]);
    expect(f.status).toBe("needs_review");
    expect(f.reason).toBe("checks_disagree");
    expect(f.requirementFacts).toEqual({ r1: ["dispute"] });
  });

  it("An undisputed failure fault, plus another check's error → failed, marked incomplete", () => {
    const e = entry({
      links: [
        { check: "custom/res", kind: "resolving_failure" },
        { check: "custom/res2", kind: "resolving" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "fault"), obs("custom/res2", "error")]);
    expect(f.status).toBe("failed");
    expect(f.reason).toBeUndefined();
    expect(f.complete).toBe(false);
    expect(f.notRun).toEqual(["custom/res2"]);
    expect(f.requirementFacts).toEqual({ r1: ["error", "violation"] });
  });

  it("An advisory fault. The resolving check reports inapplicable → not_applicable on a structural entry, with the advisory fault kept", () => {
    const f = derive1(resAdv(), [obs("axe/adv", "fault"), obs("custom/res", "inapplicable")]);
    expect(f.status).toBe("not_applicable");
    expect(f.reason).toBeUndefined();
    expect(f.observations).toContain("o:axe/adv");
    expect(f.requirementFacts).toEqual({ r1: ["inapplicable"] });
  });
});

// ---------------------------------------------------------------------------
// Step 4: each rule in its order
// ---------------------------------------------------------------------------

describe("8.3 step 4: the first rule that applies wins", () => {
  it("rule 1 before rule 2: a violation beside an error on another requirement is failed", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving_failure", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });
    for (const level of ["fail_only", "full"] as const) {
      const f = derive1(e, [obs("custom/res", "fault")], { level });
      expect(f.status).toBe("failed");
      expect(f.complete).toBe(false);
      expect(f.notRun).toEqual(["custom/res2"]);
      expect(f.requirementFacts).toEqual({ r1: ["violation"], r2: ["error"] });
    }
  });

  it("rule 1 before rule 3: a violation beside a dispute on another requirement is failed", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving_failure", req: "r1" },
        { check: "custom/fail", kind: "failure_partial", req: "r2" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "fault"), obs("custom/fail", "fault"), obs("custom/res2", "no_fault")]);
    expect(f.status).toBe("failed");
    expect(f.requirementFacts).toEqual({ r1: ["violation"], r2: ["dispute"] });
  });

  it("rule 1 before rule 3: a violation beside an unresolved requirement is failed", () => {
    const e = entry({
      links: [
        { check: "custom/fail", kind: "failure_partial" },
        { check: "custom/res", kind: "resolving" },
      ],
    });
    const f = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "cannot_tell")]);
    expect(f.status).toBe("failed");
    expect(f.requirementFacts).toEqual({ r1: ["violation", "unresolved"] });
  });

  it("rule 2 before rule 3: an error beside a dispute is not_tested", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r1" },
        { check: "custom/res3", kind: "resolving", req: "r2" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "no_fault"), obs("custom/res2", "inapplicable")]);
    expect(f.status).toBe("not_tested");
    expect(f.reason).toBe("missing_observation");
    expect(f.requirementFacts).toEqual({ r1: ["dispute"], r2: ["error"] });
  });

  it("rule 3: a dispute beside an unresolved requirement gives checks_disagree", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r1" },
        { check: "custom/res3", kind: "resolving", req: "r2" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "no_fault"), obs("custom/res2", "inapplicable"), obs("custom/res3", "cannot_tell")]);
    expect(f.status).toBe("needs_review");
    expect(f.reason).toBe("checks_disagree");
    expect(f.requirementFacts).toEqual({ r1: ["dispute"], r2: ["unresolved"] });
  });

  it("rule 3: a dispute and an unresolved fact on the same requirement give checks_disagree", () => {
    const e = entry({
      links: [
        { check: "custom/fail", kind: "failure_partial" },
        { check: "custom/res", kind: "resolving" },
        { check: "custom/res2", kind: "resolving" },
      ],
    });
    const f = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "no_fault"), obs("custom/res2", "cannot_tell")]);
    expect(f.status).toBe("needs_review");
    expect(f.reason).toBe("checks_disagree");
    expect(f.requirementFacts).toEqual({ r1: ["dispute", "unresolved"] });
  });

  it("rule 3 before rule 4: an unresolved requirement beside an inapplicable one is needs_review", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "inapplicable"), obs("custom/res2", "cannot_tell")]);
    expect(f.status).toBe("needs_review");
    expect(f.reason).toBe("cannot_tell");
    expect(f.requirementFacts).toEqual({ r1: ["inapplicable"], r2: ["unresolved"] });
  });

  it("a dispute is also a failure fault against a resolving inapplicable", () => {
    const e = entry({
      links: [
        { check: "custom/fail", kind: "failure_partial" },
        { check: "custom/res", kind: "resolving" },
      ],
    });
    const f = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "inapplicable")]);
    expect(f.status).toBe("needs_review");
    expect(f.reason).toBe("checks_disagree");
    expect(f.requirementFacts).toEqual({ r1: ["dispute"] });
  });

  it("a resolving evidence_only fault makes the requirement unresolved, never failed", () => {
    const e = entry({ links: [{ check: "custom/res", kind: "resolving" }] });
    const f = derive1(e, [obs("custom/res", "fault")]);
    expect(f.status).toBe("needs_review");
    expect(f.reason).toBe("alternative_unresolved");
    expect(f.requirementFacts).toEqual({ r1: ["unresolved"] });
  });
});

// ---------------------------------------------------------------------------
// Levels (6.1)
// ---------------------------------------------------------------------------

describe("levels: the same observations at none, fail_only and full", () => {
  it("a violation: needs_review (not_enabled) at none, failed at fail_only and full", () => {
    const e = entry({ links: [{ check: "custom/res", kind: "resolving_failure" }] });
    const o = [obs("custom/res", "fault")];
    expect(derive1(e, o, { level: "none" })).toMatchObject({ status: "needs_review", reason: "not_enabled" });
    expect(derive1(e, o, { level: "fail_only" }).status).toBe("failed");
    expect(derive1(e, o, { level: "full" }).status).toBe("failed");
  });

  it("a satisfied requirement: passed only at full", () => {
    const e = entry({ links: [{ check: "custom/res", kind: "resolving_failure" }] });
    const o = [obs("custom/res", "no_fault")];
    expect(derive1(e, o, { level: "none" })).toMatchObject({ status: "needs_review", reason: "not_enabled" });
    expect(derive1(e, o, { level: "fail_only" })).toMatchObject({ status: "needs_review", reason: "not_enabled" });
    expect(derive1(e, o, { level: "full" }).status).toBe("passed");
  });

  it("every requirement inapplicable on a structural entry: not_applicable only at full", () => {
    const e = entry({ links: [{ check: "custom/res", kind: "resolving_failure" }] });
    const o = [obs("custom/res", "inapplicable")];
    expect(derive1(e, o, { level: "none" })).toMatchObject({ status: "needs_review", reason: "not_enabled" });
    expect(derive1(e, o, { level: "fail_only" })).toMatchObject({ status: "needs_review", reason: "not_enabled" });
    expect(derive1(e, o, { level: "full" }).status).toBe("not_applicable");
  });

  it("an error: not_tested at every level, and the facts are the same at every level", () => {
    const e = entry({ links: [{ check: "custom/res", kind: "resolving_failure" }] });
    for (const level of LEVELS) {
      const f = derive1(e, [obs("custom/res", "error")], { level });
      expect(f).toMatchObject({ status: "not_tested", reason: "check_error", complete: false, notRun: ["custom/res"] });
      expect(f.requirementFacts).toEqual({ r1: ["error"] });
    }
  });

  it("a fail_only entry never gives passed or not_applicable, and a none entry never gives a conclusion, whatever the outcomes", () => {
    const e = entry({
      links: [
        { check: "custom/res", kind: "resolving_failure" },
        { check: "custom/res2", kind: "resolving" },
        { check: "axe/adv", kind: "advisory" },
      ],
    });
    const outcomes: (Outcome | null)[] = ["fault", "no_fault", "inapplicable", "cannot_tell", "error", null];
    for (const a of outcomes) {
      for (const b of outcomes) {
        for (const c of outcomes) {
          const o: Observation[] = [];
          if (a) o.push(obs("custom/res", a));
          if (b) o.push(obs("custom/res2", b));
          if (c) o.push(obs("axe/adv", c));
          const failOnly = derive1(e, o, { level: "fail_only" }).status;
          expect(["passed", "not_applicable"]).not.toContain(failOnly);
          const none = derive1(e, o, { level: "none" }).status;
          expect(["needs_review", "not_tested"]).toContain(none);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Several requirements: all must hold
// ---------------------------------------------------------------------------

describe("several requirements", () => {
  const two = (applicability: "structural" | "judgment" = "structural") =>
    entry({
      reqs: ["r1", "r2"],
      applicability,
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });

  it("both satisfied: passed", () => {
    const f = derive1(two(), [obs("custom/res", "no_fault"), obs("custom/res2", "no_fault")]);
    expect(f.status).toBe("passed");
    expect(f.requirementFacts).toEqual({ r1: ["satisfied"], r2: ["satisfied"] });
  });

  it("one satisfied and one unresolved is not passed", () => {
    const f = derive1(two(), [obs("custom/res", "no_fault"), obs("custom/res2", "cannot_tell")]);
    expect(f.status).toBe("needs_review");
    expect(f.reason).toBe("cannot_tell");
    expect(f.requirementFacts).toEqual({ r1: ["satisfied"], r2: ["unresolved"] });
  });

  it("one satisfied and one inapplicable: passed, structural or judgment", () => {
    for (const a of ["structural", "judgment"] as const) {
      const f = derive1(two(a), [obs("custom/res", "no_fault"), obs("custom/res2", "inapplicable")]);
      expect(f.status).toBe("passed");
      expect(f.requirementFacts).toEqual({ r1: ["satisfied"], r2: ["inapplicable"] });
    }
  });

  it("one violated and one satisfied: failed", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving_failure", req: "r2" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "no_fault"), obs("custom/res2", "fault")]);
    expect(f.status).toBe("failed");
    expect(f.requirementFacts).toEqual({ r1: ["satisfied"], r2: ["violation"] });
  });

  it("a check linked to two requirements speaks for each separately", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res", kind: "resolving", req: "r2" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "no_fault")]);
    expect(f.status).toBe("passed");
    expect(f.requirementFacts).toEqual({ r1: ["satisfied"], r2: ["satisfied"] });
    const g = derive1(e, [obs("custom/res", "error")]);
    expect(g.notRun).toEqual(["custom/res"]);
    expect(g.requirementFacts).toEqual({ r1: ["error"], r2: ["error"] });
  });
});

// ---------------------------------------------------------------------------
// Reasons of needs_review and their precedence (doc comment, step 4.3 a-f)
// ---------------------------------------------------------------------------

describe("needs_review reasons", () => {
  it("no_check: an entry with no link", () => {
    const e = entry({ enabled: "none", links: [] });
    const f = derive1(e, []);
    expect(f).toMatchObject({ status: "needs_review", reason: "no_check", complete: true, notRun: [], observations: [] });
    expect(f.requirementFacts).toEqual({ r1: ["unresolved"] });
  });

  it("not_enabled: an entry with links run below full", () => {
    const e = entry({ links: [{ check: "custom/res", kind: "resolving" }] });
    expect(derive1(e, [obs("custom/res", "no_fault")], { level: "none" })).toMatchObject({ status: "needs_review", reason: "not_enabled" });
  });

  it("judgment_required: every requirement inapplicable on a judgment entry", () => {
    const e = entry({ applicability: "judgment", links: [{ check: "custom/res", kind: "resolving" }] });
    const f = derive1(e, [obs("custom/res", "inapplicable")]);
    expect(f).toMatchObject({ status: "needs_review", reason: "judgment_required" });
    expect(f.requirementFacts).toEqual({ r1: ["inapplicable"] });
  });

  it("alternative_unresolved with an advisory fault, cannot_tell without one", () => {
    expect(derive1(resAdv(), [obs("axe/adv", "fault"), obs("custom/res", "cannot_tell")]).reason).toBe("alternative_unresolved");
    expect(derive1(resAdv(), [obs("axe/adv", "no_fault"), obs("custom/res", "cannot_tell")]).reason).toBe("cannot_tell");
  });

  it("prerequisite_unmet: a prerequisite in needs is not met on this target", () => {
    const e = entry({ needs: ["keyboard"], links: [{ check: "custom/res", kind: "resolving" }] });
    expect(derive1(e, [obs("custom/res", "no_fault")])).toMatchObject({ status: "needs_review", reason: "prerequisite_unmet" });
  });

  it("assistive_tech_required: an entry that needs assistive_tech", () => {
    const e = entry({ needs: ["assistive_tech"], links: [{ check: "custom/res", kind: "resolving" }] });
    expect(derive1(e, [obs("custom/res", "no_fault")])).toMatchObject({ status: "needs_review", reason: "assistive_tech_required" });
  });

  it("model_disabled is never produced: an entry that needs model gets prerequisite_unmet", () => {
    const e = entry({ needs: ["model"], links: [{ check: "custom/res", kind: "resolving" }] });
    const t = target(T_INITIAL, ["model"]);
    const f = derive1(e, [obs("custom/res", "no_fault")], { target: t });
    expect(f).toMatchObject({ status: "needs_review", reason: "prerequisite_unmet" });
  });

  it("a. assistive_tech_required before b. no_check", () => {
    const e = entry({ enabled: "none", needs: ["assistive_tech"], links: [] });
    expect(derive1(e, []).reason).toBe("assistive_tech_required");
  });

  it("a. assistive_tech_required before c. not_enabled", () => {
    const e = entry({ needs: ["assistive_tech"], links: [{ check: "custom/res", kind: "resolving" }] });
    expect(derive1(e, [obs("custom/res", "no_fault")], { level: "none" }).reason).toBe("assistive_tech_required");
  });

  it("b. no_check before c. not_enabled", () => {
    const e = entry({ enabled: "none", links: [] });
    expect(derive1(e, [], { level: "none" }).reason).toBe("no_check");
  });

  it("c. not_enabled before d. prerequisite_unmet", () => {
    const e = entry({ needs: ["keyboard"], links: [{ check: "custom/res", kind: "resolving_failure" }] });
    expect(derive1(e, [obs("custom/res", "no_fault")], { level: "fail_only" }).reason).toBe("not_enabled");
  });

  it("d. prerequisite_unmet before e. checks_disagree", () => {
    const e = entry({
      needs: ["media"],
      links: [
        { check: "custom/res", kind: "resolving" },
        { check: "custom/res2", kind: "resolving" },
      ],
    });
    expect(derive1(e, [obs("custom/res", "no_fault"), obs("custom/res2", "inapplicable")]).reason).toBe("prerequisite_unmet");
  });

  it("d. prerequisite_unmet before f. unresolved", () => {
    const e = entry({ needs: ["keyboard"], links: [{ check: "custom/res", kind: "resolving" }] });
    expect(derive1(e, [obs("custom/res", "cannot_tell")]).reason).toBe("prerequisite_unmet");
  });

  it("d. prerequisite_unmet before rule 4: an unmet prerequisite blocks not_applicable", () => {
    const e = entry({ needs: ["keyboard"], links: [{ check: "custom/res", kind: "resolving" }] });
    expect(derive1(e, [obs("custom/res", "inapplicable")])).toMatchObject({ status: "needs_review", reason: "prerequisite_unmet" });
  });

  it("e. checks_disagree before f. unresolved", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r1" },
        { check: "custom/res3", kind: "resolving", req: "r2" },
      ],
    });
    expect(derive1(e, [obs("custom/res", "no_fault"), obs("custom/res2", "inapplicable"), obs("custom/res3", "fault")]).reason).toBe(
      "checks_disagree",
    );
  });

  it("f. alternative_unresolved when an unresolved requirement has a fault, even beside a cannot_tell", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });
    // r1: resolving evidence_only fault (unresolved, with a fault). r2: cannot_tell.
    expect(derive1(e, [obs("custom/res", "fault"), obs("custom/res2", "cannot_tell")]).reason).toBe("alternative_unresolved");
  });

  it("f. cannot_tell when the only fault is on a requirement that is not unresolved", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "axe/adv", kind: "advisory", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "no_fault"), obs("axe/adv", "fault"), obs("custom/res2", "cannot_tell")]);
    expect(f.reason).toBe("cannot_tell");
    expect(f.requirementFacts).toEqual({ r1: ["satisfied"], r2: ["unresolved"] });
  });
});

// ---------------------------------------------------------------------------
// Reasons of not_tested and their precedence
// ---------------------------------------------------------------------------

describe("not_tested reasons", () => {
  const three = () =>
    entry({
      links: [
        { check: "custom/res", kind: "resolving" },
        { check: "custom/res2", kind: "resolving" },
        { check: "custom/res3", kind: "resolving" },
      ],
    });

  it("missing_observation: a linked check has no observation", () => {
    const f = derive1(three(), [obs("custom/res", "no_fault"), obs("custom/res2", "no_fault")]);
    expect(f).toMatchObject({ status: "not_tested", reason: "missing_observation", complete: false, notRun: ["custom/res3"] });
  });

  it("check_error: a linked check errored", () => {
    const f = derive1(three(), [obs("custom/res", "no_fault"), obs("custom/res2", "no_fault"), obs("custom/res3", "error")]);
    expect(f).toMatchObject({ status: "not_tested", reason: "check_error", notRun: ["custom/res3"] });
  });

  it("scope_unreadable: a linked check could not read part of the scope", () => {
    const f = derive1(three(), [
      obs("custom/res", "no_fault"),
      obs("custom/res2", "no_fault"),
      obs("custom/res3", "error", { errorKind: "scope_unreadable" }),
    ]);
    expect(f).toMatchObject({ status: "not_tested", reason: "scope_unreadable", notRun: ["custom/res3"] });
  });

  it("missing_observation before scope_unreadable before check_error", () => {
    const all = derive1(three(), [obs("custom/res", "error"), obs("custom/res2", "error", { errorKind: "scope_unreadable" })]);
    expect(all.reason).toBe("missing_observation");
    expect(all.notRun).toEqual(["custom/res", "custom/res2", "custom/res3"]);
    const two = derive1(three(), [
      obs("custom/res", "error"),
      obs("custom/res2", "error", { errorKind: "scope_unreadable" }),
      obs("custom/res3", "no_fault"),
    ]);
    expect(two.reason).toBe("scope_unreadable");
  });

  it("an advisory check that errors still makes the finding not_tested (any linked check, 8.3)", () => {
    const f = derive1(resAdv(), [obs("custom/res", "no_fault"), obs("axe/adv", "error")]);
    expect(f).toMatchObject({ status: "not_tested", reason: "check_error", notRun: ["axe/adv"] });
    expect(f.requirementFacts).toEqual({ r1: ["error"] });
  });
});

// ---------------------------------------------------------------------------
// Prerequisites (contract.ts PREREQUISITE_MEANING)
// ---------------------------------------------------------------------------

describe("prerequisites", () => {
  const needing = (p: "state" | "keyboard" | "media" | "model" | "assistive_tech") =>
    entry({ needs: [p], links: [{ check: "custom/res", kind: "resolving" }] });

  it("state: unmet on an initial target", () => {
    const f = derive1(needing("state"), [obs("custom/res", "no_fault")], { target: target(T_INITIAL) });
    expect(f).toMatchObject({ status: "needs_review", reason: "prerequisite_unmet" });
  });

  it("state: met on an established declared state that lists it", () => {
    const f = derive1(needing("state"), [obs("custom/res", "no_fault", { targetId: T_STATE })], { target: target(T_STATE) });
    expect(f.status).toBe("passed");
  });

  it("state: unmet on a declared state whose execution does not list it", () => {
    const f = derive1(needing("state"), [obs("custom/res", "no_fault", { targetId: T_STATE })], { target: target(T_STATE, []) });
    expect(f).toMatchObject({ status: "needs_review", reason: "prerequisite_unmet" });
  });

  it("keyboard and media: met only when the target lists them", () => {
    for (const p of ["keyboard", "media"] as const) {
      expect(derive1(needing(p), [obs("custom/res", "no_fault")], { target: target(T_INITIAL, [p]) }).status).toBe("passed");
      expect(derive1(needing(p), [obs("custom/res", "no_fault")], { target: target(T_INITIAL, []) })).toMatchObject({
        status: "needs_review",
        reason: "prerequisite_unmet",
      });
    }
  });

  it("keyboard met does not meet media", () => {
    const f = derive1(needing("media"), [obs("custom/res", "no_fault")], { target: target(T_INITIAL, ["keyboard"]) });
    expect(f.reason).toBe("prerequisite_unmet");
  });

  it("model: never met for a status, even when the target lists it", () => {
    const f = derive1(needing("model"), [obs("custom/res", "inapplicable")], { target: target(T_INITIAL, ["model"]) });
    expect(f).toMatchObject({ status: "needs_review", reason: "prerequisite_unmet" });
  });

  it("assistive_tech: never met; the reason is assistive_tech_required", () => {
    const f = derive1(needing("assistive_tech"), [obs("custom/res", "no_fault")], { target: target(T_INITIAL, ["keyboard", "media"]) });
    expect(f).toMatchObject({ status: "needs_review", reason: "assistive_tech_required" });
  });

  it("an unmet prerequisite never blocks failed or not_tested", () => {
    const e = entry({ needs: ["keyboard", "assistive_tech"], links: [{ check: "custom/res", kind: "resolving_failure" }] });
    expect(derive1(e, [obs("custom/res", "fault")]).status).toBe("failed");
    expect(derive1(e, [obs("custom/res", "error")]).status).toBe("not_tested");
  });

  it("a target listing state on initial is refused, not trusted", () => {
    const t = rawTarget(T_INITIAL, ["state"]);
    const r = deriveRaw({ target: t, observations: [], entries: [{ entry: needing("state"), level: "full" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejections.map((x) => x.code)).toEqual(["target_invalid"]);
  });
});

// ---------------------------------------------------------------------------
// Step 1: a target that was not established
// ---------------------------------------------------------------------------

describe("a target that was not established", () => {
  const e = () =>
    entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/res", kind: "resolving_failure", req: "r1" },
        { check: "axe/adv", kind: "advisory", req: "r1" },
        { check: "custom/res", kind: "resolving_failure", req: "r2" },
      ],
    });

  it("expect not met after the steps: not_tested, target_not_established, nothing else looked at", () => {
    for (const level of LEVELS) {
      const f = derive1(e(), [], { level, target: unestablished(T_STATE, "expect_not_met") });
      expect(f).toEqual({
        ruleset: RULESET,
        test: "1.1.1",
        targetId: T_STATE,
        status: "not_tested",
        reason: "target_not_established",
        complete: false,
        notRun: ["axe/adv", "custom/res"],
        requirementFacts: {},
        observations: [],
      });
    }
  });

  it("a failed step: target_not_established", () => {
    expect(derive1(e(), [], { target: unestablished(T_STATE, "step_failed") }).reason).toBe("target_not_established");
  });

  it("an initial target whose page expect was not met: target_not_established", () => {
    expect(derive1(e(), [], { target: unestablished(T_INITIAL, "initial_redirect") }).reason).toBe("target_not_established");
  });

  it("expect already met before the steps: not_tested, expect_already_met", () => {
    const f = derive1(e(), [], { target: unestablished(T_STATE, "expect_already_met") });
    expect(f).toMatchObject({ status: "not_tested", reason: "expect_already_met", complete: false, requirementFacts: {}, observations: [] });
    expect(f.notRun).toEqual(["axe/adv", "custom/res"]);
  });

  it("an entry with no link is still not_tested and incomplete", () => {
    const f = derive1(entry({ enabled: "none" }), [], { target: unestablished(T_STATE) });
    expect(f).toMatchObject({ status: "not_tested", reason: "target_not_established", complete: false, notRun: [] });
  });

  it("observations given for it are refused: a fault seen on the wrong screen never reaches the next steps", () => {
    const r = deriveRaw({
      target: unestablished(T_STATE),
      observations: [obs("custom/res", "fault", { targetId: T_STATE }), obs("axe/adv", "fault", { targetId: T_STATE })],
      entries: [{ entry: e(), level: "full" }],
    });
    expect(r).toEqual({ ok: false, rejections: [{ code: "observations_on_unestablished_target", count: 2 }] });
  });
});

// ---------------------------------------------------------------------------
// Applicability
// ---------------------------------------------------------------------------

describe("structural against judgment applicability", () => {
  type Applicability = "structural" | "judgment" | "always";
  const two = (applicability: Applicability) =>
    entry({
      reqs: ["r1", "r2"],
      applicability,
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });
  const allInapplicable = () => [obs("custom/res", "inapplicable"), obs("custom/res2", "inapplicable")];

  it("every requirement inapplicable, structural: not_applicable", () => {
    const f = derive1(two("structural"), allInapplicable());
    expect(f.status).toBe("not_applicable");
    expect(f.requirementFacts).toEqual({ r1: ["inapplicable"], r2: ["inapplicable"] });
  });

  it("every requirement inapplicable, judgment: needs_review, judgment_required", () => {
    expect(derive1(two("judgment"), allInapplicable())).toMatchObject({ status: "needs_review", reason: "judgment_required" });
  });

  it("judgment below full: not_enabled comes first", () => {
    expect(derive1(two("judgment"), allInapplicable(), { level: "fail_only" }).reason).toBe("not_enabled");
  });

  // Q40: `always` is for a test that applies to every page.

  it("every requirement inapplicable, always: needs_review, cannot_tell", () => {
    const f = derive1(two("always"), allInapplicable());
    expect(f).toMatchObject({ status: "needs_review", reason: "cannot_tell", complete: true });
    expect(f.requirementFacts).toEqual({ r1: ["inapplicable"], r2: ["inapplicable"] });
  });

  it("every requirement inapplicable: the three values side by side", () => {
    const got = (["structural", "judgment", "always"] as const).map((a) => {
      const f = derive1(two(a), allInapplicable());
      return [a, f.status, f.reason];
    });
    expect(got).toEqual([
      ["structural", "not_applicable", undefined],
      ["judgment", "needs_review", "judgment_required"],
      ["always", "needs_review", "cannot_tell"],
    ]);
  });

  it("always never gives not_applicable, at any level, whatever the outcomes", () => {
    const outcomes: Outcome[] = ["no_fault", "inapplicable", "cannot_tell", "fault", "error"];
    for (const level of LEVELS) {
      for (const kind of ["resolving", "resolving_failure"] as const) {
        const e = entry({ applicability: "always", links: [{ check: "custom/res", kind }] });
        for (const outcome of outcomes) {
          expect(derive1(e, [obs("custom/res", outcome)], { level }).status, `${level} ${kind} ${outcome}`).not.toBe("not_applicable");
        }
        // A missing observation too.
        expect(derive1(e, [], { level }).status, `${level} ${kind} missing`).not.toBe("not_applicable");
      }
      expect(derive1(two("always"), allInapplicable(), { level }).status, `${level} two inapplicable`).not.toBe("not_applicable");
      // Mixed outcomes across two requirements.
      for (const a of outcomes) {
        for (const b of outcomes) {
          const f = derive1(two("always"), [obs("custom/res", a), obs("custom/res2", b)], { level });
          expect(f.status, `${level} ${a}/${b}`).not.toBe("not_applicable");
        }
      }
    }
  });

  it("always below full: not_enabled comes first", () => {
    expect(derive1(two("always"), allInapplicable(), { level: "fail_only" })).toMatchObject({ status: "needs_review", reason: "not_enabled" });
    expect(derive1(two("always"), allInapplicable(), { level: "none" })).toMatchObject({ status: "needs_review", reason: "not_enabled" });
  });

  it("always: a proven failure is still failed at fail_only and full", () => {
    const e = entry({ applicability: "always", links: [{ check: "custom/res", kind: "resolving_failure" }] });
    for (const level of ["fail_only", "full"] as const) {
      const f = derive1(e, [obs("custom/res", "fault")], { level });
      expect(f.status, level).toBe("failed");
      expect(f.reason, level).toBeUndefined();
      expect(f.requirementFacts, level).toEqual({ r1: ["violation"] });
    }
    // At none the failure is not concluded.
    expect(derive1(e, [obs("custom/res", "fault")], { level: "none" }).status).not.toBe("failed");
  });

  it("always: every requirement satisfied at full is still passed", () => {
    const f = derive1(two("always"), [obs("custom/res", "no_fault"), obs("custom/res2", "no_fault")]);
    expect(f.status).toBe("passed");
    expect(f.reason).toBeUndefined();
    expect(f.requirementFacts).toEqual({ r1: ["satisfied"], r2: ["satisfied"] });
  });

  // Q43: on `always`, any one inapplicable requirement is enough, judged per requirement.

  it("always: one requirement satisfied and one inapplicable is needs_review, cannot_tell (Q43)", () => {
    const f = derive1(two("always"), [obs("custom/res", "no_fault"), obs("custom/res2", "inapplicable")]);
    expect(f).toMatchObject({ status: "needs_review", reason: "cannot_tell", complete: true });
    expect(f.requirementFacts).toEqual({ r1: ["satisfied"], r2: ["inapplicable"] });
    // Either requirement may be the inapplicable one.
    expect(derive1(two("always"), [obs("custom/res", "inapplicable"), obs("custom/res2", "no_fault")])).toMatchObject({
      status: "needs_review",
      reason: "cannot_tell",
    });
  });

  it("one satisfied and one inapplicable: structural and judgment are still passed, always is not (Q43)", () => {
    const got = (["structural", "judgment", "always"] as const).map((a) => {
      const f = derive1(two(a), [obs("custom/res", "no_fault"), obs("custom/res2", "inapplicable")]);
      return [a, f.status, f.reason];
    });
    expect(got).toEqual([
      ["structural", "passed", undefined],
      ["judgment", "passed", undefined],
      ["always", "needs_review", "cannot_tell"],
    ]);
  });

  it("always: a violation beside an inapplicable requirement is still failed at fail_only and full (Q43)", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      applicability: "always",
      links: [
        { check: "custom/res", kind: "resolving_failure", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });
    for (const level of ["fail_only", "full"] as const) {
      const f = derive1(e, [obs("custom/res", "fault"), obs("custom/res2", "inapplicable")], { level });
      expect(f.status, level).toBe("failed");
      expect(f.reason, level).toBeUndefined();
      expect(f.requirementFacts, level).toEqual({ r1: ["violation"], r2: ["inapplicable"] });
    }
  });

  it("always: an error beside an inapplicable requirement is still not_tested, check_error (Q43)", () => {
    const f = derive1(two("always"), [obs("custom/res", "inapplicable"), obs("custom/res2", "error")]);
    expect(f).toMatchObject({ status: "not_tested", reason: "check_error", complete: false });
    expect(f.notRun).toEqual(["custom/res2"]);
  });

  it("always: an advisory observation answering inapplicable never triggers needs_review; the resolving no_fault gives passed (Q43)", () => {
    const e = entry({
      applicability: "always",
      links: [
        { check: "custom/res", kind: "resolving" },
        { check: "axe/adv", kind: "advisory" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "no_fault"), obs("axe/adv", "inapplicable")]);
    expect(f.status).toBe("passed");
    expect(f.reason).toBeUndefined();
    expect(f.requirementFacts).toEqual({ r1: ["satisfied"] });
  });

  it("always: a dispute beside an inapplicable requirement keeps checks_disagree (Q43)", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      applicability: "always",
      links: [
        { check: "custom/fail", kind: "failure_partial", req: "r1" },
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });
    const f = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "no_fault"), obs("custom/res2", "inapplicable")]);
    expect(f).toMatchObject({ status: "needs_review", reason: "checks_disagree" });
    expect(f.requirementFacts.r1).toContain("dispute");
    expect(f.requirementFacts.r2).toEqual(["inapplicable"]);
  });

  it("always: an unmet prerequisite beside an inapplicable requirement keeps prerequisite_unmet (Q43)", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      applicability: "always",
      needs: ["keyboard"],
      links: [
        { check: "custom/res", kind: "resolving", req: "r1" },
        { check: "custom/res2", kind: "resolving", req: "r2" },
      ],
    });
    expect(derive1(e, [obs("custom/res", "no_fault"), obs("custom/res2", "inapplicable")])).toMatchObject({
      status: "needs_review",
      reason: "prerequisite_unmet",
    });
  });

  it("always: cannot_tell on a requirement is cannot_tell, as for the other values", () => {
    for (const a of ["structural", "judgment", "always"] as const) {
      expect(derive1(two(a), [obs("custom/res", "cannot_tell"), obs("custom/res2", "inapplicable")]), a).toMatchObject({
        status: "needs_review",
        reason: "cannot_tell",
      });
    }
  });

  describe("earlier rules of step 4 win over 4.4 for always, as for the others", () => {
    const VALUES: Applicability[] = ["structural", "judgment", "always"];

    it("an error (4.2): not_tested", () => {
      for (const a of VALUES) {
        const f = derive1(two(a), [obs("custom/res", "error"), obs("custom/res2", "inapplicable")]);
        expect(f, a).toMatchObject({ status: "not_tested", reason: "check_error", complete: false });
        expect(f.notRun, a).toEqual(["custom/res"]);
      }
    });

    it("a dispute (3e): needs_review, checks_disagree", () => {
      for (const a of VALUES) {
        const e = entry({
          applicability: a,
          links: [
            { check: "custom/fail", kind: "failure_partial" },
            { check: "custom/res", kind: "resolving" },
          ],
        });
        // The failure fault contradicts the resolving inapplicable: a dispute, not an inapplicable test.
        expect(derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "inapplicable")]), a).toMatchObject({
          status: "needs_review",
          reason: "checks_disagree",
        });
      }
    });

    it("an unmet prerequisite (3d): needs_review, prerequisite_unmet", () => {
      for (const a of VALUES) {
        const e = entry({ applicability: a, needs: ["keyboard"], links: [{ check: "custom/res", kind: "resolving" }] });
        expect(derive1(e, [obs("custom/res", "inapplicable")]), a).toMatchObject({ status: "needs_review", reason: "prerequisite_unmet" });
      }
    });

    it("an unestablished target (step 1): not_tested, target_not_established", () => {
      for (const a of VALUES) {
        const e = entry({ applicability: a, links: [{ check: "custom/res", kind: "resolving" }] });
        const f = derive1(e, [], { target: unestablished(T_STATE) });
        expect(f, a).toMatchObject({ status: "not_tested", reason: "target_not_established", complete: false });
      }
    });
  });

  describe("the schema", () => {
    it("accepts each of structural, judgment and always", () => {
      for (const a of ["structural", "judgment", "always"] as const) {
        expect(entry({ applicability: a, links: [{ check: "custom/res", kind: "resolving" }] }).applicability).toBe(a);
      }
    });

    it("rejects an unknown value", () => {
      for (const bad of ["never", "Always", "", "sometimes", null, 1]) {
        const raw = rawEntry({ links: [{ check: "custom/res", kind: "resolving" }] });
        raw.applicability = bad;
        expect(CoverageEntrySchema.safeParse(raw).success, String(bad)).toBe(false);
      }
    });

    it("deriveFindings refuses an entry with an unknown applicability", () => {
      const raw = rawEntry({ links: [{ check: "custom/res", kind: "resolving" }] });
      raw.applicability = "never";
      const r = deriveRaw({ target: target(), observations: [obs("custom/res", "no_fault")], entries: [{ entry: raw, level: "full" }] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.rejections.map((x) => x.code)).toEqual(["entry_invalid"]);
    });
  });
});

// ---------------------------------------------------------------------------
// Advisory faults
// ---------------------------------------------------------------------------

describe("an advisory claim never changes a status, in either direction", () => {
  // Each base: the entry's authoritative links, their observations, and the
  // status the spec gives without any advisory link. Adding an advisory link
  // with any outcome short of an error must leave the status unchanged.
  const base: { name: string; links: LinkSpec[]; o: () => Observation[]; level: Level; status: Status }[] = [
    { name: "satisfied", links: [{ check: "custom/res", kind: "resolving" }], o: () => [obs("custom/res", "no_fault")], level: "full", status: "passed" },
    { name: "inapplicable", links: [{ check: "custom/res", kind: "resolving" }], o: () => [obs("custom/res", "inapplicable")], level: "full", status: "not_applicable" },
    { name: "cannot_tell", links: [{ check: "custom/res", kind: "resolving" }], o: () => [obs("custom/res", "cannot_tell")], level: "full", status: "needs_review" },
    { name: "violation", links: [{ check: "custom/res", kind: "resolving_failure" }], o: () => [obs("custom/res", "fault")], level: "full", status: "failed" },
    { name: "no_fault at fail_only", links: [{ check: "custom/res", kind: "resolving_failure" }], o: () => [obs("custom/res", "no_fault")], level: "fail_only", status: "needs_review" },
  ];

  for (const b of base) {
    it(`${b.name}: ${b.status} with or without an advisory claim`, () => {
      expect(derive1(entry({ links: b.links }), b.o(), { level: b.level }).status).toBe(b.status);
      const withAdv = entry({ links: [...b.links, { check: "axe/adv", kind: "advisory" }] });
      for (const adv of ["fault", "no_fault", "inapplicable", "cannot_tell"] as const) {
        const f = derive1(withAdv, [...b.o(), obs("axe/adv", adv)], { level: b.level });
        expect(f.status).toBe(b.status);
        expect(f.observations).toContain("o:axe/adv");
      }
    });
  }

  it("an advisory fault does not make a fail_only entry fail", () => {
    const e = entry({
      links: [
        { check: "custom/res", kind: "resolving_failure" },
        { check: "axe/adv", kind: "advisory" },
      ],
    });
    const f = derive1(e, [obs("custom/res", "no_fault"), obs("axe/adv", "fault")], { level: "fail_only" });
    expect(f).toMatchObject({ status: "needs_review", reason: "not_enabled" });
  });

  it("a failure link's no_fault or inapplicable is not authoritative: it neither satisfies nor disputes", () => {
    const e = entry({
      links: [
        { check: "custom/fail", kind: "failure_partial" },
        { check: "custom/res", kind: "resolving" },
      ],
    });
    const a = derive1(e, [obs("custom/fail", "no_fault"), obs("custom/res", "cannot_tell")]);
    expect(a).toMatchObject({ status: "needs_review", reason: "cannot_tell" });
    expect(a.requirementFacts).toEqual({ r1: ["unresolved"] });
    const b = derive1(e, [obs("custom/fail", "inapplicable"), obs("custom/res", "no_fault")]);
    expect(b.status).toBe("passed");
    const c = derive1(e, [obs("custom/fail", "no_fault"), obs("custom/res", "inapplicable")]);
    expect(c.status).toBe("not_applicable");
  });
});

// ---------------------------------------------------------------------------
// requirementFacts and the finding's shape
// ---------------------------------------------------------------------------

describe("requirementFacts keeps every true fact", () => {
  it("an error beside an unresolved fact", () => {
    const f = derive1(resAdv(), [obs("custom/res", "cannot_tell")]);
    expect(f).toMatchObject({ status: "not_tested", reason: "missing_observation", notRun: ["axe/adv"] });
    expect(f.requirementFacts).toEqual({ r1: ["error", "unresolved"] });
  });

  it("an error, a dispute and an unresolved fact on one requirement, in FACTS order", () => {
    const e = entry({
      links: [
        { check: "custom/fail", kind: "failure_partial" },
        { check: "custom/res", kind: "resolving" },
        { check: "custom/res2", kind: "resolving" },
        { check: "custom/res3", kind: "resolving" },
      ],
    });
    const f = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "no_fault"), obs("custom/res2", "cannot_tell"), obs("custom/res3", "error")]);
    expect(f.status).toBe("not_tested");
    expect(f.requirementFacts).toEqual({ r1: ["error", "dispute", "unresolved"] });
  });

  it("an error beside a violation is kept whichever of the two decides", () => {
    const e = entry({
      links: [
        { check: "custom/fail", kind: "failure_partial" },
        { check: "custom/res", kind: "resolving" },
      ],
    });
    const f = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "error")]);
    expect(f.status).toBe("failed");
    expect(f.requirementFacts).toEqual({ r1: ["error", "violation"] });
    // At level none the error decides (not_tested); the violation is still recorded.
    const g = derive1(e, [obs("custom/fail", "fault"), obs("custom/res", "error")], { level: "none" });
    expect(g.status).toBe("not_tested");
    expect(g.requirementFacts).toEqual({ r1: ["error", "violation"] });
  });

  it("a violation at level none is recorded though the status is needs_review", () => {
    const e = entry({ links: [{ check: "custom/res", kind: "resolving_failure" }] });
    const f = derive1(e, [obs("custom/res", "fault")], { level: "none" });
    expect(f.status).toBe("needs_review");
    expect(f.requirementFacts).toEqual({ r1: ["violation"] });
  });
});

describe("the finding", () => {
  it("observations: the linked checks' observation ids, sorted; unlinked observations are ignored", () => {
    const f = derive1(resAdv(), [obs("custom/res", "no_fault", { id: "b" }), obs("axe/unrelated", "fault", { id: "c" }), obs("axe/adv", "fault", { id: "a" })]);
    expect(f.observations).toEqual(["a", "b"]);
    expect(f.status).toBe("passed");
  });

  it("notRun: distinct linked check ids that err, sorted; complete only when it is empty", () => {
    const e = entry({
      reqs: ["r1", "r2"],
      links: [
        { check: "custom/zed", kind: "resolving", req: "r1" },
        { check: "custom/alpha", kind: "resolving", req: "r1" },
        { check: "custom/zed", kind: "resolving", req: "r2" },
      ],
    });
    const f = derive1(e, [obs("custom/alpha", "error")]);
    expect(f.notRun).toEqual(["custom/alpha", "custom/zed"]);
    expect(f.complete).toBe(false);
    const g = derive1(e, [obs("custom/alpha", "no_fault"), obs("custom/zed", "no_fault")]);
    expect(g.notRun).toEqual([]);
    expect(g.complete).toBe(true);
  });

  it("one finding per entry, ruleset copied, no suggestion, sorted by test id in official order", () => {
    const tests = ["1.10.1", "1.2.1", "1.1.10", "1.1.2"];
    const r = deriveFindings({
      ruleset: "some-ruleset",
      target: target(),
      observations: [obs("custom/res", "no_fault")],
      entries: tests.map((t) => ({ entry: entry({ test: t, links: [{ check: "custom/res", kind: "resolving" }] }), level: "full" as Level })),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.findings.map((f) => f.test)).toEqual(["1.1.2", "1.1.10", "1.2.1", "1.10.1"]);
    for (const f of r.findings) {
      expect(f.ruleset).toBe("some-ruleset");
      expect(f.targetId).toBe(T_INITIAL);
      expect(f.status).toBe("passed");
      expect("suggestion" in f).toBe(false);
    }
  });

  it("an empty list of entries gives no finding", () => {
    expect(deriveFindings({ ruleset: RULESET, target: target(), observations: [], entries: [] })).toEqual({ ok: true, findings: [] });
  });

  it("is deterministic: the same input twice, and observations shuffled, give the same findings", () => {
    const input = () => ({
      ruleset: RULESET,
      target: target(),
      observations: [obs("custom/fail", "fault"), obs("custom/res", "no_fault"), obs("axe/adv", "fault")],
      entries: [
        {
          entry: entry({
            test: "1.1.2",
            links: [
              { check: "custom/fail", kind: "failure_partial" },
              { check: "custom/res", kind: "resolving" },
            ],
          }),
          level: "full" as Level,
        },
        { entry: resAdv(), level: "full" as Level },
      ],
    });
    const a = deriveFindings(input());
    const b = deriveFindings(input());
    const i = input();
    const c = deriveFindings({ ...i, observations: [...i.observations].reverse(), entries: [...i.entries].reverse() });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });
});

// ---------------------------------------------------------------------------
// Step 0: inputs are validated before derivation
// ---------------------------------------------------------------------------

describe("inputs are validated first, and a rejected call derives nothing", () => {
  const good = () => entry({ links: [{ check: "custom/res", kind: "resolving" }] });

  function rejected(r: ReturnType<typeof deriveRaw>) {
    expect(r.ok).toBe(false);
    expect("findings" in r).toBe(false);
    return r.ok ? [] : r.rejections;
  }

  it("target_invalid", () => {
    const t = rawTarget();
    delete t.viewport;
    const rs = rejected(deriveRaw({ target: t, observations: [], entries: [{ entry: good(), level: "full" }] }));
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ code: "target_invalid" });
    expect((rs[0] as { issues: string[] }).issues.length).toBeGreaterThan(0);
  });

  it("entry_invalid: an entry with no requirement", () => {
    const raw = rawEntry({ test: "1.1.2", enabled: "none" });
    raw.requirements = [];
    const rs = rejected(
      deriveRaw({ target: target(), observations: [], entries: [{ entry: good(), level: "full" }, { entry: raw, level: "none" }] }),
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ code: "entry_invalid", index: 1 });
    expect((rs[0] as { issues: string[] }).issues.length).toBeGreaterThan(0);
  });

  it("entry_invalid: an entry that breaks a structural rule (failure on a link that misses a route)", () => {
    const raw = rawEntry({ enabled: "none", links: [{ check: "axe/adv", kind: "advisory" }] });
    raw.links[0].faultMeans = "failure";
    const rs = rejected(deriveRaw({ target: target(), observations: [], entries: [{ entry: raw, level: "none" }] }));
    expect(rs.map((x) => x.code)).toEqual(["entry_invalid"]);
  });

  it("duplicate_entry, listed once", () => {
    const rs = rejected(
      deriveRaw({
        target: target(),
        observations: [obs("custom/res", "no_fault")],
        entries: [
          { entry: good(), level: "full" },
          { entry: good(), level: "full" },
          { entry: good(), level: "none" },
        ],
      }),
    );
    expect(rs).toEqual([{ code: "duplicate_entry", test: "1.1.1" }]);
  });

  it("level_above_enabled", () => {
    const e = entry({ candidate: "full", enabled: "fail_only", links: [{ check: "custom/res", kind: "resolving_failure" }] });
    const rs = rejected(deriveRaw({ target: target(), observations: [obs("custom/res", "fault")], entries: [{ entry: e, level: "full" }] }));
    expect(rs).toEqual([{ code: "level_above_enabled", test: "1.1.1", level: "full", enabled: "fail_only" }]);
  });

  it("observation_invalid: a malformed observation", () => {
    const bad = rawObservation("custom/res", "no_fault");
    bad.evidence = []; // no_fault without scope_examined evidence
    const rs = rejected(deriveRaw({ target: target(), observations: [obs("axe/adv", "fault"), bad], entries: [{ entry: good(), level: "full" }] }));
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ code: "observation_invalid", index: 1 });
  });

  it("observation_invalid: an error outcome without its error, and an unlinked observation is validated too", () => {
    const bad = rawObservation("axe/unrelated", "error");
    delete bad.error;
    const rs = rejected(deriveRaw({ target: target(), observations: [bad, obs("custom/res", "no_fault")], entries: [{ entry: good(), level: "full" }] }));
    expect(rs.map((x) => x.code)).toEqual(["observation_invalid"]);
    expect(rs[0]).toMatchObject({ index: 0 });
  });

  it("observation_other_target", () => {
    const rs = rejected(
      deriveRaw({ target: target(), observations: [obs("custom/res", "no_fault", { id: "x", targetId: "q/initial" })], entries: [{ entry: good(), level: "full" }] }),
    );
    expect(rs).toEqual([{ code: "observation_other_target", observationId: "x", targetId: "q/initial" }]);
  });

  it("duplicate_observation: two observations of one check, listed once", () => {
    const rs = rejected(
      deriveRaw({
        target: target(),
        observations: [obs("custom/res", "no_fault", { id: "a" }), obs("custom/res", "fault", { id: "b" }), obs("custom/res", "cannot_tell", { id: "c" })],
        entries: [{ entry: good(), level: "full" }],
      }),
    );
    expect(rs).toEqual([{ code: "duplicate_observation", checkId: "custom/res" }]);
  });

  it("duplicate_observation_id", () => {
    const rs = rejected(
      deriveRaw({
        target: target(),
        observations: [obs("custom/res", "no_fault", { id: "same" }), obs("axe/adv", "fault", { id: "same" })],
        entries: [{ entry: resAdv(), level: "full" }],
      }),
    );
    expect(rs).toEqual([{ code: "duplicate_observation_id", observationId: "same" }]);
  });

  it("observations_on_unestablished_target", () => {
    const rs = rejected(
      deriveRaw({ target: unestablished(T_STATE), observations: [obs("custom/res", "no_fault", { targetId: T_STATE })], entries: [{ entry: good(), level: "full" }] }),
    );
    expect(rs).toEqual([{ code: "observations_on_unestablished_target", count: 1 }]);
  });

  it("every problem is listed: target, then entries by index, then observations by index", () => {
    const t = rawTarget();
    t.sessionLoaded = "yes";
    const noReq = rawEntry({ test: "1.1.2", enabled: "none" });
    noReq.requirements = [];
    const tooHigh = entry({ test: "1.1.3", candidate: "full", enabled: "none", links: [{ check: "custom/res", kind: "resolving" }] });
    const bad = rawObservation("custom/res", "inapplicable");
    bad.evidence = [];
    const rs = rejected(
      deriveRaw({
        target: t,
        observations: [bad, obs("axe/adv", "fault", { id: "elsewhere", targetId: "q/initial" })],
        entries: [
          { entry: good(), level: "full" },
          { entry: noReq, level: "none" },
          { entry: tooHigh, level: "fail_only" },
        ],
      }),
    );
    expect(rs.map((x) => x.code)).toEqual([
      "target_invalid",
      "entry_invalid",
      "level_above_enabled",
      "observation_invalid",
      "observation_other_target",
    ]);
    expect(rs[1]).toMatchObject({ index: 1 });
    expect(rs[2]).toMatchObject({ test: "1.1.3", level: "fail_only", enabled: "none" });
    expect(rs[3]).toMatchObject({ index: 0 });
    expect(rs[4]).toMatchObject({ observationId: "elsewhere", targetId: "q/initial" });
  });
});
