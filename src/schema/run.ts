/**
 * The run file (spec 8.2, 8.4, 8.5, 8.8) and the records it holds.
 *
 * Field names follow spec 8.5. Additions are marked "Added:" with the reason.
 * Arrays are sorted by stable keys when written (8.8); the sort keys are given
 * on each array.
 */
import { z } from "zod";
import {
  CheckIdSchema,
  CriterionIdSchema,
  DateTimeSchema,
  FACTS,
  FactSchema,
  INITIAL_STATE_ID,
  LevelSchema,
  LocalIdSchema,
  PrerequisiteSchema,
  ReasonSchema,
  Sha256Schema,
  SizeSchema,
  StatusSchema,
  TargetIdSchema,
  TestIdSchema,
  TextSchema,
  duplicates,
  reasonFitsStatus,
  splitTargetId,
} from "./common.ts";
import { EffectiveLevelBlockSchema } from "./evaluation.ts";
import { FixedPageKindSchema, SampleFileSchema, STEP_ACTIONS } from "./sample.ts";
import { StatementsSchema } from "./statements.ts";

// ---------------------------------------------------------------------------
// Target execution (7.4, 8.5)
// ---------------------------------------------------------------------------

export const TargetExecutionSchema = z
  .strictObject({
    /** `<pageId>/<stateId>`; the page as loaded is `<pageId>/initial`. */
    targetId: TargetIdSchema,
    /** Sanitised (8.7). */
    requestedUrl: TextSchema,
    /** Sanitised. */
    effectiveUrl: TextSchema,
    viewport: z.strictObject({ requested: SizeSchema, applied: SizeSchema }),
    /** The saved session was loaded into this target's context. Protection follows this flag (8.7). */
    sessionLoaded: z.boolean(),
    /**
     * Which `needs` values the engine met on this target. Their meaning is
     * `PREREQUISITE_MEANING` in `src/rulesets/contract.ts`. Never
     * `assistive_tech` in v1. `state` only on an established target whose
     * state is not `initial`.
     */
    prerequisitesMet: z.array(PrerequisiteSchema),
    steps: z.array(
      z.strictObject({
        action: z.enum(STEP_ACTIONS),
        ok: z.boolean(),
        /** Sanitised. Only when `ok` is false. */
        error: TextSchema.optional(),
      }),
    ),
    expect: z.strictObject({
      declared: z.boolean(),
      /** `expect` evaluated on the page as loaded, before the steps (7.3). `null` when not declared or not evaluated. */
      metBeforeSteps: z.boolean().nullable(),
      /** `expect` after the steps. `null` when not declared or not reached. */
      met: z.boolean().nullable(),
    }),
    established: z.boolean(),
  })
  .superRefine((t, ctx) => {
    if (!t.targetId.includes("/")) return; // already reported by the targetId pattern
    const { stateId } = splitTargetId(t.targetId);
    for (const p of duplicates(t.prerequisitesMet)) {
      ctx.addIssue({ code: "custom", path: ["prerequisitesMet"], message: `listed twice: ${p}` });
    }
    if (t.prerequisitesMet.includes("assistive_tech")) {
      ctx.addIssue({ code: "custom", path: ["prerequisitesMet"], message: "v1 never meets assistive_tech" });
    }
    if (t.prerequisitesMet.includes("state") && (stateId === INITIAL_STATE_ID || !t.established)) {
      ctx.addIssue({
        code: "custom",
        path: ["prerequisitesMet"],
        message: "state is met only on an established declared state other than initial",
      });
    }
    t.steps.forEach((s, i) => {
      if (s.ok && s.error !== undefined) {
        ctx.addIssue({ code: "custom", path: ["steps", i, "error"], message: "a step that succeeded has no error" });
      }
    });
    if (!t.expect.declared && (t.expect.met !== null || t.expect.metBeforeSteps !== null)) {
      ctx.addIssue({ code: "custom", path: ["expect"], message: "an undeclared expect has no outcome" });
    }
    if (t.established) {
      if (t.steps.some((s) => !s.ok)) {
        ctx.addIssue({ code: "custom", path: ["established"], message: "a target with a failed step is not established" });
      }
      if (t.expect.declared && (t.expect.met !== true || t.expect.metBeforeSteps === true)) {
        ctx.addIssue({
          code: "custom",
          path: ["established"],
          message: "an established target met its expect after the steps and not before them",
        });
      }
    }
  });
