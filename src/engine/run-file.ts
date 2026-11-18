/**
 * Assembling, sorting, validating and writing the run file (spec 2.3, 8.8;
 * `src/schema/run.ts`).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, release, type } from "node:os";
import { join } from "node:path";
import {
  RunFileSchema,
  SAMPLE_UNVERIFIABLE,
  WHAT_THIS_IS_NOT,
  compareDottedIds,
  splitTargetId,
} from "../schema/index.ts";
import type {
  EffectiveLevelRecord,
  Finding,
  NeedsReviewReason,
  NotTestedReason,
  Observation,
  ReducedResults,
  RunFile,
  SampleFile,
  Statements,
  TargetExecution,
} from "../schema/index.ts";
import type { Sanitiser } from "./sanitise.ts";

const PACKAGE_ROOT = join(import.meta.dirname, "..", "..");
const require = createRequire(import.meta.url);

/** JavaScript string order (UTF-16 code units), the order of `canonicalJson`. */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The tool version: `package.json` version, plus `+git.<commit>` when the
 * package is a git checkout, plus `.dirty` when it has uncommitted changes.
 */
export function toolVersion(): string {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as { version: string };
  try {
    const opts = { cwd: PACKAGE_ROOT, encoding: "utf8" as const, stdio: ["ignore", "pipe", "ignore"] as ["ignore", "pipe", "ignore"] };
    const commit = execFileSync("git", ["rev-parse", "HEAD"], opts).trim();
    if (!/^[0-9a-f]{40}$/.test(commit)) return pkg.version;
    const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], opts).trim().length > 0;
    return `${pkg.version}+git.${commit}${dirty ? ".dirty" : ""}`;
  } catch {
    return pkg.version;
  }
}

/** Installed version of a package, read at run time. */
export function installedVersion(pkg: "axe-core" | "playwright"): string {
  return (require(`${pkg}/package.json`) as { version: string }).version;
}

/** `Darwin 25.6.0 arm64` */
export function osDescription(): string {
  return `${type()} ${release()} ${arch()}`;
}

/** The sample as it goes into the run file: every URL through the sanitiser (8.7). */
export function sanitiseSample(sample: SampleFile, sanitiser: Sanitiser): SampleFile {
  const copy = structuredClone(sample);
  const url = (u: string): string => sanitiser.url(u).value;
  for (const page of copy.pages) {
    page.url = url(page.url);
    if (page.expect?.url !== undefined) page.expect.url = url(page.expect.url);
    for (const state of page.states) {
      if (state.expect.url !== undefined) state.expect.url = url(state.expect.url);
      state.steps = state.steps.map((step) => ("navigate" in step ? { navigate: url(step.navigate) } : step));
    }
  }
  for (const doc of copy.documents) doc.url = url(doc.url);
  return copy;
}

/** The three statements (spec 2.3), from what actually happened. */
export function buildStatements(input: {
  ruleset: { id: string; version: string };
  sample: SampleFile;
  targets: readonly TargetExecution[];
  findings: readonly Finding[];
}): Statements {
  const established = new Set(input.targets.filter((t) => t.established).map((t) => t.targetId));
  const pagesExamined = input.sample.pages
    .map((p) => p.id)
    .filter((id) => [...established].some((t) => splitTargetId(t).pageId === id))
    .sort(compareStrings);
  const onExamined = sortFindings(input.findings.filter((f) => established.has(f.targetId)));
  const decided = new Set(
    onExamined.filter((f) => f.status === "passed" || f.status === "failed" || f.status === "not_applicable").map((f) => f.test),
  );
  return {
    covered: {
      ruleset: { ...input.ruleset },
      pagesExamined,
      targetsExamined: [...established].sort(compareStrings),
      testsDecided: decided.size,
    },
    notCovered: {
      testsForReview: onExamined
        .filter((f) => f.status === "needs_review")
        .map((f) => ({ test: f.test, targetId: f.targetId, reason: f.reason as NeedsReviewReason })),
      testsNotTested: onExamined
        .filter((f) => f.status === "not_tested")
        .map((f) => ({ test: f.test, targetId: f.targetId, reason: f.reason as NotTestedReason })),
      targetsNotExamined: input.targets
        .filter((t) => !t.established)
        .map((t) => ({ targetId: t.targetId, reason: "target_not_established" as const }))
        .sort((a, b) => compareStrings(a.targetId, b.targetId)),
      sampleUnverifiable: [...SAMPLE_UNVERIFIABLE],
    },
    whatThisIsNot: WHAT_THIS_IS_NOT,
  };
}

/** Findings by ruleset, test in official order, then target. */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => compareStrings(a.ruleset, b.ruleset) || compareDottedIds(a.test, b.test) || compareStrings(a.targetId, b.targetId),
  );
}

/** Observations by target, then check id. Evidence keeps its `e001…` order, which is id order. */
export function sortObservations(observations: readonly Observation[]): Observation[] {
  return [...observations]
    .map((o) => ({ ...o, evidence: [...o.evidence].sort((a, b) => compareStrings(a.id, b.id)) }))
    .sort((a, b) => compareStrings(a.targetId, b.targetId) || compareStrings(a.checkId, b.checkId));
}

/** Every array of the run file in the order `run.ts` documents. */
export function sortRunFile(run: RunFile): RunFile {
  return {
    ...run,
    targets: [...run.targets].sort((a, b) => compareStrings(a.targetId, b.targetId)),
    observations: sortObservations(run.observations),
    effectiveLevels: [...run.effectiveLevels]
      .sort((a, b) => compareStrings(a.ruleset, b.ruleset))
      .map((r) => ({ ...r, levels: [...r.levels].sort((a: EffectiveLevelRecord, b: EffectiveLevelRecord) => compareDottedIds(a.test, b.test)) })),
    findings: sortFindings(run.findings),
    reduced: [...run.reduced].sort((a: ReducedResults, b: ReducedResults) => compareStrings(a.ruleset, b.ruleset)),
    evidenceFiles: [...run.evidenceFiles].sort((a, b) => compareStrings(a.path, b.path)),
    modelDisclosures: [...run.modelDisclosures].sort((a, b) => compareStrings(a.evidenceId, b.evidenceId)),
  };
}

/**
 * Validate the whole file with `RunFileSchema`, then write
 * `<outDir>/run.json`, pretty-printed. Throws, writing nothing, when the file
 * does not validate: that is a bug in the engine.
 */
export function writeRunFile(outDir: string, run: RunFile): string {
  const parsed = RunFileSchema.safeParse(run);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 20).map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`the run file does not validate (engine bug):\n${issues.join("\n")}`);
  }
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "run.json");
  writeFileSync(path, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  return path;
}
