import type { DerivationRejection, DeriveFindingsInput, DeriveFindingsResult } from "../contract.ts";
import {
  CoverageEntrySchema,
  FACTS,
  LevelSchema,
  ObservationSchema,
  TargetExecutionSchema,
  compareDottedIds,
  isResolving,
  levelRank,
} from "../../schema/index.ts";
import type { CoverageEntry, Fact, Finding, Level, Link, Observation, Reason, Status, TargetExecution } from "../../schema/index.ts";
import { unmetPrerequisites } from "./prerequisites.ts";

/**
 * The status of each test on one target (spec 8.3). Deterministic; no model.
 * Ruleset-neutral: every plug-in reuses it.
 *
 * ## 0. Validate the inputs first
 *
 * Return `{ ok: false, rejections }` listing every problem, and derive
 * nothing, when any of these holds (codes in `DerivationRejection`):
 * - `target` fails `TargetExecutionSchema` (`target_invalid`);
 * - an entry fails `CoverageEntrySchema`, which includes "no requirement"
 *   (`entry_invalid`);
 * - two entries share a test (`duplicate_entry`);
 * - a level is above its entry's `enabled` (`level_above_enabled`);
 * - an observation fails `ObservationSchema` (`observation_invalid`);
 * - an observation's `targetId` differs from the target's (`observation_other_target`);
 * - two observations share a `checkId` (`duplicate_observation`) or an `id`
 *   (`duplicate_observation_id`);
 * - observations are given for a target that was not established
 *   (`observations_on_unestablished_target`).
 * The order of `rejections` is: target, then entries by index, then
 * observations by index. Each problem is listed once.
 *
 * ## Definitions
 *
 * For an entry, its links, and the observation `obs(l)` of link `l` (the
 * observation whose `checkId` is `l.check`, or none):
 * - `l` is *resolving* when `isResolving(entry, l)` (all routes and exceptions,
 *   scope `whole`). This is structural: it does not depend on observations.
 * - `l` *errs* when `obs(l)` is missing or its outcome is `error`.
 * - a *failure fault* is a link with `faultMeans: failure` whose outcome is `fault`.
 *
 * ## 1. The target
 *
 * If `target.established` is false, every finding is `not_tested` with reason
 * `expect_already_met` when `target.expect.metBeforeSteps === true`, else
 * `target_not_established`; `complete: false`; `notRun` = every distinct
 * linked check id of the entry, sorted; `requirementFacts: {}`;
 * `observations: []`. Nothing else is looked at.
 *
 * ## 2-3. The facts of each requirement R (links `L` = the entry's links whose `requirement` is R)
 *
 * - **error**: some `l` in `L` errs.
 * - **dispute**: among links in `L` that do not err, (a failure fault exists
 *   and a resolving link reports `no_fault` or `inapplicable`), or (a
 *   resolving link reports `no_fault` and another resolving link reports
 *   `inapplicable`).
 * - **violation**: a failure fault exists in `L` and there is no dispute.
 * - **unresolved**: `L` has no resolving link, or a resolving link reports
 *   `cannot_tell`, or a resolving link with `faultMeans: evidence_only`
 *   reports `fault`.
 * - **satisfied**: a resolving link reports `no_fault`, and none of error,
 *   dispute, violation, unresolved holds.
 * - **inapplicable**: `L` has at least one resolving link, every resolving
 *   link reports `inapplicable`, and none of error, dispute, violation,
 *   unresolved holds.
 * A fault from a link that is neither resolving nor `failure` is advisory: it
 * changes no fact and its observation stays in `Finding.observations`.
 * `requirementFacts[R]` lists the true facts in `FACTS` order.
 *
 * ## 4. The test, at level `level` (first rule that applies wins)
 *
 * 1. `failed` if `level` is `fail_only` or `full` and a requirement has a
 *    violation. No reason.
 * 2. `not_tested` if a requirement has an error. Reason: `missing_observation`
 *    if some linked check has no observation; else `scope_unreadable` if some
 *    linked observation has `error.kind: scope_unreadable`; else `check_error`.
 * 3. `needs_review`, with the first reason that applies:
 *    a. `assistive_tech_required` if `needs` contains `assistive_tech`;
 *    b. `no_check` if the entry has no link;
 *    c. `not_enabled` if `level` is not `full`;
 *    d. `prerequisite_unmet` if a prerequisite in `needs` is not met, per
 *       `prerequisiteMetForStatus` (`./prerequisites.ts`);
 *    e. `checks_disagree` if a requirement has a dispute;
 *    f. if a requirement is unresolved: `alternative_unresolved` if some
 *       unresolved requirement has a link that reports `fault`; else
 *       `cannot_tell` if some unresolved requirement has a resolving link that
 *       reports `cannot_tell`; else `alternative_unresolved`.
 * 4. If every requirement is inapplicable: `not_applicable` when
 *    `applicability` is `structural`; `needs_review` with reason
 *    `judgment_required` when it is `judgment`; `needs_review` with reason
 *    `cannot_tell` when it is `always`, because a check answered
 *    `inapplicable` for a test that applies to every page (Q40).
 * 5. Otherwise `passed` (every requirement is satisfied or inapplicable, and
 *    at least one is satisfied).
 * `model_disabled` is reserved for model-judged work (M6) and never produced here.
 *
 * ## The finding, on an established target
 *
 * - `notRun`: distinct check ids of the entry's links that err, sorted.
 * - `complete`: `notRun` is empty.
 * - `observations`: ids of the observations whose `checkId` is linked by the
 *   entry, sorted.
 * - `requirementFacts`: one key per requirement id.
 * - `ruleset`: `input.ruleset`. No `suggestion`.
 *
 * One finding per entry, sorted by test id with `compareDottedIds`.
 */