export type TargetExecution = z.infer<typeof TargetExecutionSchema>;

// ---------------------------------------------------------------------------
// Evidence and observations (8.5)
// ---------------------------------------------------------------------------

export const EvidenceKindSchema = z.enum([
  "dom_node",
  "screenshot",
  "computed_value",
  "accessibility_node",
  "text",
  "scope_examined",
  "tool_output",
]);

export const EvidenceSchema = z.strictObject({
  id: TextSchema,
  kind: EvidenceKindSchema,
  locator: TextSchema.optional(),
  /** Sanitised, length-capped. */
  snippet: z.string().optional(),
  /** Path inside the run folder. */
  file: TextSchema.optional(),
  sha256: Sha256Schema.optional(),
  note: z.string().optional(),
  /** How many values were masked (8.7). */
  redactions: z.int().nonnegative().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const OutcomeSchema = z.enum(["fault", "no_fault", "inapplicable", "cannot_tell", "error"]);
export type Outcome = z.infer<typeof OutcomeSchema>;

/**
 * What one check saw on one target. At most one observation per check per
 * target.
 *
 * Meaning of the outcomes (8.3, fixed where a check's result enters the engine):
 * - `no_fault`: the check examined at least one element the requirement
 *   applies to and found no fault on any. Never on an empty scope.
 * - `inapplicable`: the check looked through the whole examined scope and
 *   found no element the requirement applies to.
 * - `cannot_tell`: the check could not decide (a resolving check abstains
 *   this way when it cannot examine a route, an exception or part of the scope).
 * - `error`: the check failed. `error.kind` says how.
 */
export const ObservationSchema = z
  .strictObject({
    id: TextSchema,
    checkId: CheckIdSchema,
    checkVersion: TextSchema,
    /** Effective options. */
    options: z.record(z.string(), z.unknown()),
    targetId: TargetIdSchema,
    outcome: OutcomeSchema,
    /** Sorted by `id`. */
    evidence: z.array(EvidenceSchema),
    /** The same fault elsewhere gives the same value. Grouping is display only. */
    fingerprint: TextSchema,
    /**
     * Added: present exactly when `outcome` is `error`. `scope_unreadable`
     * when part of the scope could not be read (for example a frame), so that
     * derivation can give the `scope_unreadable` reason (8.2); otherwise
     * `check_error`. The message is sanitised.
     */
    error: z.strictObject({ kind: z.enum(["check_error", "scope_unreadable"]), message: TextSchema }).optional(),
  })
  .superRefine((o, ctx) => {
    if ((o.outcome === "error") !== (o.error !== undefined)) {
      ctx.addIssue({ code: "custom", path: ["error"], message: "error is present exactly when outcome is error" });
    }
    if (o.outcome === "fault" && o.evidence.length === 0) {
      ctx.addIssue({ code: "custom", path: ["evidence"], message: "a fault carries evidence" });
    }
    if ((o.outcome === "no_fault" || o.outcome === "inapplicable") && !o.evidence.some((e) => e.kind === "scope_examined")) {
      ctx.addIssue({
        code: "custom",
        path: ["evidence"],
        message: `${o.outcome} carries scope_examined evidence: what was examined (8.3, 8.5)`,
      });
    }
    for (const id of duplicates(o.evidence.map((e) => e.id))) {
      ctx.addIssue({ code: "custom", path: ["evidence"], message: `duplicate evidence id: ${id}` });
    }
  });
export type Observation = z.infer<typeof ObservationSchema>;

// ---------------------------------------------------------------------------
// Findings (8.3, 8.5) and model suggestions (9)
// ---------------------------------------------------------------------------

export const ModelSuggestionSchema = z.strictObject({
  provider: TextSchema,
  model: TextSchema,
  promptVersion: TextSchema,
  schemaVersion: TextSchema,
  proposedStatus: z.enum(["passed", "failed", "not_applicable"]),
  rationale: TextSchema,
  /** Evidence ids that left the machine. */
  evidenceSent: z.array(TextSchema),
});
export type ModelSuggestion = z.infer<typeof ModelSuggestionSchema>;

/**
 * The status of one test on one target.
 *
 * - `reason` is present exactly for `needs_review` and `not_tested`, from that
 *   status's own list (8.2).
 * - `notRun`: the linked check ids whose observation is missing or has outcome
 *   `error`, sorted, unique. On a target that was not established, every
 *   linked check id. A non-empty `notRun` means `complete` is false.
 * - `complete` is false also on a target that was not established.
 * - `requirementFacts`: one key per requirement of the entry, each listing
 *   every true fact of 8.3 in the order of `FACTS`. `satisfied` and
 *   `inapplicable` are never listed with another fact; `violation` is never
 *   listed with `dispute`. Empty object on a target that was not established.
 * - `observations`: ids of the observations of the linked checks on this
 *   target, sorted. Advisory faults stay here as evidence.
 * - `suggestion`: only on `needs_review`. It never affects the status (9).
 */
export const FindingSchema = z
  .strictObject({
    ruleset: TextSchema,
    test: TestIdSchema,
    targetId: TargetIdSchema,
    status: StatusSchema,
    reason: ReasonSchema.optional(),
    complete: z.boolean(),
    notRun: z.array(CheckIdSchema),
    requirementFacts: z.record(LocalIdSchema, z.array(FactSchema)),
    observations: z.array(TextSchema),
    suggestion: ModelSuggestionSchema.optional(),
  })
  .superRefine((f, ctx) => {
    if (!reasonFitsStatus(f.status, f.reason)) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: `reason ${f.reason ?? "(none)"} does not fit status ${f.status}`,
      });
    }
    if (f.notRun.length > 0 && f.complete) {
      ctx.addIssue({ code: "custom", path: ["complete"], message: "a finding with checks that did not run is incomplete" });
    }
    if (f.status === "not_tested" && (f.reason === "target_not_established" || f.reason === "expect_already_met") && f.complete) {
      ctx.addIssue({ code: "custom", path: ["complete"], message: "a target that was not established is incomplete" });
    }
    if (f.suggestion !== undefined && f.status !== "needs_review") {
      ctx.addIssue({ code: "custom", path: ["suggestion"], message: "a model suggestion is stored only on needs_review (9)" });
    }
    for (const [req, facts] of Object.entries(f.requirementFacts)) {
      const order = facts.map((x) => FACTS.indexOf(x));
      if (order.some((v, i) => i > 0 && v <= (order[i - 1] ?? -1))) {
        ctx.addIssue({ code: "custom", path: ["requirementFacts", req], message: "facts are unique and in FACTS order" });
      }
      if ((facts.includes("satisfied") || facts.includes("inapplicable")) && facts.length > 1) {
        ctx.addIssue({
          code: "custom",
          path: ["requirementFacts", req],
          message: "satisfied and inapplicable hold only when no other fact does",
        });
      }
      if (facts.includes("violation") && facts.includes("dispute")) {
        ctx.addIssue({ code: "custom", path: ["requirementFacts", req], message: "a violation needs no dispute" });
      }
    }
  });
