/**
 * Small builders for the contract tests (spec 6.3, 8.3, 8.4).
 *
 * Every builder parses its result through the schema, so an invalid fixture
 * fails loudly instead of testing something the contract never accepts.
 * Raw builders (`rawEntry`, `rawObservation`, `rawTarget`) return plain
 * objects for the tests that feed deliberately invalid input.
 */
import { expect } from "vitest";
import { deriveFindings } from "../../src/rulesets/shared/index.ts";
import type { DeriveFindingsInput, DeriveFindingsResult } from "../../src/rulesets/contract.ts";
import {
  ApprovalLogSchema,
  CoverageEntrySchema,
  EvaluationSummarySchema,
  FindingSchema,
  ObservationSchema,
  SampleFileSchema,
  TargetExecutionSchema,
  caseMatches,
  entryHash,
  tabulate,
} from "../../src/schema/index.ts";
import type {
  ApprovalLog,
  ApproverRole,
  CoverageEntry,
  EvaluationSummary,
  Finding,
  Level,
  Observation,
  Outcome,
  Prerequisite,
  Reason,
  SampleFile,
  Status,
  TargetExecution,
} from "../../src/schema/index.ts";

export const RULESET = "rgaa-4.1.2";
export const H0 = "0".repeat(64);

// ---------------------------------------------------------------------------
// Coverage entries
// ---------------------------------------------------------------------------

/**
 * How a link relates to its requirement. Each requirement `r` has routes
 * `r-a`, `r-b` and exception `r-x`.
 * - `resolving`: every route and exception, scope `whole`, `evidence_only`.
 * - `resolving_failure`: the same, with `faultMeans: failure`.
 * - `failure_partial`: every route and exception, scope `partial`,
 *   `failure`. Authoritative for a fault only; not resolving.
 * - `advisory`: route `r-a` only, scope `partial`, `evidence_only`. Neither
 *   resolving nor `failure`.
 */
export type LinkKind = "resolving" | "resolving_failure" | "failure_partial" | "advisory";

export interface LinkSpec {
  check: string;
  kind: LinkKind;
  /** Requirement id; default `r1`. */
  req?: string;
}

export interface EntrySpec {
  test?: string;
  /** Requirement ids; default `["r1"]`. */
  reqs?: string[];
  links?: LinkSpec[];
  /** Default: `enabled`. */
  candidate?: Level;
  /** Default `full`. */
  enabled?: Level;
  applicability?: "structural" | "judgment" | "always";
  needs?: Prerequisite[];
  /** Rationale text; default "Why.". */
  rationale?: string;
}

function cite(test: string): { source: "test"; test: string; quote: string }[] {
  return [{ source: "test", test, quote: "citation" }];
}

export function rawLink(l: LinkSpec): Record<string, any> {
  const req = l.req ?? "r1";
  const all = [`${req}-a`, `${req}-b`, `${req}-x`];
  switch (l.kind) {
    case "resolving":
      return { check: l.check, requirement: req, routes: all, scope: "whole", faultMeans: "evidence_only" };
    case "resolving_failure":
      return { check: l.check, requirement: req, routes: all, scope: "whole", faultMeans: "failure" };
    case "failure_partial":
      return { check: l.check, requirement: req, routes: all, scope: "partial", faultMeans: "failure" };
    case "advisory":
      return { check: l.check, requirement: req, routes: [`${req}-a`], scope: "partial", faultMeans: "evidence_only" };
  }
}

/** A plain-object entry, not parsed. */
export function rawEntry(spec: EntrySpec = {}): Record<string, any> {
  const test = spec.test ?? "1.1.1";
  const reqs = spec.reqs ?? ["r1"];
  const enabled = spec.enabled ?? "full";
  return {
    test,
    requirements: reqs.map((r) => ({
      id: r,
      statement: `Requirement ${r}.`,
      citations: cite(test),
      routes: [
        { id: `${r}-a`, statement: "Route a.", citations: cite(test) },
        { id: `${r}-b`, statement: "Route b.", citations: cite(test) },
      ],
      exceptions: [{ id: `${r}-x`, statement: "Exception x.", citations: cite(test) }],
    })),
    links: (spec.links ?? []).map(rawLink),
    candidate: spec.candidate ?? enabled,
    enabled,
    applicability: spec.applicability ?? "structural",
    needs: spec.needs ?? [],
    rationale: { text: spec.rationale ?? "Why.", citations: cite(test) },
  };
}

