/**
 * The three statements of the claim boundary, as data (spec 2.3). Every
 * standalone output carries them: the run file, the reports, and every result
 * returned by the library or the MCP server.
 *
 * They state what was examined. They hold no rate, score or verdict, and no
 * count is ever given against a total (spec 2.2).
 */
import { z } from "zod";
import { NeedsReviewReasonSchema, NotTestedReasonSchema, TargetIdSchema, TestIdSchema, TextSchema } from "./common.ts";

/** The fixed "what this is not" sentence (spec 2.3), in English. Reporters translate it for `fr`. */
export const WHAT_THIS_IS_NOT =
  "This report is not a compliance declaration and cannot be used as one. A conformance statement requires a complete audit by a competent person, inside the organisation or outside it.";

/**
 * What the sample check cannot verify (spec 7.5). Part of "what was not
 * covered" in every output.
 */
export const SAMPLE_UNVERIFIABLE = [
  "Whether the declared services and processes are all the site has.",
  "Whether pages marked distinct_template represent the site's variety.",
  "Whether pages marked random were chosen at random.",
  "Anything about the listed documents.",
] as const;

export const StatementsSchema = z.strictObject({
  covered: z.strictObject({
    ruleset: z.strictObject({ id: TextSchema, version: TextSchema }),
    /** Pages that had at least one established target. */
    pagesExamined: z.array(TextSchema),
    /** Targets that were established and examined. */
    targetsExamined: z.array(TargetIdSchema),
    /**
     * The number of distinct tests that got `passed`, `failed` or
     * `not_applicable` on at least one examined target. A count, never shown
     * against a total.
     */
    testsDecided: z.int().nonnegative(),
  }),
  notCovered: z.strictObject({
    /** Each test left for human review on a target, with its reason. */
    testsForReview: z.array(
      z.strictObject({ test: TestIdSchema, targetId: TargetIdSchema, reason: NeedsReviewReasonSchema }),
    ),
    /** Each test the tool could not examine on a target that was established, with its reason. */
    testsNotTested: z.array(
      z.strictObject({ test: TestIdSchema, targetId: TargetIdSchema, reason: NotTestedReasonSchema }),
    ),
    /** Targets that could not be examined, with the reason. */
    targetsNotExamined: z.array(
      z.strictObject({
        targetId: TargetIdSchema,
        reason: z.enum(["target_not_established", "expect_already_met"]),
      }),
    ),
    /** The parts of the sample the tool cannot verify: always `SAMPLE_UNVERIFIABLE`. */
    sampleUnverifiable: z.tuple([
      z.literal(SAMPLE_UNVERIFIABLE[0]),
      z.literal(SAMPLE_UNVERIFIABLE[1]),
      z.literal(SAMPLE_UNVERIFIABLE[2]),
      z.literal(SAMPLE_UNVERIFIABLE[3]),
    ]),
  }),
  whatThisIsNot: z.literal(WHAT_THIS_IS_NOT),
});
export type Statements = z.infer<typeof StatementsSchema>;
