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
import {
  EvaluationSummarySchema,
  STATUSES,
  caseMatches,
  compareDottedIds,
  entryHash,
  tabulate,
} from "../schema/index.ts";
import type {
  CaseResult,
  CheckId,
  CoverageEntry,
  EvaluationSummary,
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

export interface LinkMeasurementReport {
  test: string;
  check: CheckId;
  requirement: string;
  built: boolean;
  /** Version of the provider's check, or null when no provider declares it. */
  checkVersion: string | null;
  /** The cases of the link's test, with missing observations counted for this check only. */
  table: ResultTable;
  measures: Measures;
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
  links: LinkMeasurementReport[];
  checks: CheckMeasurement[];
  /** All cases measured. */
  overall: { table: ResultTable; measures: Measures; matched: { x: number; n: number } };
  /** Present when every number the schema asks for is known. */
  summary: EvaluationSummary | null;
  /** Why `summary` is null, when it is. */
  summaryNote: string | null;
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
 * - False assurance: a `passed` or `not_applicable` the case did not expect,
 *   over the cases that expected neither.
 * - Missed fault: anything other than `failed`, over the cases that expected `failed`.
 * - False alarm: a `failed` the case did not expect, over the cases that did not expect `failed`.
 * - Unexpected error: a crash, or a `not_tested` or a missing observation the
 *   case did not expect, over all cases.
 */
export function measures(rows: readonly Row[]): Measures {
  const m: Measures = {
    falseAssurance: { x: 0, n: 0 },
    missedFault: { x: 0, n: 0 },
    falseAlarm: { x: 0, n: 0 },
    unexpectedError: { x: 0, n: rows.length },
  };
  for (const r of rows) {
    const expected = r.expected.status;
    const actual = r.actual.kind === "finding" ? r.actual.status : "crash";
    if (expected !== "passed" && expected !== "not_applicable") {
      m.falseAssurance.n += 1;
      if (actual === "passed" || actual === "not_applicable") m.falseAssurance.x += 1;
    }
    if (expected === "failed") {
      m.missedFault.n += 1;
      if (actual !== "failed") m.missedFault.x += 1;
    } else {
      m.falseAlarm.n += 1;
      if (actual === "failed") m.falseAlarm.x += 1;
    }
    const unexpected =
      actual === "crash" || (actual === "not_tested" && expected !== "not_tested") || (r.missingObservations.length > 0 && expected !== "not_tested");
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

  // Per link: the test's cases, with missing observations counted for the link's check only.
  const links: LinkMeasurementReport[] = [];
  for (const test of testIds) {
    const entry = entryOf.get(test) as CoverageEntry;
    const rows = reports.filter((r) => r.test === test);
    const sortedLinks = [...entry.links].sort((a, b) =>
      a.check === b.check ? (a.requirement < b.requirement ? -1 : 1) : a.check < b.check ? -1 : 1,
    );
    for (const link of sortedLinks) {
      const forLink = rows.map((r) => ({ ...r, missingObservations: r.missingObservations.filter((m) => m === link.check) }));
      links.push({
        test,
        check: link.check,
        requirement: link.requirement,
        built: exists.get(link.check) ?? false,
        checkVersion: declared.get(link.check) ?? null,
        table: tabulate(forLink),
        measures: measures(forLink),
      });
    }
  }

  // Per check: outcomes over the cases that link it.
  const checkIds = [...new Set(links.map((l) => l.check))].sort();
  const checks: CheckMeasurement[] = checkIds.map((check) => {
    const rows = reports.filter((r) => check in r.outcomes);
    const outcomes = emptyOutcomes();
    for (const r of rows) outcomes[r.outcomes[check] as LinkedOutcome] += 1;
    return { check, built: exists.get(check) ?? false, checkVersion: declared.get(check) ?? null, cases: rows.length, outcomes };
  });

  const createdAt = (input.now?.() ?? new Date()).toISOString();
  const { summary, note } = buildSummary({ reports, entryOf, testIds, declared, plugin, corpus, createdAt });

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
    links,
    checks,
    overall: { table: tabulate(reports), measures: measures(reports), matched: matchedCount(reports) },
    summary,
    summaryNote: note,
  };
}

// ---------------------------------------------------------------------------
// The EvaluationSummary of spec 8.6, when everything it asks for is known
// ---------------------------------------------------------------------------

function buildSummary(args: {
  reports: CaseReport[];
  entryOf: Map<string, CoverageEntry>;
  testIds: string[];
  declared: Map<string, string>;
  plugin: RulesetPlugin;
  corpus: LoadedCorpus;
  createdAt: string;
}): { summary: EvaluationSummary | null; note: string | null } {
  const { reports, entryOf, testIds, declared, plugin, corpus, createdAt } = args;
  if (corpus.set !== "working" && corpus.set !== "acceptance") {
    return { summary: null, note: `corpus set "${corpus.set}" is neither working nor acceptance` };
  }
  const unknown = new Set<string>();
  for (const test of testIds) {
    for (const link of (entryOf.get(test) as CoverageEntry).links) {
      if (!declared.has(link.check)) unknown.add(link.check);
    }
  }
  if (unknown.size > 0) {
    return {
      summary: null,
      note:
        `not written: the schema asks for the measured version of every linked check, and ${unknown.size} linked check(s) have no provider ` +
        `(no version to record): ${[...unknown].sort().join(", ")}`,
    };
  }

  const scopeOf = (rows: CaseReport[], what: string) => {
    const branches = [...new Set(rows.flatMap((r) => (r.branch === undefined ? [] : [r.branch])))].sort();
    return {
      branches: branches as ("valid" | "invalid_fault_proves_failure" | "invalid_by_route_valid_by_alternative" | "inapplicable" | "outside_support")[],
      routes: [] as string[],
      description: `${rows.length} case(s) of ${what} in the ${corpus.set} set; routes are not tabulated by the harness.`,
    };
  };
  const toResult = (r: CaseReport, only?: CheckId): CaseResult => ({
    case: r.case,
    expected: r.expected,
    actual: r.actual,
    missingObservations: only === undefined ? r.missingObservations : r.missingObservations.filter((m) => m === only),
    matched: r.matched,
  });

  const links: EvaluationSummary["links"] = [];
  const entries: EvaluationSummary["entries"] = [];
  for (const test of testIds) {
    const entry = entryOf.get(test) as CoverageEntry;
    const rows = reports.filter((r) => r.test === test);
    const results = rows.map((r) => toResult(r)).sort(byId);
    entries.push({
      test,
      entryHash: entryHash(entry),
      level: entry.candidate as Exclude<Level, "none">,
      checkVersions: Object.fromEntries(
        [...new Set(entry.links.map((l) => l.check))].sort().map((c) => [c, declared.get(c) as string]),
      ),
      scope: scopeOf(rows, `test ${test}`),
      cases: results,
      table: tabulate(results),
    });
    for (const link of entry.links) {
      const forLink = rows.map((r) => toResult(r, link.check)).sort(byId);
      links.push({
        test,
        check: link.check,
        requirement: link.requirement,
        checkVersion: declared.get(link.check) as string,
        scope: scopeOf(rows, `test ${test}, link ${link.check} to ${link.requirement}`),
        cases: forLink,
        table: tabulate(forLink),
      });
    }
  }
  links.sort((a, b) => compareDottedIds(a.test, b.test) || (a.check < b.check ? -1 : a.check > b.check ? 1 : a.requirement < b.requirement ? -1 : 1));

  const engineRows = reports.filter((r) => r.kind === "engine").map((r) => toResult(r)).sort(byId);
  const candidate = {
    schemaVersion: 1 as const,
    ruleset: { id: plugin.id, version: plugin.version },
    corpus: { name: corpus.set, set: corpus.set, hash: corpus.hash },
    toolVersion: toolVersion(),
    createdAt,
    links,
    entries,
    engine: { cases: engineRows, table: tabulate(engineRows) },
  };
  const parsed = EvaluationSummarySchema.safeParse(candidate);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`);
    return { summary: null, note: `not written: the summary did not validate: ${issues.join("; ")}` };
  }
  return { summary: parsed.data, note: null };
}

/** The statuses in table order, for printing. */
export const STATUS_ORDER: readonly Status[] = STATUSES;