export function deriveFindings(input: DeriveFindingsInput): DeriveFindingsResult {
  const validated = validate(input);
  if (!validated.ok) return validated;
  const { target, entries, observations } = validated;

  const findings = entries.map(({ entry, level }) =>
    target.established ? deriveOne(input.ruleset, target, entry, level, observations) : unestablished(input.ruleset, target, entry),
  );
  findings.sort((a, b) => compareDottedIds(a.test, b.test));
  return { ok: true, findings };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type Validated =
  | { ok: true; target: TargetExecution; entries: { entry: CoverageEntry; level: Level }[]; observations: Observation[] }
  | { ok: false; rejections: DerivationRejection[] };

/** Zod issues as `path: message` strings. */
function issueStrings(error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }): string[] {
  return error.issues.map((i) => {
    const path = i.path.map((p) => String(p)).join(".");
    return path === "" ? i.message : `${path}: ${i.message}`;
  });
}

/** Records the first repeat of each value, once. */
function repeatTracker(): (value: string) => boolean {
  const seen = new Set<string>();
  const reported = new Set<string>();
  return (value) => {
    const repeat = seen.has(value) && !reported.has(value);
    if (repeat) reported.add(value);
    seen.add(value);
    return repeat;
  };
}

function validate(input: DeriveFindingsInput): Validated {
  const rejections: DerivationRejection[] = [];

  // Target.
  const targetParsed = TargetExecutionSchema.safeParse(input.target);
  if (!targetParsed.success) rejections.push({ code: "target_invalid", issues: issueStrings(targetParsed.error) });
  const rawTarget = input.target as Partial<TargetExecution> | null | undefined;
  const targetId = rawTarget?.targetId;

  // Entries, by index.
  const entries: { entry: CoverageEntry; level: Level }[] = [];
  const repeatedTest = repeatTracker();
  input.entries.forEach(({ entry, level }, index) => {
    const parsed = CoverageEntrySchema.safeParse(entry);
    if (!parsed.success) rejections.push({ code: "entry_invalid", index, issues: issueStrings(parsed.error) });
    const raw = entry as Partial<CoverageEntry> | null | undefined;
    const test = raw?.test;
    if (typeof test === "string" && repeatedTest(test)) rejections.push({ code: "duplicate_entry", test });
    const enabled = LevelSchema.safeParse(raw?.enabled);
    const lvl = LevelSchema.safeParse(level);
    if (typeof test === "string" && enabled.success && lvl.success && levelRank(lvl.data) > levelRank(enabled.data)) {
      rejections.push({ code: "level_above_enabled", test, level: lvl.data, enabled: enabled.data });
    }
    if (parsed.success && lvl.success) entries.push({ entry: parsed.data, level: lvl.data });
  });

  // Observations, by index.
  const observations: Observation[] = [];
  const repeatedCheck = repeatTracker();
  const repeatedId = repeatTracker();
  input.observations.forEach((obs, index) => {
    const parsed = ObservationSchema.safeParse(obs);
    if (!parsed.success) rejections.push({ code: "observation_invalid", index, issues: issueStrings(parsed.error) });
    const raw = obs as Partial<Observation> | null | undefined;
    if (typeof raw?.targetId === "string" && typeof targetId === "string" && raw.targetId !== targetId) {
      rejections.push({ code: "observation_other_target", observationId: String(raw.id), targetId: raw.targetId });
    }
    if (typeof raw?.checkId === "string" && repeatedCheck(raw.checkId)) {
      rejections.push({ code: "duplicate_observation", checkId: raw.checkId });
    }
    if (typeof raw?.id === "string" && repeatedId(raw.id)) {
      rejections.push({ code: "duplicate_observation_id", observationId: raw.id });
    }
    if (parsed.success) observations.push(parsed.data);
  });
  if (rawTarget?.established === false && input.observations.length > 0) {
    rejections.push({ code: "observations_on_unestablished_target", count: input.observations.length });
  }

  if (!targetParsed.success || rejections.length > 0) return { ok: false, rejections };
  return { ok: true, target: targetParsed.data, entries, observations };
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/** Step 1: a target that was not established. */
function unestablished(ruleset: string, target: TargetExecution, entry: CoverageEntry): Finding {
  return {
    ruleset,
    test: entry.test,
    targetId: target.targetId,
    status: "not_tested",
    reason: target.expect.metBeforeSteps === true ? "expect_already_met" : "target_not_established",
    complete: false,
    notRun: sortedUnique(entry.links.map((l) => l.check)),
    requirementFacts: {},
    observations: [],
  };
}

interface RequirementState {
  links: Link[];
  facts: Set<Fact>;
}

/** Steps 2 to 4 on an established target. */
function deriveOne(
  ruleset: string,
  target: TargetExecution,
  entry: CoverageEntry,
  level: Level,
  observations: readonly Observation[],
): Finding {
  const byCheck = new Map<string, Observation>();
  for (const o of observations) byCheck.set(o.checkId, o);
  const outcome = (l: Link) => byCheck.get(l.check)?.outcome;
  const errs = (l: Link) => {
    const o = outcome(l);
    return o === undefined || o === "error";
  };
  const resolving = (l: Link) => isResolving(entry, l);

  // Steps 2-3: the facts of each requirement.
  const requirements = new Map<string, RequirementState>();
  for (const r of entry.requirements) {
    const links = entry.links.filter((l) => l.requirement === r.id);
    const resolvingLinks = links.filter(resolving);
    // Errored links report nothing, so "reports X" below never matches them.
    const resolvingReports = (o: string) => resolvingLinks.some((l) => outcome(l) === o);
    const failureFault = links.some((l) => l.faultMeans === "failure" && outcome(l) === "fault");

    const error = links.some(errs);
    const dispute =
      (failureFault && (resolvingReports("no_fault") || resolvingReports("inapplicable"))) ||
      (resolvingReports("no_fault") && resolvingReports("inapplicable"));
    const violation = failureFault && !dispute;
    const unresolved =
      resolvingLinks.length === 0 ||
      resolvingReports("cannot_tell") ||
      resolvingLinks.some((l) => l.faultMeans === "evidence_only" && outcome(l) === "fault");
    const blocked = error || dispute || violation || unresolved;
    const satisfied = !blocked && resolvingReports("no_fault");
    const inapplicable = !blocked && resolvingLinks.length > 0 && resolvingLinks.every((l) => outcome(l) === "inapplicable");

    const truth: Record<Fact, boolean> = { error, dispute, violation, unresolved, satisfied, inapplicable };
    requirements.set(r.id, { links, facts: new Set(FACTS.filter((f) => truth[f])) });
  }
  const states = [...requirements.values()];
  const any = (f: Fact) => states.some((r) => r.facts.has(f));

  const needsReviewReason = (): Reason | undefined => {
    if (entry.needs.includes("assistive_tech")) return "assistive_tech_required";
    if (entry.links.length === 0) return "no_check";
    if (level !== "full") return "not_enabled";
    if (unmetPrerequisites(entry.needs, target).length > 0) return "prerequisite_unmet";
    if (any("dispute")) return "checks_disagree";
    const unresolved = states.filter((r) => r.facts.has("unresolved"));
    if (unresolved.length === 0) return undefined;
    if (unresolved.some((r) => r.links.some((l) => outcome(l) === "fault"))) return "alternative_unresolved";
    if (unresolved.some((r) => r.links.some((l) => resolving(l) && outcome(l) === "cannot_tell"))) return "cannot_tell";
    return "alternative_unresolved";
  };

  // Step 4: the test.
  const linkedChecks = sortedUnique(entry.links.map((l) => l.check));
  let status: Status;
  let reason: Reason | undefined;
  if (levelRank(level) >= levelRank("fail_only") && any("violation")) {
    status = "failed";
  } else if (any("error")) {
    status = "not_tested";
    if (linkedChecks.some((c) => !byCheck.has(c))) reason = "missing_observation";
    else if (linkedChecks.some((c) => byCheck.get(c)?.error?.kind === "scope_unreadable")) reason = "scope_unreadable";
    else reason = "check_error";
  } else {
    reason = needsReviewReason();
    if (reason !== undefined) status = "needs_review";
    else if (states.every((r) => r.facts.has("inapplicable"))) {
      if (entry.applicability === "structural") status = "not_applicable";
      else {
        status = "needs_review";
        reason = entry.applicability === "always" ? "cannot_tell" : "judgment_required";
      }
    } else status = "passed";
  }

  const notRun = sortedUnique(entry.links.filter(errs).map((l) => l.check));
  const linked = new Set(linkedChecks);
  const requirementFacts: Record<string, Fact[]> = {};
  for (const [id, r] of requirements) requirementFacts[id] = FACTS.filter((f) => r.facts.has(f));

  return {
    ruleset,
    test: entry.test,
    targetId: target.targetId,
    status,
    ...(reason === undefined ? {} : { reason }),
    complete: notRun.length === 0,
    notRun,
    requirementFacts,
    observations: observations
      .filter((o) => linked.has(o.checkId))
      .map((o) => o.id)
      .sort(),
  };
}
