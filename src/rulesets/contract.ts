/**
 * The ruleset plug-in contract (spec 5.2). Frozen at the end of M1; changing
 * it goes through the orchestrator (14.2).
 *
 * A plug-in maps check outcomes to its own tests through its coverage map and
 * owns the rules for combining results (5.1). The functions that are not
 * specific to one ruleset live in `src/rulesets/shared/` and are reused by
 * every plug-in.
 *
 * Claim boundary (spec 2): nothing here computes or carries a conformance
 * rate, a score or a verdict. A status is about one test on one examined
 * target, or a reduction of such statuses.
 */
import type {
  ApprovalLog,
  CheckRegistry,
  CoverageEntry,
  CriterionId,
  Finding,
  Level,
  Observation,
  Prerequisite,
  Reason,
  ReducedResults,
  SampleFile,
  SampleWarning,
  Status,
  TargetExecution,
  TestId,
} from "../schema/index.ts";

// ---------------------------------------------------------------------------
// Prerequisites (spec 8.3, open point 17.1, fixed by the orchestrator in M1)
// ---------------------------------------------------------------------------

/**
 * When each prerequisite in an entry's `needs` counts as met on a target.
 * A test whose `needs` holds an unmet prerequisite cannot be `passed` or
 * `not_applicable` on that target (8.3 step 4.3).
 *
 * The engine lists what it met in `TargetExecution.prerequisitesMet`.
 * Derivation does not trust that list alone: it applies these meanings again.
 */
export const PREREQUISITE_MEANING: Readonly<Record<Prerequisite, string>> = {
  state:
    "Met on a target only when it is an established declared state other than `initial`. " +
    "So a test that needs `state` is needs_review with prerequisite_unmet on every `initial` target, " +
    "and a page is never passed or not_applicable for that test on the strength of a declared state alone: " +
    "the page's `initial` target is needs_review, and reduction over the page's targets keeps that.",
  keyboard:
    "Met on a target only when the engine completed its keyboard pass on it: focus moved through the tab " +
    "sequence and the sequence was recorded. No such pass exists yet, so it is unmet until one is built.",
  media:
    "Met on a target only when the engine completed a timed observation pass on it, with media allowed to play. " +
    "No such pass exists yet, so it is unmet until one is built.",
  model:
    "Met only to produce model suggestions (spec 9). For deriving a status it is never met, " +
    "so a test that needs `model` is never passed or not_applicable.",
  assistive_tech: "Never met in v1 (spec 15).",
};

// The executable form of these meanings, for deriving a status, is
// `prerequisiteMetForStatus` in `shared/prerequisites.ts`.

// ---------------------------------------------------------------------------
// Official data, typed (spec 5.2, 13)
// ---------------------------------------------------------------------------

/** Where the vendored official files come from. */
export interface OfficialSource {
  /** `DISIC/accessibilite.numerique.gouv.fr` */
  repository: string;
  /** `RGAA/` */
  path: string;
  /** The recorded source commit. */
  commit: string;
  /** `YYYY-MM-DD` */
  fetched: string;
  licence: string;
  attribution: string;
}

/**
 * A paragraph of a criterion's particular cases or technical note, as in
 * `criteres.json`: a string, or a bulleted list `{ ul: [...] }` whose items
 * keep their leading `- `. Never rewritten.
 */
export type OfficialBlock = string | { ul: string[] };

export interface OfficialTheme {
  /** 1 to 13. */
  number: number;
  name: string;
  /** Criterion ids in official order. */
  criteria: CriterionId[];
}

export interface OfficialCriterion {
  /** `1.1` */
  id: CriterionId;
  theme: number;
  number: number;
  /** French, as published, with its Markdown links. */
  title: string;
  /** Test ids in official order. */
  tests: TestId[];
  /** Empty when the criterion has none. */
  particularCases: OfficialBlock[];
  /** Empty when the criterion has none. */
  technicalNote: OfficialBlock[];
  references: { wcag: string[]; techniques: string[] };
}

export interface OfficialTest {
  /** `1.1.6` */
  id: TestId;
  criterion: CriterionId;
  number: number;
  /** The question, then each condition, exactly as in `criteres.json`. Line 1 is `lines[0]`. */
  lines: string[];
  /** The methodology from `methodologies.json`, exactly. */
  methodology: string;
}

export interface GlossaryEntry {
  /** Exact title from `glossaire.json`. Unique. */
  title: string;
  /** HTML, exactly as stored. */
  body: string;
}

/** The official data of a ruleset, typed. Maps iterate in official order. */
export interface OfficialData {
  source: OfficialSource;
  /** WCAG version the ruleset is based on, `2.1` for RGAA 4.1.2. */
  wcagVersion: string;
  themes: readonly OfficialTheme[];
  criteria: ReadonlyMap<CriterionId, OfficialCriterion>;
  tests: ReadonlyMap<TestId, OfficialTest>;
  /** By exact title. */
  glossary: ReadonlyMap<string, GlossaryEntry>;
}

// ---------------------------------------------------------------------------
// Coverage map
// ---------------------------------------------------------------------------

export interface CoverageMap {
  /** By test id, in official order. Each entry has passed `validateEntry` against `checks`. */
  entries: ReadonlyMap<TestId, CoverageEntry>;
  checks: CheckRegistry;
  approvals: ApprovalLog;
}

// ---------------------------------------------------------------------------
// deriveFindings (spec 8.3)
// ---------------------------------------------------------------------------

export interface DeriveFindingsInput {
  /** Copied into each `Finding.ruleset`. */
  ruleset: string;
  /** The target, established or not. */
  target: TargetExecution;
  /**
   * Every observation recorded on this target. Observations of checks that no
   * given entry links are ignored. Must be empty when the target was not
   * established (7.4: nothing is examined on such a target).
   */
  observations: readonly Observation[];
  /**
   * The entries to derive, each with the level it runs at in this run (the
   * result of `effectiveLevel`). `level` is never above `entry.enabled`.
   */
  entries: readonly { entry: CoverageEntry; level: Level }[];
}

