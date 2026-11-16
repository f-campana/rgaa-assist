/**
 * Approval records (spec 6.3, decisions Q32, Q36).
 *
 * Storage: one append-only log per ruleset, `src/rulesets/<ruleset>/approvals.json`,
 * beside the `coverage/` folder. Events are ordered by `seq`, which starts at 1
 * and increases by one per event, so a removed or reordered event breaks the
 * file's validation. Events are never edited or removed; a correction is a new
 * event.
 *
 * Two kinds of event:
 * - `approval`: authorises one level for one entry hash, by named approvers.
 * - `demotion`: lowers the authorised level of a test, with a reason. Free:
 *   it needs no approver.
 *
 * How the log is read (implemented by `effectiveLevel`, see its doc comment):
 * for a test, the last `approval` event fixes the authorised (hash, level);
 * every `demotion` after it caps the level. Demotions before it no longer
 * count, because a later approval re-authorises. An earlier approval never
 * counts once a later event exists: so after a demotion, only a new approval
 * raises the level again, even when an old record has the same hash and level.
 */
import { z } from "zod";
import { DateTimeSchema, LevelSchema, Sha256Schema, TestIdSchema, TextSchema, duplicates } from "./common.ts";
import type { CoverageEntry } from "./coverage.ts";
import type { Level } from "./common.ts";

/**
 * Who approves. `fabien` is the project owner. `orchestrator` is the M1
 * orchestrator (Fable 5.2, or Opus 5.5 under Q39). `codex` is the reviewer.
 */
export const ApproverRoleSchema = z.enum(["fabien", "orchestrator", "codex"]);
export type ApproverRole = z.infer<typeof ApproverRoleSchema>;

export const ApproverSchema = z.strictObject({
  role: ApproverRoleSchema,
  /** Who held the role, for example "Fable 5.2". */
  name: TextSchema,
});

export const ApprovalEventSchema = z
  .strictObject({
    seq: z.int().positive(),
    kind: z.literal("approval"),
    test: TestIdSchema,
    /** `entryHash` of the approved content. */
    entryHash: Sha256Schema,
    /** The level authorised. `none` needs no approval. */
    level: LevelSchema.exclude(["none"]),
    approvers: z.array(ApproverSchema).min(1),
    /** Ids of the corpus cases that support the approval (6.3: enabling needs corpus cases). */
    corpusCases: z.array(TextSchema).min(1),
    /** Hash of the evaluation summary the approvers saw. A record only: it does not pin later measurements. */
    evaluationSummaryHash: Sha256Schema,
    at: DateTimeSchema,
    note: TextSchema.optional(),
  })
  .superRefine((e, ctx) => {
    for (const role of duplicates(e.approvers.map((a) => a.role))) {
      ctx.addIssue({ code: "custom", path: ["approvers"], message: `role listed twice: ${role}` });
    }
  });
export type ApprovalEvent = z.infer<typeof ApprovalEventSchema>;

export const DemotionEventSchema = z.strictObject({
  seq: z.int().positive(),
  kind: z.literal("demotion"),
  test: TestIdSchema,
  /** The level the test is lowered to. */
  level: LevelSchema.exclude(["full"]),
  /** The logged reason (6.3). */
  reason: TextSchema,
  /** Who lowered it. Anyone may. */
  by: TextSchema,
  at: DateTimeSchema,
});
export type DemotionEvent = z.infer<typeof DemotionEventSchema>;

export const ApprovalLogEventSchema = z.discriminatedUnion("kind", [ApprovalEventSchema, DemotionEventSchema]);
export type ApprovalLogEvent = z.infer<typeof ApprovalLogEventSchema>;

export const ApprovalLogSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    events: z.array(ApprovalLogEventSchema),
  })
  .superRefine((log, ctx) => {
    log.events.forEach((e, i) => {
      if (e.seq !== i + 1) {
        ctx.addIssue({ code: "custom", path: ["events", i, "seq"], message: `seq must be ${i + 1}: events are append-only` });
      }
    });
  });
export type ApprovalLog = z.infer<typeof ApprovalLogSchema>;

/**
 * The roles that must all appear on an approval of `level` for `entry`
 * (6.3, Q32):
 * - `full` needs `fabien`;
 * - `fail_only` needs `orchestrator` and `codex`;
 * - an entry with any link whose `faultMeans` is `failure` lets the tool say
 *   "failed", so it needs `orchestrator` and `codex` at any level, `full` included.
 *
 * Returned sorted: fabien, orchestrator, codex.
 */
export function requiredApprovers(entry: Pick<CoverageEntry, "links">, level: Exclude<Level, "none">): ApproverRole[] {
  const roles = new Set<ApproverRole>();
  if (level === "full") roles.add("fabien");
  if (level === "fail_only" || entry.links.some((l) => l.faultMeans === "failure")) {
    roles.add("orchestrator");
    roles.add("codex");
  }
  return ApproverRoleSchema.options.filter((r) => roles.has(r));
}