/** A schema-valid entry. Throws when the spec describes an entry the schema refuses. */
export function entry(spec: EntrySpec = {}): CoverageEntry {
  return CoverageEntrySchema.parse(rawEntry(spec));
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

export const T_INITIAL = "p/initial";
export const T_STATE = "p/open";

/**
 * An established target. `initial` targets have no steps and no declared
 * expect; any other state has one step and an expect met only after it.
 * `met` is `prerequisitesMet`; default `[]` on `initial`, `["state"]` otherwise.
 */
export function rawTarget(targetId = T_INITIAL, met?: Prerequisite[]): Record<string, any> {
  const initial = targetId.endsWith("/initial");
  return {
    targetId,
    requestedUrl: "https://example.com/p",
    effectiveUrl: "https://example.com/p",
    viewport: { requested: { width: 1280, height: 800 }, applied: { width: 1280, height: 800 } },
    sessionLoaded: false,
    prerequisitesMet: met ?? (initial ? [] : ["state"]),
    steps: initial ? [] : [{ action: "click", ok: true }],
    expect: initial
      ? { declared: false, metBeforeSteps: null, met: null }
      : { declared: true, metBeforeSteps: false, met: true },
    established: true,
  };
}

export function target(targetId = T_INITIAL, met?: Prerequisite[]): TargetExecution {
  return TargetExecutionSchema.parse(rawTarget(targetId, met));
}

/**
 * A target that was not established.
 * - `expect_not_met`: the steps ran, `expect` was not met after them.
 * - `expect_already_met`: `expect` was already met before the steps (7.3).
 * - `step_failed`: a step failed.
 * - `initial_redirect`: an `initial` target whose page `expect` was not met.
 */
export function unestablished(
  targetId = T_STATE,
  how: "expect_not_met" | "expect_already_met" | "step_failed" | "initial_redirect" = "expect_not_met",
): TargetExecution {
  const base = rawTarget(targetId, []);
  base.established = false;
  switch (how) {
    case "expect_not_met":
      base.expect = { declared: true, metBeforeSteps: false, met: false };
      break;
    case "expect_already_met":
      base.expect = { declared: true, metBeforeSteps: true, met: null };
      break;
    case "step_failed":
      base.steps = [{ action: "click", ok: false, error: "locator timed out" }];
      base.expect = { declared: true, metBeforeSteps: false, met: null };
      break;
    case "initial_redirect":
      base.steps = [];
      base.expect = { declared: true, metBeforeSteps: null, met: false };
      break;
  }
  return TargetExecutionSchema.parse(base);
}

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------

export interface ObsOptions {
  id?: string;
  targetId?: string;
  /** For `error` outcomes; default `check_error`. */
  errorKind?: "check_error" | "scope_unreadable";
}

export function rawObservation(checkId: string, outcome: Outcome, o: ObsOptions = {}): Record<string, any> {
  const evidence: Record<string, any>[] = [];
  if (outcome === "fault") evidence.push({ id: "e1", kind: "dom_node", locator: "css=object", snippet: "<object>" });
  if (outcome === "no_fault") evidence.push({ id: "e1", kind: "scope_examined", note: "2 elements examined" });
  if (outcome === "inapplicable") evidence.push({ id: "e1", kind: "scope_examined", note: "nothing matched" });
  const obs: Record<string, any> = {
    id: o.id ?? `o:${checkId}`,
    checkId,
    checkVersion: "1.0.0",
    options: {},
    targetId: o.targetId ?? T_INITIAL,
    outcome,
    evidence,
    fingerprint: `fp:${checkId}`,
  };
  if (outcome === "error") obs.error = { kind: o.errorKind ?? "check_error", message: "it broke" };
  return obs;
}

export function obs(checkId: string, outcome: Outcome, o: ObsOptions = {}): Observation {
  return ObservationSchema.parse(rawObservation(checkId, outcome, o));
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

export interface DeriveOptions {
  level?: Level;
  target?: TargetExecution;
}

/** Call `deriveFindings` with one entry and return its single finding, checked against `FindingSchema`. */
export function derive1(e: CoverageEntry, observations: Observation[], o: DeriveOptions = {}): Finding {
  const result = deriveFindings({
    ruleset: RULESET,
    target: o.target ?? target(),
    observations,
    entries: [{ entry: e, level: o.level ?? e.enabled }],
  });
  return onlyFinding(result);
}

export function onlyFinding(result: DeriveFindingsResult): Finding {
  if (!result.ok) throw new Error(`rejected: ${JSON.stringify(result.rejections)}`);
  expect(result.findings).toHaveLength(1);
  const f = result.findings[0]!;
  FindingSchema.parse(f);
  return f;
}

/** Call `deriveFindings` with input that may be invalid, typed loosely on purpose. */
export function deriveRaw(input: {
  target: unknown;
  observations: unknown[];
  entries: { entry: unknown; level: Level }[];
}): DeriveFindingsResult {
  return deriveFindings({ ruleset: RULESET, ...input } as unknown as DeriveFindingsInput);
}

// ---------------------------------------------------------------------------
// Approvals and evaluation (spec 6.3)
// ---------------------------------------------------------------------------

const AT = "2026-11-16T12:00:00Z";

export type LogEventSpec =
  | { kind: "approval"; test: string; hash: string; level: Exclude<Level, "none">; roles: ApproverRole[] }
  | { kind: "demotion"; test: string; level: Exclude<Level, "full"> };

export function approve(e: CoverageEntry, level: Exclude<Level, "none">, roles: ApproverRole[]): LogEventSpec {
  return { kind: "approval", test: e.test, hash: entryHash(e), level, roles };
}

export function demote(e: CoverageEntry | { test: string }, level: Exclude<Level, "full">): LogEventSpec {
  return { kind: "demotion", test: e.test, level };
}

/** The roles an approval needs, written out so the tests do not depend on `requiredApprovers`. */
export const ROLES = {
  fabien: ["fabien"] as ApproverRole[],
  pair: ["orchestrator", "codex"] as ApproverRole[],
  all: ["fabien", "orchestrator", "codex"] as ApproverRole[],
};

/** An approval log with `seq` 1, 2, 3… in the order given. */
export function log(...events: LogEventSpec[]): ApprovalLog {
  return ApprovalLogSchema.parse({
    schemaVersion: 1,
    events: events.map((ev, i) =>
      ev.kind === "approval"
        ? {
            seq: i + 1,
            kind: "approval",
            test: ev.test,
            entryHash: ev.hash,
            level: ev.level,
            approvers: ev.roles.map((role) => ({ role, name: `holder of ${role}` })),
            corpusCases: ["case-1"],
            evaluationSummaryHash: H0,
            at: AT,
          }
        : { seq: i + 1, kind: "demotion", test: ev.test, level: ev.level, reason: "lowered for the test", by: "someone", at: AT },
    ),
  });
}

export interface MeasurementSpec {
  /** Default: `entryHash(entry)`. */
  hash?: string;
  /** Default `full`. */
  level?: Exclude<Level, "none">;
  /** Default: every linked check at `1.0.0`. */
  checkVersions?: Record<string, string>;
  /** `matched` flag of each case; default `[true, true]`. */
  cases?: boolean[];
}

function caseResult(id: string, matched: boolean): Record<string, any> {
  const expected = { status: "passed" as Status };
  const actual = { kind: "finding" as const, status: (matched ? "passed" : "failed") as Status, complete: true };
  return { case: id, expected, actual, missingObservations: [], matched: caseMatches(expected, actual) };
}

/** The distinct check ids an entry links, sorted. */
export function linkedChecks(e: CoverageEntry): string[] {
  return [...new Set(e.links.map((l) => l.check))].sort();
}

/** The versions of every linked check, all at `version`. */
export function versionsOf(e: CoverageEntry, version = "1.0.0"): Record<string, string> {
  return Object.fromEntries(linkedChecks(e).map((c) => [c, version]));
}

export function measurement(e: CoverageEntry, m: MeasurementSpec = {}): Record<string, any> {
  const cases = (m.cases ?? [true, true]).map((ok, i) => caseResult(`case-${i + 1}`, ok));
  return {
    test: e.test,
    entryHash: m.hash ?? entryHash(e),
    level: m.level ?? "full",
    checkVersions: m.checkVersions ?? versionsOf(e),
    scope: { branches: ["valid"], routes: [], description: "Measured scope." },
    cases,
    table: tabulate(cases as never),
  };
}

export function summary(...measurements: Record<string, any>[]): EvaluationSummary {
  return EvaluationSummarySchema.parse({
    schemaVersion: 1,
    ruleset: { id: RULESET, version: "4.1.2" },
    corpus: { name: "working", set: "working", hash: H0 },
    toolVersion: "0.0.0",
    createdAt: AT,
    links: [],
    entries: measurements,
    engine: { cases: [], table: tabulate([]) },
  });
}

// ---------------------------------------------------------------------------
// Reduction (spec 8.4)
// ---------------------------------------------------------------------------

export interface PageSpec {
  id: string;
  /** Declared state ids, in order. */
  states?: string[];
}

export function sample(pages: PageSpec[], processes: { id: string; steps: string[] }[] = []): SampleFile {
  return SampleFileSchema.parse({
    project: { name: "Contract sample", ruleset: RULESET },
    processes: processes.map((p) => ({ ...p, name: `Process ${p.id}` })),
    pages: pages.map((p) => ({
      id: p.id,
      url: `https://example.com/${p.id}`,
      kinds: ["random"],
      states: (p.states ?? []).map((s) => ({
        id: s,
        steps: [{ click: `role=button[name='${s}']` }],
        expect: { visible: `role=region[name='${s}']` },
      })),
    })),
  });
}

/** A finding as `deriveFindings` would return it, checked against `FindingSchema`. */
export function finding(
  test: string,
  targetId: string,
  status: Status,
  o: { reason?: Reason; complete?: boolean; notRun?: string[]; ruleset?: string } = {},
): Finding {
  const raw: Record<string, any> = {
    ruleset: o.ruleset ?? RULESET,
    test,
    targetId,
    status,
    complete: o.complete ?? (o.notRun === undefined || o.notRun.length === 0),
    notRun: o.notRun ?? [],
    requirementFacts: {},
    observations: [],
  };
  if (o.reason !== undefined) raw.reason = o.reason;
  if (status === "not_tested" && (o.reason === "target_not_established" || o.reason === "expect_already_met")) {
    raw.complete = false;
  }
  return FindingSchema.parse(raw);
}

/** Shortcuts for the most common findings. */
export const F = {
  passed: (test: string, t: string) => finding(test, t, "passed"),
  failed: (test: string, t: string) => finding(test, t, "failed"),
  na: (test: string, t: string) => finding(test, t, "not_applicable"),
  review: (test: string, t: string, reason: Reason = "not_enabled") => finding(test, t, "needs_review", { reason }),
  notTested: (test: string, t: string, reason: Reason = "target_not_established") =>
    finding(test, t, "not_tested", { reason }),
};

/** The declared targets of a sample, in order: `<page>/initial`, then each declared state. */
export function declaredTargets(s: SampleFile): string[] {
  return s.pages.flatMap((p) => [`${p.id}/initial`, ...p.states.map((st) => `${p.id}/${st.id}`)]);
}

/** One established execution per declared target, except those listed as not established. */
export function executions(s: SampleFile, notEstablished: string[] = []): TargetExecution[] {
  return declaredTargets(s).map((t) => (notEstablished.includes(t) ? unestablished(t, t.endsWith("/initial") ? "initial_redirect" : "expect_not_met") : target(t)));
}

/** A deterministic shuffle: reverse, then rotate by one. */
export function shuffled<T>(xs: readonly T[]): T[] {
  const r = [...xs].reverse();
  return r.length < 2 ? r : [...r.slice(1), r[0]!];
}
