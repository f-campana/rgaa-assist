/**
 * The evaluation summary (spec 8.6, 10.3): measured results on a corpus, per
 * link and per enabled entry, versioned and referred to by hash.
 *
 * It holds counts of cases by expected and actual result, never a rate or a
 * confidence figure (8.6). The four measures of 10.3 are read from the table
 * and reported as "x of n"; they are not stored.
 */
import { z } from "zod";
import {
  CheckIdSchema,
  DateTimeSchema,
  LevelSchema,
  LocalIdSchema,
  ReasonSchema,
  Sha256Schema,
  StatusSchema,
  TestIdSchema,
  TextSchema,
  duplicates,
} from "./common.ts";
import type { Status } from "./common.ts";
import { canonicalJson } from "./canonical.ts";
import { BranchSchema, ExpectedResultSchema } from "./corpus.ts";
import type { ExpectedResult } from "./corpus.ts";

/** The result of one case in one evaluation. */
export const CaseResultSchema = z
  .strictObject({
    /** The corpus case id. */
    case: LocalIdSchema,
    /** The expectation used: for a test case, the one for the level measured. */
    expected: ExpectedResultSchema,
    actual: z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("finding"),
        status: StatusSchema,
        reason: ReasonSchema.optional(),
        complete: z.boolean(),
      }),
      /** The harness or the tool crashed: no finding was produced. */
      z.strictObject({ kind: z.literal("crash"), message: TextSchema }),
    ]),
    /** Linked checks whose observation was missing. Sorted. */
    missingObservations: z.array(CheckIdSchema),
    /** Whether the case returned exactly its expected result (`caseMatches`). */
    matched: z.boolean(),
  })
  .refine((r) => r.matched === caseMatches(r.expected, r.actual), {
    message: "matched must equal caseMatches(expected, actual)",
    path: ["matched"],
  });
export type CaseResult = z.infer<typeof CaseResultSchema>;

/**
 * A case matches when a finding was produced, its status equals the expected
 * status, and its reason and `complete` equal the expected ones where the
 * case states them (10.4.1).
 */
export function caseMatches(
  expected: ExpectedResult,
  actual: { kind: "finding"; status: Status; reason?: string | undefined; complete: boolean } | { kind: "crash"; message: string },
): boolean {
  if (actual.kind !== "finding") return false;
  if (actual.status !== expected.status) return false;
  if (expected.reason !== undefined && actual.reason !== expected.reason) return false;
  if (expected.complete !== undefined && actual.complete !== expected.complete) return false;
  return true;
}

const countRow = z.strictObject({
  passed: z.int().nonnegative(),
  failed: z.int().nonnegative(),
  not_applicable: z.int().nonnegative(),
  needs_review: z.int().nonnegative(),
  not_tested: z.int().nonnegative(),
  crash: z.int().nonnegative(),
});

/**
 * The table of 10.3: for each expected status (row), the count of cases by
 * actual status or crash (column), plus the number of cases with at least one
 * missing observation.
 */
export const ResultTableSchema = z.strictObject({
  expected: z.strictObject({
    passed: countRow,
    failed: countRow,
    not_applicable: countRow,
    needs_review: countRow,
    not_tested: countRow,
  }),
  missingObservations: z.int().nonnegative(),
  cases: z.int().nonnegative(),
});
export type ResultTable = z.infer<typeof ResultTableSchema>;

/** Build the table of 10.3 from case results. */
export function tabulate(results: readonly CaseResult[]): ResultTable {
  const row = () => ({ passed: 0, failed: 0, not_applicable: 0, needs_review: 0, not_tested: 0, crash: 0 });
  const table: ResultTable = {
    expected: { passed: row(), failed: row(), not_applicable: row(), needs_review: row(), not_tested: row() },
    missingObservations: 0,
    cases: results.length,
  };
  for (const r of results) {
    const column = r.actual.kind === "crash" ? "crash" : r.actual.status;
    table.expected[r.expected.status][column] += 1;
    if (r.missingObservations.length > 0) table.missingObservations += 1;
  }
  return table;
}

/** Which branches and which routes or exceptions the cases cover (10.3 "the scope the cases cover"). */
export const CoveredScopeSchema = z.strictObject({
  branches: z.array(BranchSchema),
  /** Ids of routes and exceptions of the entry. */
  routes: z.array(LocalIdSchema),
  description: TextSchema,
});

const measured = {
  /** Sorted by case id. */
  cases: z.array(CaseResultSchema),
  table: ResultTableSchema,
};

function tableMatches(r: { cases: CaseResult[]; table: ResultTable }, ctx: z.RefinementCtx): void {
  if (canonicalJson(tabulate(r.cases)) !== canonicalJson(r.table)) {
    ctx.addIssue({ code: "custom", path: ["table"], message: "table must equal tabulate(cases)" });
  }
}

/** Measurement of one link of one entry. */
export const LinkMeasurementSchema = z
  .strictObject({
    test: TestIdSchema,
    check: CheckIdSchema,
    requirement: LocalIdSchema,
    /** Version of the linked check that was measured. */
    checkVersion: TextSchema,
    scope: CoveredScopeSchema,
    ...measured,
  })
  .superRefine(tableMatches);
export type LinkMeasurement = z.infer<typeof LinkMeasurementSchema>;

/** Measurement of one enabled entry, at the level it was measured at. */
export const EntryMeasurementSchema = z
  .strictObject({
    test: TestIdSchema,
    /** `entryHash` of the entry measured. */
    entryHash: Sha256Schema,
    /** The level the entry ran at during the measurement. */
    level: LevelSchema.exclude(["none"]),
    /** Version measured for each check the entry links, by check id. */
    checkVersions: z.record(CheckIdSchema, TextSchema),
    scope: CoveredScopeSchema,
    ...measured,
  })
  .superRefine(tableMatches);
export type EntryMeasurement = z.infer<typeof EntryMeasurementSchema>;

export const EvaluationSummarySchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    ruleset: z.strictObject({ id: TextSchema, version: TextSchema }),
    corpus: z.strictObject({
      name: TextSchema,
      set: z.enum(["working", "acceptance"]),
      /** Hash of the corpus content measured. */
      hash: Sha256Schema,
    }),
    toolVersion: TextSchema,
    createdAt: DateTimeSchema,
    /** Sorted by test, check, requirement. Unique on that triple. */
    links: z.array(LinkMeasurementSchema),
    /** Sorted by test. At most one per test. */
    entries: z.array(EntryMeasurementSchema),
    /** Engine cases (10.2). */
    engine: z.strictObject(measured).superRefine(tableMatches),
  })
  .superRefine((s, ctx) => {
    for (const t of duplicates(s.entries.map((e) => e.test))) {
      ctx.addIssue({ code: "custom", path: ["entries"], message: `two measurements for test ${t}` });
    }
    for (const k of duplicates(s.links.map((l) => `${l.test} ${l.check} ${l.requirement}`))) {
      ctx.addIssue({ code: "custom", path: ["links"], message: `two measurements for link ${k}` });
    }
  });
export type EvaluationSummary = z.infer<typeof EvaluationSummarySchema>;

/** Why an entry runs at `none` (see `effectiveLevel` in `src/rulesets/shared/effective-level.ts`). */
export const EffectiveLevelBlockSchema = z.enum([
  "not_enabled",
  "no_approval",
  "approved_content_differs",
  "approvers_insufficient",
  "enabled_mismatch",
  "not_measured",
  "check_version_unknown",
  "check_version_changed",
  "corpus_cases_failing",
]);
export type EffectiveLevelBlock = z.infer<typeof EffectiveLevelBlockSchema>;
