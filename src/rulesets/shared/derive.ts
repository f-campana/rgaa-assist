import type { DeriveFindingsInput, DeriveFindingsResult } from "../contract.ts";
import { NotImplementedError } from "./not-implemented.ts";

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
 *    `applicability` is `structural`; otherwise `needs_review` with reason
 *    `judgment_required`.
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
  void input;
  throw new NotImplementedError("deriveFindings");
}
