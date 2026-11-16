/**
 * Shared vocabulary of rgaa-assist (spec 3, 6.1, 8.2, 8.3).
 *
 * Claim boundary (spec 2): nothing in this module, or in any schema built on
 * it, holds or implies a conformance rate, a score or a verdict. Statuses
 * describe one test on one examined target, or a reduction of such results.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

/** A test id such as `1.1.6`: theme, criterion, test, each 1 or 2 digits. */
export const TestIdSchema = z.string().regex(/^[1-9]\d?\.[1-9]\d?\.[1-9]\d?$/, "a test id such as 1.1.6");
export type TestId = z.infer<typeof TestIdSchema>;

/** A criterion id such as `1.1`. */
export const CriterionIdSchema = z.string().regex(/^[1-9]\d?\.[1-9]\d?$/, "a criterion id such as 1.1");
export type CriterionId = z.infer<typeof CriterionIdSchema>;

/**
 * A local id written by a person inside one file: a page, a state, a service,
 * a process, a requirement, a route or an exception. It never contains `/`,
 * because a target id is `<pageId>/<stateId>`.
 */
export const LocalIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "letters, digits, '.', '_' or '-', starting with a letter or digit");
export type LocalId = z.infer<typeof LocalIdSchema>;

/** The id of the state that is the page as loaded (spec 3). Never declared in a sample. */
export const INITIAL_STATE_ID = "initial";

/** A target id: `<pageId>/<stateId>` (spec 8.5). */
export const TargetIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/, "a target id such as home/initial");
export type TargetId = z.infer<typeof TargetIdSchema>;

/** Split a target id into its page id and state id. */
export function splitTargetId(targetId: string): { pageId: string; stateId: string } {
  const i = targetId.indexOf("/");
  if (i < 0) throw new Error(`not a target id: ${targetId}`);
  return { pageId: targetId.slice(0, i), stateId: targetId.slice(i + 1) };
}

/**
 * A check id: `<kind>/<name>`, for example `axe/object-alt` or
 * `custom/object-image-alternatives`. The prefix is the check's kind, so the
 * kind of a linked check is known from its id alone.
 */
export const CheckKindSchema = z.enum(["axe", "custom", "model"]);
export type CheckKind = z.infer<typeof CheckKindSchema>;
export const CheckIdSchema = z
  .string()
  .regex(/^(axe|custom|model)\/[a-z0-9][a-z0-9-]*$/, "a check id such as axe/object-alt");
export type CheckId = z.infer<typeof CheckIdSchema>;

/** The kind encoded in a check id's prefix, or `undefined` when the prefix is not a kind. */
export function checkKindOf(checkId: string): CheckKind | undefined {
  const r = CheckKindSchema.safeParse(checkId.slice(0, Math.max(0, checkId.indexOf("/"))));
  return r.success ? r.data : undefined;
}

/** A lowercase hex sha256 digest, 64 characters. */
export const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, "a lowercase hex sha256");

/** An ISO 8601 date-time with an offset or `Z`. */
export const DateTimeSchema = z.iso.datetime({ offset: true });

/** An ISO 8601 calendar date, `YYYY-MM-DD`. */
export const DateSchema = z.iso.date();

/** A non-empty string that is not only whitespace. */
export const TextSchema = z.string().refine((s) => s.trim().length > 0, "must not be empty");

export const SizeSchema = z.strictObject({
  width: z.int().positive(),
  height: z.int().positive(),
});
export type Size = z.infer<typeof SizeSchema>;

// ---------------------------------------------------------------------------
// Statuses and reasons (spec 8.2)
// ---------------------------------------------------------------------------

export const STATUSES = ["passed", "failed", "not_applicable", "needs_review", "not_tested"] as const;
export const StatusSchema = z.enum(STATUSES);
export type Status = z.infer<typeof StatusSchema>;

export const NEEDS_REVIEW_REASONS = [
  "no_check",
  "not_enabled",
  "judgment_required",
  "alternative_unresolved",
  "cannot_tell",
  "checks_disagree",
  "prerequisite_unmet",
  "assistive_tech_required",
  "model_disabled",
] as const;
export const NeedsReviewReasonSchema = z.enum(NEEDS_REVIEW_REASONS);
export type NeedsReviewReason = z.infer<typeof NeedsReviewReasonSchema>;

export const NOT_TESTED_REASONS = [
  "target_not_established",
  "expect_already_met",
  "check_error",
  "missing_observation",
  "scope_unreadable",
] as const;
export const NotTestedReasonSchema = z.enum(NOT_TESTED_REASONS);
export type NotTestedReason = z.infer<typeof NotTestedReasonSchema>;

export const ReasonSchema = z.enum([...NEEDS_REVIEW_REASONS, ...NOT_TESTED_REASONS]);
export type Reason = z.infer<typeof ReasonSchema>;

/**
 * Whether `reason` is allowed with `status`.
 *
 * - `needs_review` and `not_tested` require a reason from their own list (8.2).
 * - `passed`, `failed` and `not_applicable` carry no reason. See the notes on
 *   the 8.2 / 8.5 wording about `not_applicable`.
 */
export function reasonFitsStatus(status: Status, reason: Reason | undefined): boolean {
  switch (status) {
    case "needs_review":
      return reason !== undefined && (NEEDS_REVIEW_REASONS as readonly string[]).includes(reason);
    case "not_tested":
      return reason !== undefined && (NOT_TESTED_REASONS as readonly string[]).includes(reason);
    default:
      return reason === undefined;
  }
}

// ---------------------------------------------------------------------------
// Levels and prerequisites (spec 6.1)
// ---------------------------------------------------------------------------

/** What an entry argues, or is allowed, to conclude. Ordered: none < fail_only < full. */
export const LEVELS = ["none", "fail_only", "full"] as const;
export const LevelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof LevelSchema>;

/** Rank of a level: none 0, fail_only 1, full 2. */
export function levelRank(level: Level): 0 | 1 | 2 {
  return level === "none" ? 0 : level === "fail_only" ? 1 : 2;
}

/** The lower of two levels. */
export function minLevel(a: Level, b: Level): Level {
  return levelRank(a) <= levelRank(b) ? a : b;
}

/**
 * Prerequisites an entry may need (spec 6.1 `needs`). Their run-time meaning is
 * fixed in `src/rulesets/contract.ts` (see `PREREQUISITE_MEANING`).
 */
export const PREREQUISITES = ["state", "keyboard", "media", "model", "assistive_tech"] as const;
export const PrerequisiteSchema = z.enum(PREREQUISITES);
export type Prerequisite = z.infer<typeof PrerequisiteSchema>;

/**
 * The facts recorded for one requirement (spec 8.3 step 3), in their
 * canonical order. A finding lists the true ones in this order.
 */
export const FACTS = ["error", "dispute", "violation", "unresolved", "satisfied", "inapplicable"] as const;
export const FactSchema = z.enum(FACTS);
export type Fact = z.infer<typeof FactSchema>;

// ---------------------------------------------------------------------------
// Small helpers for refinements
// ---------------------------------------------------------------------------

/** The values that occur more than once in `values`, in first-seen order. */
export function duplicates<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const dup = new Set<T>();
  for (const v of values) {
    if (seen.has(v)) dup.add(v);
    seen.add(v);
  }
  return [...dup];
}

/**
 * Compare two dotted numeric ids (`1.10.2` after `1.9.3`) segment by segment.
 * Used to sort tests and criteria in their official order.
 */
export function compareDottedIds(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? -1;
    const y = pb[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}
