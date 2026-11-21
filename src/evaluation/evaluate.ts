/**
 * The corpus harness (spec 10.2, 10.3).
 *
 * Each case is served from its folder on the engine's two-origin fixture
 * server, its target is established and the providers are run exactly as the
 * engine does (`examineFixture`), then the case's test is derived.
 *
 * Measurement is at the candidate level. Nothing is enabled yet and
 * `deriveFindings` refuses a level above `enabled`, so for measurement only the
 * entry is copied in memory with `enabled` set to its `candidate`
 * (`enabled` is outside the entry hash). The copy is never written anywhere.
 *
 * Claim boundary (spec 2): everything here is a count of cases, each with its
 * population ("x of n cases on corpus <set>@<hash>"). No rate, no percentage,
 * no score, no verdict.
 */
import type { Browser } from "playwright";
import type { CheckProvider } from "../checks/types.ts";
import { examineFixture } from "../engine/testing/index.ts";
import { toolVersion } from "../engine/index.ts";
import type { RulesetPlugin } from "../rulesets/contract.ts";
import { STATUSES, caseMatches, compareDottedIds, entryHash, tabulate } from "../schema/index.ts";
import type {
  CaseResult,
  CheckId,
  CoverageEntry,
  ExpectedResult,
  Level,
  Outcome,
  ResultTable,
  Status,
} from "../schema/index.ts";
import type { LoadedCase, LoadedCorpus } from "./corpus.ts";

/** What one linked check gave on a case: its outcome, or `missing` when no observation exists. */
export type LinkedOutcome = Outcome | "missing";

export interface CaseReport extends CaseResult {
  test: string;
  kind: "test" | "engine";
  branch?: string;
  /** The level the case was measured at: the entry's candidate. */
  level: Exclude<Level, "none">;
  /** Outcome of each linked check, by check id (missing included). */
  outcomes: Record<string, LinkedOutcome>;
}

export interface UnmeasuredCase {
  case: string;
  reason: string;
}

/** The four counts of 10.3, each with its population. */
export interface Measures {
  falseAssurance: { x: number; n: number };
  missedFault: { x: number; n: number };
  falseAlarm: { x: number; n: number };
  unexpectedError: { x: number; n: number };
}

export interface TestMeasurement {
  test: string;
  entryHash: string;
  level: Exclude<Level, "none">;
  table: ResultTable;
  measures: Measures;
  matched: { x: number; n: number };
}

export interface CheckMeasurement {
  check: CheckId;
  built: boolean;
  checkVersion: string | null;
  /** Cases of the working set that link this check. */
  cases: number;
  /** Count of those cases by the outcome the check gave. */
  outcomes: Record<LinkedOutcome, number>;
}

export interface EvaluationReport {
  schemaVersion: 1;
  ruleset: { id: string; version: string };
  corpus: { name: string; set: string; hash: string; label: string; cases: number };
  toolVersion: string;
  createdAt: string;
  checkVersions: Record<string, string>;
  cases: CaseReport[];
  unmeasured: UnmeasuredCase[];
  tests: TestMeasurement[];
  checks: CheckMeasurement[];
  /** All cases measured. */
  overall: { table: ResultTable; measures: Measures; matched: { x: number; n: number } };
  /**
   * Always null. The schema's EvaluationSummary asks for per-link measurements,
   * and this harness measures whole tests only (Q56): cloning a test's result
   * onto each of its links would not measure the link.
   */
  summary: null;
  /** Why `summary` is null. */
  summaryNote: string;
}

export interface EvaluateInput {
  corpus: LoadedCorpus;
  plugin: RulesetPlugin;
  providers: readonly CheckProvider[];
  /** One browser for the whole run. */
  browser: Browser;
  /** Called after each case, for progress. */
  onCase?: (report: CaseReport, index: number, total: number) => void;
  now?: () => Date;
}

/** The short form of the corpus hash used in labels. */
export const HASH_LABEL_LENGTH = 12;

export function corpusLabel(set: string, hash: string): string {
  return `${set}@${hash.slice(0, HASH_LABEL_LENGTH)}`;
}

/** "x of n cases on corpus working@abc", never a rate. */
export function countPhrase(c: { x: number; n: number }, label: string): string {
  return `${c.x} of ${c.n} cases on corpus ${label}`;
}

// ---------------------------------------------------------------------------
// Measures (10.3)
// ---------------------------------------------------------------------------