export type Finding = z.infer<typeof FindingSchema>;

// ---------------------------------------------------------------------------
// Reduced results (8.4)
// ---------------------------------------------------------------------------

/**
 * What every reduced result holds.
 * - `reasons`: the distinct reasons of the inputs whose status equals the
 *   result's status, sorted; empty for `passed`, `failed`, `not_applicable`.
 * - `complete`: every input complete and nothing missing.
 * - `notRun`: union of the inputs' `notRun`, sorted, unique.
 */
const reducedBase = {
  criterion: CriterionIdSchema,
  status: StatusSchema,
  reasons: z.array(ReasonSchema),
  complete: z.boolean(),
  notRun: z.array(CheckIdSchema),
};

function refineReduced(r: { status: z.infer<typeof StatusSchema>; reasons: z.infer<typeof ReasonSchema>[] }, ctx: z.RefinementCtx): void {
  const needsReasons = r.status === "needs_review" || r.status === "not_tested";
  if (needsReasons !== r.reasons.length > 0 || !r.reasons.every((x) => reasonFitsStatus(r.status, x))) {
    ctx.addIssue({ code: "custom", path: ["reasons"], message: `reasons do not fit status ${r.status}` });
  }
}

/** Level 1: a criterion on a target, over the criterion's tests on that target. Sorted by criterion, then target. */
export const CriterionOnTargetSchema = z
  .strictObject({ ...reducedBase, targetId: TargetIdSchema, tests: z.array(TestIdSchema).min(1) })
  .superRefine(refineReduced);