/**
 * Why an input was rejected. Derivation is all-or-nothing: when any rejection
 * exists, no finding is derived for any entry.
 */
export type DerivationRejection =
  /** `target` fails `TargetExecutionSchema`. */
  | { code: "target_invalid"; issues: string[] }
  /** `entries[index].entry` fails `CoverageEntrySchema` (for example it has no requirement). */
  | { code: "entry_invalid"; index: number; issues: string[] }
  /** Two entries for the same test. */
  | { code: "duplicate_entry"; test: TestId }
  /** `entries[index].level` is above that entry's `enabled`. */
  | { code: "level_above_enabled"; test: TestId; level: Level; enabled: Level }
  /** `observations[index]` fails `ObservationSchema`. */
  | { code: "observation_invalid"; index: number; issues: string[] }
  /** An observation whose `targetId` is not `target.targetId`. */
  | { code: "observation_other_target"; observationId: string; targetId: string }
  /** Two observations from the same check on this target. */
  | { code: "duplicate_observation"; checkId: string }
  /** Two observations with the same id. */
  | { code: "duplicate_observation_id"; observationId: string }
  /** Observations given for a target that was not established. */
  | { code: "observations_on_unestablished_target"; count: number };

/**
 * The result of `deriveFindings`. A typed result, not a thrown error: a
 * rejection is expected data, and the caller records it.
 *
 * On success, one finding per given entry, sorted by test id in official
 * (numeric, segment by segment) order. Each finding passes `FindingSchema`.
 */
export type DeriveFindingsResult =
  | { ok: true; findings: Finding[] }
  | { ok: false; rejections: DerivationRejection[] };

/** Signature of `deriveFindings`; the shared implementation is in `shared/derive.ts`. */
export type DeriveFindings = (input: DeriveFindingsInput) => DeriveFindingsResult;

// ---------------------------------------------------------------------------
// reduce (spec 8.4)
// ---------------------------------------------------------------------------

/** One result entering the ordered rule. A finding enters with `reasons` = its reason, or none. */
export interface ReductionItem {
  status: Status;
  reasons: readonly Reason[];
  complete: boolean;
  notRun: readonly string[];
}

/** What the ordered rule gives for a set. */
export interface ReductionOutcome {
  status: Status;
  /** Distinct reasons of the items whose status equals `status`, sorted. Empty for passed, failed, not_applicable. */
  reasons: Reason[];
  /** Every item complete. */
  complete: boolean;
  /** Union of the items' `notRun`, sorted, unique. */
  notRun: string[];
}

/** Signature of `reduceSet`; implemented in `shared/reduce.ts`. */
export type ReduceSet = (items: readonly ReductionItem[]) => { ok: true; outcome: ReductionOutcome } | { ok: false; error: { code: "empty_set" } };

export interface ReduceInput {
  /** Copied into `ReducedResults.ruleset`. Findings of other rulesets are an error. */
  ruleset: string;
  /** Every criterion with its tests, in official order. */
  criteria: readonly { id: CriterionId; tests: readonly TestId[] }[];
  /** Gives the declared targets, the pages and the processes. */
  sample: SampleFile;
  /** One per declared target. */
  targets: readonly TargetExecution[];
  /** One per declared target and test of `criteria`, as returned by `deriveFindings`. */
  findings: readonly Finding[];
}

/** Why reduction was refused. All-or-nothing, like derivation. */
export type ReductionError =
  /** A declared target (`<page>/initial` or `<page>/<state>`) has no `TargetExecution`. */
  | { code: "missing_target"; targetId: string }
  /** A `TargetExecution` or a finding for a target the sample does not declare. */
  | { code: "unknown_target"; targetId: string }
  /** No finding for a test of `criteria` on a declared target. */
  | { code: "missing_finding"; test: TestId; targetId: string }
  /** Two findings for the same test and target, or two executions of one target. */
  | { code: "duplicate"; test?: TestId; targetId: string }
  /** A finding whose `ruleset` is not `ruleset`, or whose test is not in `criteria`. */
  | { code: "foreign_finding"; test: string; targetId: string }
  /** A set to reduce was empty. It never reduces to passed or not_applicable (8.4). */
  | { code: "empty_set"; level: "criterion_on_target" | "criterion_on_page" | "criterion_on_page_in_process" | "criterion_on_sample"; criterion: CriterionId; at: string };

export type ReduceResult = { ok: true; reduced: ReducedResults } | { ok: false; errors: ReductionError[] };

/** Signature of `reduce`; the shared implementation is in `shared/reduce.ts`. */
export type Reduce = (input: ReduceInput) => ReduceResult;

// ---------------------------------------------------------------------------
// The plug-in
// ---------------------------------------------------------------------------

export interface RulesetPlugin {
  /** `rgaa-4.1.2` */
  readonly id: string;
  /** `4.1.2` */
  readonly version: string;
  /** Criteria, tests, glossary and methodology in the official wording and language (Q26). */
  readonly official: OfficialData;
  readonly coverage: CoverageMap;
  /** Spec 8.3. `input.ruleset` is this plug-in's id. */
  deriveFindings(input: Omit<DeriveFindingsInput, "ruleset">): DeriveFindingsResult;
  /** Spec 8.4. `ruleset` and `criteria` come from this plug-in. */
  reduce(input: Omit<ReduceInput, "ruleset" | "criteria">): ReduceResult;
  /** Spec 7.5. Warnings only; never blocks a run. */
  checkSample(sample: SampleFile): SampleWarning[];
}