type Row = Pick<CaseResult, "expected" | "actual" | "missingObservations">;

/**
 * The four counts of 10.3, each over its population.
 * - False assurance: an unexpected `passed` or `not_applicable`, that is, an
 *   actual status of `passed` or `not_applicable` that differs from the
 *   expected status (a swap between the two included), over ALL cases: any
 *   case could return one it did not expect (spec 10.3, Q56).
 * - Missed fault: anything other than `failed`, over the cases that expected `failed`.
 * - False alarm: a `failed` the case did not expect, over the cases that did not expect `failed`.
 * - Unexpected error: a crash, or a `not_tested` or a missing observation the
 *   case did not expect, over all cases.
 */
export function measures(rows: readonly Row[]): Measures {
  const m: Measures = {
    falseAssurance: { x: 0, n: rows.length },
    missedFault: { x: 0, n: 0 },
    falseAlarm: { x: 0, n: 0 },
    unexpectedError: { x: 0, n: rows.length },
  };
  for (const r of rows) {
    const expected = r.expected.status;
    const actual = r.actual.kind === "finding" ? r.actual.status : "crash";
    if ((actual === "passed" || actual === "not_applicable") && actual !== expected) m.falseAssurance.x += 1;
    if (expected === "failed") {
      m.missedFault.n += 1;
      if (actual !== "failed") m.missedFault.x += 1;
    } else {
      m.falseAlarm.n += 1;
      if (actual === "failed") m.falseAlarm.x += 1;
    }
    // A missing observation the case did not expect: the expected status differs, or the expected reason is
    // given and differs from the actual one (spec 10.3, Q60).
    const expectedReason = r.expected.reason;
    const actualReason = r.actual.kind === "finding" ? r.actual.reason : undefined;
    const missingUnexpected = r.missingObservations.length > 0 && (expected !== "not_tested" || (expectedReason !== undefined && expectedReason !== actualReason));
    const unexpected = actual === "crash" || (actual === "not_tested" && expected !== "not_tested") || missingUnexpected;
    if (unexpected) m.unexpectedError.x += 1;
  }
  return m;
}

const matchedCount = (rows: readonly CaseResult[]): { x: number; n: number } => ({
  x: rows.filter((r) => r.matched).length,
  n: rows.length,
});

// ---------------------------------------------------------------------------
// Running one case
// ---------------------------------------------------------------------------

function expectedFor(c: LoadedCase, level: Exclude<Level, "none">): ExpectedResult {
  return c.case.kind === "test" ? c.case.expected[level] : c.case.expected;
}

const crashed = (message: string): CaseResult["actual"] => ({ kind: "crash", message: message.slice(0, 2000) });

async function runCase(
  c: LoadedCase,
  entry: CoverageEntry,
  level: Exclude<Level, "none">,
  input: EvaluateInput,
): Promise<CaseReport> {
  const expected = expectedFor(c, level);
  const linked = [...new Set(entry.links.map((l) => l.check))].sort();
  const base = {
    case: c.case.id,
    test: entry.test,
    kind: c.case.kind,
    ...(c.case.kind === "test" ? { branch: c.case.branch } : {}),
    level,
    expected,
  };
  const failure = (message: string): CaseReport => ({
    ...base,
    actual: crashed(message),
    missingObservations: [],
    matched: false,
    outcomes: Object.fromEntries(linked.map((id) => [id, "missing" as const])),
  });

  let outcome;
  try {
    outcome = await examineFixture(input.providers, c.dir, { browser: input.browser, targetId: `${c.case.id}/initial` });
  } catch (e) {
    return failure(`examination failed: ${(e as Error).message}`);
  }

  // Measurement only: an in-memory copy with `enabled` equal to `candidate`. Never written.
  const measured: CoverageEntry = { ...entry, enabled: entry.candidate };
  const derived = input.plugin.deriveFindings({
    target: outcome.execution,
    observations: outcome.observations,
    entries: [{ entry: measured, level }],
  });
  if (!derived.ok) return failure(`derivation rejected: ${JSON.stringify(derived.rejections)}`);
  const finding = derived.findings[0];
  if (finding === undefined) return failure("derivation gave no finding");

  const byCheck = new Map(outcome.observations.map((o) => [o.checkId, o.outcome]));
  const outcomes = Object.fromEntries(linked.map((id) => [id, byCheck.get(id) ?? ("missing" as const)]));
  const missingObservations = linked.filter((id) => !byCheck.has(id));
  const actual: CaseResult["actual"] = {
    kind: "finding",
    status: finding.status,
    ...(finding.reason === undefined ? {} : { reason: finding.reason }),
    complete: finding.complete,
  };
  return { ...base, actual, missingObservations, matched: caseMatches(expected, actual), outcomes };
}