/** Level 2: a criterion on a page, over the page's targets (`initial` and every declared state). */
export const CriterionOnPageSchema = z
  .strictObject({ ...reducedBase, pageId: LocalIdSchema, targets: z.array(TargetIdSchema).min(1) })
  .superRefine(refineReduced);

/**
 * Level 3: a criterion on a page, process-aware. For a page in a process, over
 * the level-2 results of every page of that process (of every process that
 * lists it). For a page in no process, the same as level 2 with `processes`
 * empty. A declared step that is missing from the sample or whose `initial`
 * target was not established counts as one `not_tested` result
 * (`target_not_established`) and is named in `missingSteps`.
 */
export const CriterionOnPageInProcessSchema = z
  .strictObject({
    ...reducedBase,
    pageId: LocalIdSchema,
    processes: z.array(LocalIdSchema),
    /** Pages reduced over, in process order, this page included. */
    pages: z.array(LocalIdSchema).min(1),
    missingSteps: z.array(LocalIdSchema),
  })
  .superRefine((r, ctx) => {
    refineReduced(r, ctx);
    if (r.missingSteps.length > 0 && r.complete) {
      ctx.addIssue({ code: "custom", path: ["complete"], message: "a result with a missing step is incomplete" });
    }
  });

/** Level 4: a criterion on the sample, over the process-aware results of all pages. */
export const CriterionOnSampleSchema = z
  .strictObject({ ...reducedBase, pages: z.array(LocalIdSchema).min(1) })
  .superRefine(refineReduced);

export const ReducedResultsSchema = z.strictObject({
  ruleset: TextSchema,
  criterionOnTarget: z.array(CriterionOnTargetSchema),
  criterionOnPage: z.array(CriterionOnPageSchema),
  criterionOnPageInProcess: z.array(CriterionOnPageInProcessSchema),
  criterionOnSample: z.array(CriterionOnSampleSchema),
});
export type CriterionOnTarget = z.infer<typeof CriterionOnTargetSchema>;
export type CriterionOnPage = z.infer<typeof CriterionOnPageSchema>;
export type CriterionOnPageInProcess = z.infer<typeof CriterionOnPageInProcessSchema>;
export type CriterionOnSample = z.infer<typeof CriterionOnSampleSchema>;
export type ReducedResults = z.infer<typeof ReducedResultsSchema>;

// ---------------------------------------------------------------------------
// Sample warnings (7.5)
// ---------------------------------------------------------------------------

export const SampleWarningSchema = z.discriminatedUnion("code", [
  /** A fixed kind that is neither present nor listed in `absentKinds`. */
  z.strictObject({ code: z.literal("fixed_kind_missing"), kind: FixedPageKindSchema }),
  /** A declared service with no page. */
  z.strictObject({ code: z.literal("service_without_page"), service: LocalIdSchema }),
  /** A declared process with a step that is not in `pages`. */
  z.strictObject({ code: z.literal("process_step_not_in_pages"), process: LocalIdSchema, step: LocalIdSchema }),
  /** A `process_step` page that belongs to no declared process. */
  z.strictObject({ code: z.literal("process_step_without_process"), page: LocalIdSchema }),
  /**
   * Fewer random pages than 10% of the other pages, rounded up. A page counts
   * as random only when `random` is its only kind. Pages, not states.
   */
  z.strictObject({
    code: z.literal("too_few_random_pages"),
    randomPages: z.int().nonnegative(),
    otherPages: z.int().nonnegative(),
    required: z.int().positive(),
  }),
]);
export type SampleWarning = z.infer<typeof SampleWarningSchema>;

