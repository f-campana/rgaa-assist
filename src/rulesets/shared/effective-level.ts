import { entryHash, levelRank, minLevel, requiredApprovers } from "../../schema/index.ts";
import type {
  ApprovalEvent,
  ApprovalLog,
  CoverageEntry,
  EffectiveLevelBlock,
  EffectiveLevelRecord,
  EvaluationSummary,
  Level,
} from "../../schema/index.ts";

export interface EffectiveLevelInput {
  entry: CoverageEntry;
  /** The ruleset's approval log. Events for other tests are ignored. */
  approvals: ApprovalLog;
  /** The current evaluation summary, or `null` when none exists. */
  evaluation: EvaluationSummary | null;
  /** The version of each check as it would run now, by check id. A check that is not implemented is absent. */
  checkVersions: Readonly<Record<string, string>>;
}

/**
 * The level an entry runs at now (spec 6.3, decisions Q32, Q36). Ruleset-neutral.
 *
 * Let `hash = entryHash(entry)` and `events` = the log's events with
 * `test === entry.test`, in `seq` order.
 *
 * **Authorised level** (`authorised`), from the log alone:
 * - `A` = the last `approval` event in `events`. None: `none`.
 * - If `A.entryHash !== hash`: `none` (edited content runs as none until approved again).
 * - If `A.approvers` lacks a role of `requiredApprovers(entry, A.level)`: `none`.
 * - Otherwise `A.level`, lowered to the lowest `level` of the `demotion` events
 *   after `A` in `events`. Demotions before `A` do not count, and nothing
 *   before `A` ever raises the level. So after a demotion, only a new approval
 *   raises the level again, even when an old record has the same hash and level.
 *
 * **Effective level** (`effective`): the first rule that applies gives
 * `effective: none` and `blockedBy`:
 * 1. `not_enabled`: `entry.enabled` is `none`.
 * 2. `no_approval`: no approval event for this test.
 * 3. `approved_content_differs`: `A.entryHash !== hash`.
 * 4. `approvers_insufficient`: `A` lacks a required role.
 * 5. `enabled_mismatch`: `entry.enabled !== authorised`. An unlogged lowering,
 *    and a raise without approval, both land here. A demotion is logged with a
 *    `demotion` event and the same `enabled` in the entry file.
 * 6. `not_measured`: `evaluation` is `null`, or it has no entry measurement
 *    with `test === entry.test`, or that measurement's `entryHash !== hash`,
 *    or its `level` is below `authorised`.
 * 7. `check_version_unknown`: a check linked by the entry has no version in
 *    `checkVersions`.
 * 8. `check_version_changed`: for a linked check, the measurement's
 *    `checkVersions` has no version or a different one from `checkVersions`.
 * 9. `corpus_cases_failing`: the measurement has no case, or a case with
 *    `matched: false`.
 * Otherwise `effective = authorised` and `blockedBy = null`.
 *
 * A check-version suspension (rules 7-9) needs no new approval: once a
 * measurement on the new version passes, the entry runs at `authorised`
 * again. It never restores more than `authorised`, so it never undoes a
 * demotion and never authorises edited content.
 *
 * The result's `test` and `enabled` are copied from the entry.
 */
export function effectiveLevel(input: EffectiveLevelInput): EffectiveLevelRecord {
  const { entry, approvals, evaluation, checkVersions } = input;
  const hash = entryHash(entry);
  const events = approvals.events.filter((e) => e.test === entry.test).sort((a, b) => a.seq - b.seq);

  // The last approval, and the events after it.
  let lastIndex = -1;
  events.forEach((e, i) => {
    if (e.kind === "approval") lastIndex = i;
  });
  const approval = lastIndex < 0 ? undefined : (events[lastIndex] as ApprovalEvent);
  const contentDiffers = approval !== undefined && approval.entryHash !== hash;
  const approversInsufficient =
    approval !== undefined && !requiredApprovers(entry, approval.level).every((r) => approval.approvers.some((a) => a.role === r));

  let authorised: Level = "none";
  if (approval !== undefined && !contentDiffers && !approversInsufficient) {
    authorised = approval.level;
    for (const e of events.slice(lastIndex + 1)) {
      if (e.kind === "demotion") authorised = minLevel(authorised, e.level);
    }
  }

  const blocked = (blockedBy: EffectiveLevelBlock): EffectiveLevelRecord => ({
    test: entry.test,
    enabled: entry.enabled,
    authorised,
    effective: "none",
    blockedBy,
  });

  if (entry.enabled === "none") return blocked("not_enabled");
  if (approval === undefined) return blocked("no_approval");
  if (contentDiffers) return blocked("approved_content_differs");
  if (approversInsufficient) return blocked("approvers_insufficient");
  if (entry.enabled !== authorised) return blocked("enabled_mismatch");

  const measurement = evaluation?.entries.find((m) => m.test === entry.test);
  if (measurement === undefined || measurement.entryHash !== hash || levelRank(measurement.level) < levelRank(authorised)) {
    return blocked("not_measured");
  }
  const linked = [...new Set(entry.links.map((l) => l.check))];
  if (linked.some((c) => checkVersions[c] === undefined)) return blocked("check_version_unknown");
  if (linked.some((c) => measurement.checkVersions[c] === undefined || measurement.checkVersions[c] !== checkVersions[c])) {
    return blocked("check_version_changed");
  }
  if (measurement.cases.length === 0 || measurement.cases.some((c) => !c.matched)) return blocked("corpus_cases_failing");

  return { test: entry.test, enabled: entry.enabled, authorised, effective: authorised, blockedBy: null };
}