// ---------------------------------------------------------------------------
// The evaluation
// ---------------------------------------------------------------------------

const emptyOutcomes = (): Record<LinkedOutcome, number> => ({
  fault: 0,
  no_fault: 0,
  inapplicable: 0,
  cannot_tell: 0,
  error: 0,
  missing: 0,
});

const byId = (a: { case: string }, b: { case: string }): number => (a.case < b.case ? -1 : a.case > b.case ? 1 : 0);

export async function evaluate(input: EvaluateInput): Promise<EvaluationReport> {
  const { corpus, plugin } = input;
  const label = corpusLabel(corpus.set, corpus.hash);
  const declared = new Map(input.providers.flatMap((p) => p.checks.map((d) => [d.id, d.version] as const)));
  const exists = new Map(plugin.coverage.checks.checks.map((c) => [c.id, c.exists]));

  const reports: CaseReport[] = [];
  const unmeasured: UnmeasuredCase[] = [];
  const entryOf = new Map<string, CoverageEntry>();
  let index = 0;
  for (const c of corpus.cases) {
    index += 1;
    const test = c.case.test;
    if (test === undefined) {
      unmeasured.push({ case: c.case.id, reason: "an engine case without a test: nothing to derive" });
      continue;
    }
    const entry = plugin.coverage.entries.get(test);
    if (entry === undefined) {
      unmeasured.push({ case: c.case.id, reason: `no coverage entry for test ${test}` });
      continue;
    }
    if (entry.candidate === "none") {
      unmeasured.push({ case: c.case.id, reason: `entry ${test} has candidate none: no level to measure at` });
      continue;
    }
    entryOf.set(test, entry);
    const report = await runCase(c, entry, entry.candidate, input);
    reports.push(report);
    input.onCase?.(report, index, corpus.cases.length);
  }
  reports.sort(byId);

  // Per test.
  const tests: TestMeasurement[] = [];
  const testIds = [...entryOf.keys()].sort(compareDottedIds);
  for (const test of testIds) {
    const entry = entryOf.get(test) as CoverageEntry;
    const rows = reports.filter((r) => r.test === test);
    tests.push({
      test,
      entryHash: entryHash(entry),
      level: entry.candidate as Exclude<Level, "none">,
      table: tabulate(rows),
      measures: measures(rows),
      matched: matchedCount(rows),
    });
  }

  // Per check: outcomes over the cases that link it.
  const checkIds = [...new Set([...entryOf.values()].flatMap((e) => e.links.map((l) => l.check)))].sort();
  const checks: CheckMeasurement[] = checkIds.map((check) => {
    const rows = reports.filter((r) => check in r.outcomes);
    const outcomes = emptyOutcomes();
    for (const r of rows) outcomes[r.outcomes[check] as LinkedOutcome] += 1;
    return { check, built: exists.get(check) ?? false, checkVersion: declared.get(check) ?? null, cases: rows.length, outcomes };
  });

  const createdAt = (input.now?.() ?? new Date()).toISOString();

  return {
    schemaVersion: 1,
    ruleset: { id: plugin.id, version: plugin.version },
    corpus: { name: corpus.set, set: corpus.set, hash: corpus.hash, label, cases: corpus.cases.length },
    toolVersion: toolVersion(),
    createdAt,
    checkVersions: Object.fromEntries([...declared.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))),
    cases: reports,
    unmeasured,
    tests,
    checks,
    overall: { table: tabulate(reports), measures: measures(reports), matched: matchedCount(reports) },
    summary: null,
    summaryNote: SUMMARY_NOTE,
  };
}

// ---------------------------------------------------------------------------
// The EvaluationSummary of spec 8.6
// ---------------------------------------------------------------------------

/** Why no EvaluationSummary is written (Q56). */
export const SUMMARY_NOTE =
  "not written: the schema asks for a measurement per link, and this harness measures whole tests only. Per-link measurement is M5 work, " +
  "required before any entry is enabled (Q56).";

/** The statuses in table order, for printing. */
export const STATUS_ORDER: readonly Status[] = STATUSES;
