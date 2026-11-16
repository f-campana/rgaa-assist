/**
 * A corpus case (spec 10.1, 10.2). Cases are stored in the repo and served
 * locally; evaluation makes no network request. Working and acceptance cases
 * share this shape; which set a case belongs to is given by its folder
 * (`corpus/working/`, `corpus/acceptance/`), not by a field.
 *
 * Every label cites the official wording (6.5), like a coverage entry.
 */
import { z } from "zod";
import { LocalIdSchema, ReasonSchema, StatusSchema, TestIdSchema, TextSchema, reasonFitsStatus } from "./common.ts";
import { RationaleSchema } from "./coverage.ts";

/** The branch a test case exercises (10.2). */
export const BranchSchema = z.enum([
  /** Valid. */
  "valid",
  /** Invalid, and the fault proves failure. */
  "invalid_fault_proves_failure",
  /** Invalid by one route, valid by an accepted alternative. */
  "invalid_by_route_valid_by_alternative",
  /** Inapplicable. */
  "inapplicable",
  /** Outside what the checks support. */
  "outside_support",
]);
export type Branch = z.infer<typeof BranchSchema>;

/**
 * An exact expected result. `reason`, when given, must equal the finding's
 * reason; `complete`, when given, must equal the finding's `complete`.
 */
export const ExpectedResultSchema = z
  .strictObject({
    status: StatusSchema,
    reason: ReasonSchema.optional(),
    complete: z.boolean().optional(),
  })
  .refine((e) => e.reason === undefined || reasonFitsStatus(e.status, e.reason), {
    message: "reason does not fit status",
    path: ["reason"],
  });
export type ExpectedResult = z.infer<typeof ExpectedResultSchema>;

export const CaseSourceSchema = z.discriminatedUnion("kind", [
  /** A W3C ACT rule test case. Its ACT label is kept for the record; it is not the RGAA label. */
  z.strictObject({
    kind: z.literal("act"),
    rule: TextSchema,
    testCase: TextSchema,
    actLabel: z.enum(["passed", "failed", "inapplicable"]),
    url: z.url(),
    /** Pinned version or commit of the ACT rules repository. */
    pinned: TextSchema,
  }),
  /** The W3C "Before and After" demo: static pages only, pinned assets. */
  z.strictObject({ kind: z.literal("before_after"), page: TextSchema, url: z.url(), pinned: TextSchema }),
  /** Written for this project. */
  z.strictObject({ kind: z.literal("planted"), author: TextSchema }),
]);
export type CaseSource = z.infer<typeof CaseSourceSchema>;

const caseBase = {
  id: LocalIdSchema,
  source: CaseSourceSchema,
  /** Licence of the reused material, checked per asset (13). */
  licence: TextSchema,
  /** What was changed from the source, or `null` when nothing was. */
  adaptation: TextSchema.nullable(),
  /** Files of the case, relative to the case's folder. The first is the page loaded. */
  files: z.array(TextSchema).min(1),
};

/**
 * A case for one test and one branch. Its expected status depends on the
 * level the entry runs at (10.2: "passed on a full entry, needs_review
 * otherwise"), so it is stated exactly for both enabled levels. Corpus cases
 * are run only for enabled entries.
 */
export const TestCaseSchema = z.strictObject({
  ...caseBase,
  kind: z.literal("test"),
  test: TestIdSchema,
  branch: BranchSchema,
  /** Ids of the entry's routes and exceptions the case exercises (10.4 asks for one valid case per route). */
  routes: z.array(LocalIdSchema),
  expected: z.strictObject({ fail_only: ExpectedResultSchema, full: ExpectedResultSchema }),
  /** Why the label is what it is, citing the official text (6.5). */
  rationale: RationaleSchema,
});
export type TestCase = z.infer<typeof TestCaseSchema>;

/** An engine case (10.2): a target, session, derivation, approval or reduction situation. */
export const EngineCaseSchema = z.strictObject({
  ...caseBase,
  kind: z.literal("engine"),
  category: z.enum(["target", "session", "derivation", "approval", "reduction"]),
  description: TextSchema,
  /** The test whose finding is compared, when the case is about one. */
  test: TestIdSchema.optional(),
  expected: ExpectedResultSchema,
});
export type EngineCase = z.infer<typeof EngineCaseSchema>;

export const CorpusCaseSchema = z.discriminatedUnion("kind", [TestCaseSchema, EngineCaseSchema]);
export type CorpusCase = z.infer<typeof CorpusCaseSchema>;