// ---------------------------------------------------------------------------
// Manifest (8.8)
// ---------------------------------------------------------------------------

export const ManifestSchema = z.strictObject({
  toolVersion: TextSchema,
  rulesets: z
    .array(
      z.strictObject({
        id: TextSchema,
        version: TextSchema,
        sourceCommit: TextSchema,
        coverageMapHash: Sha256Schema,
        /** `null` when no evaluation summary exists yet. */
        evaluationSummaryHash: Sha256Schema.nullable(),
        /** Added: hash of the approval log used to compute effective levels (6.3). */
        approvalLogHash: Sha256Schema,
      }),
    )
    .min(1),
  versions: z.strictObject({ axeCore: TextSchema, playwright: TextSchema, browser: TextSchema }),
  os: TextSchema,
  locale: TextSchema,
  /** Effective timeouts in milliseconds, by name. */
  timeouts: z.record(z.string(), z.int().nonnegative()),
  /** Effective options by check id. */
  checkOptions: z.record(CheckIdSchema, z.record(z.string(), z.unknown())),
  sampleFileHash: Sha256Schema,
  startedAt: DateTimeSchema,
  endedAt: DateTimeSchema,
  /** `null` when no model is used. */
  model: z
    .strictObject({ provider: TextSchema, model: TextSchema, promptVersion: TextSchema, schemaVersion: TextSchema })
    .nullable(),
});
export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Added: the level each test ran at in this run, so a report can say what the
 * tool was allowed to conclude at the time (6.3). `blockedBy` is `null` exactly
 * when `effective` is not `none`.
 */
export const EffectiveLevelRecordSchema = z
  .strictObject({
    test: TestIdSchema,
    enabled: LevelSchema,
    authorised: LevelSchema,
    effective: LevelSchema,
    blockedBy: EffectiveLevelBlockSchema.nullable(),
  })
  .refine((r) => (r.blockedBy === null) === (r.effective !== "none"), {
    message: "blockedBy is null exactly when the entry runs above none",
    path: ["blockedBy"],
  });
export type EffectiveLevelRecord = z.infer<typeof EffectiveLevelRecordSchema>;

// ---------------------------------------------------------------------------
// The run file (8.8)
// ---------------------------------------------------------------------------

export const RunFileSchema = z.strictObject({
  schemaVersion: z.literal(1),
  statements: StatementsSchema,
  manifest: ManifestSchema,
  /** The sample after sanitisation (8.7). */
  sample: SampleFileSchema,
  /** Separate from the targets examined (7.5). */
  sampleWarnings: z.array(SampleWarningSchema),
  /** Sorted by `targetId`. */
  targets: z.array(TargetExecutionSchema),
  /** Sorted by `targetId`, then `checkId`. */
  observations: z.array(ObservationSchema),
  /** Per ruleset, sorted by test in official order. */
  effectiveLevels: z.array(z.strictObject({ ruleset: TextSchema, levels: z.array(EffectiveLevelRecordSchema) })),
  /** Sorted by ruleset, test in official order, then `targetId`. */
  findings: z.array(FindingSchema),
  /** One per ruleset. */
  reduced: z.array(ReducedResultsSchema),
  /** Sorted by `path`. */
  evidenceFiles: z.array(z.strictObject({ path: TextSchema, sha256: Sha256Schema })),
  /** Added (9): every piece of evidence sent to a model, and to which provider and model. Sorted by `evidenceId`. */
  modelDisclosures: z.array(z.strictObject({ evidenceId: TextSchema, provider: TextSchema, model: TextSchema })),
});
export type RunFile = z.infer<typeof RunFileSchema>;
