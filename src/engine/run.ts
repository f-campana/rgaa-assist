/**
 * The M2 run (spec 5, 7.4, 8.3, 8.4, 8.8, 11.1): read the sample, establish
 * each target in a fresh context, run the providers on established targets,
 * derive and reduce with RGAA 4.1.2, write the run file.
 *
 * Claim boundary (spec 2): nothing here computes a rate, a score or a verdict.
 * With every entry at `enabled: none`, every finding is `needs_review` or
 * `not_tested`; that is the expected result.
 */
import type { Browser, BrowserContext } from "playwright";
import { canonicalHash, coverageMapHash } from "../schema/index.ts";
import type { EffectiveLevelRecord, Finding, Observation, RunFile, TargetExecution } from "../schema/index.ts";
import type { CheckProvider } from "../checks/types.ts";
import type { RulesetPlugin } from "../rulesets/contract.ts";
import { effectiveLevel } from "../rulesets/shared/index.ts";
import { loadRgaa412 } from "../rulesets/rgaa-4.1.2/index.ts";
import { CONTEXT_SETTINGS, effectiveTimeouts, launchBrowser } from "./browser.ts";
import type { EngineTimeouts } from "./browser.ts";
import { EngineBugError, effectiveOptions, runProviders, validateProviders } from "./run-checks.ts";
import type { RunCheckOptions } from "./run-checks.ts";
import type { PrivacyProbe } from "./editable-context.ts";
import {
  buildStatements,
  installedVersion,
  osDescription,
  sanitiseSample,
  sortRunFile,
  toolVersion,
  writeRunFile,
} from "./run-file.ts";
import { readSample, targetsOf } from "./sample.ts";
import type { TargetSpec } from "./sample.ts";
import { createSanitiser } from "./sanitise.ts";
import type { Sanitiser } from "./sanitise.ts";
import { establishTarget } from "./target.ts";

/** What examining one target gave. */
export interface TargetOutcome {
  execution: TargetExecution;
  /** Empty when the target was not established (7.4). */
  observations: Observation[];
  notEstablishedReason?: string;
  settled: boolean;
}

/**
 * Establish one target and, when it is established, run every provider on
 * it; then close its context. The engine and the test fixtures share this
 * path.
 */
export async function examineTarget(
  browser: Browser,
  spec: TargetSpec,
  input: {
    providers: readonly CheckProvider[];
    timeouts: EngineTimeouts;
    sanitiser: Sanitiser;
    runOptions?: RunCheckOptions;
    privacyProbe?: PrivacyProbe;
    prepareContext?: (context: BrowserContext) => Promise<void>;
  },
): Promise<TargetOutcome> {
  const handle = await establishTarget(browser, spec, {
    timeouts: input.timeouts,
    sanitiser: input.sanitiser,
    ...(input.prepareContext === undefined ? {} : { prepareContext: input.prepareContext }),
  });
  try {
    if (handle.examinable === undefined) {
      return {
        execution: handle.execution,
        observations: [],
        ...(handle.notEstablishedReason === undefined ? {} : { notEstablishedReason: handle.notEstablishedReason }),
        settled: handle.settled,
      };
    }
    const observations = await runProviders(handle.examinable, input.providers, {
      timeoutMs: input.timeouts.provider,
      sanitiser: input.sanitiser,
      ...(input.runOptions === undefined ? {} : { runOptions: input.runOptions }),
      ...(input.privacyProbe === undefined ? {} : { privacyProbe: input.privacyProbe }),
    });
    return { execution: handle.execution, observations, settled: handle.settled };
  } finally {
    await handle.close();
  }
}

export interface RunAuditInput {
  samplePath: string;
  outDir: string;
  /** Custom providers first, the axe provider last. The engine imports none. */
  providers: readonly CheckProvider[];
  timeouts?: Partial<EngineTimeouts>;
  /** Options by check id, overriding each definition's defaults key by key. */
  checkOptions?: RunCheckOptions;
  /** Test-only, in memory: never serialised or written to disk. */
  privacyProbe?: PrivacyProbe;
}

export interface RunAuditResult {
  /** 0 completed, 2 invalid input, 3 one or more targets not established (spec 11.1). */
  exitCode: 0 | 2 | 3;
  runFilePath?: string;
  messages: string[];
}

/** Effective levels of every entry of a plug-in, in official order. */
export function effectiveLevels(plugin: RulesetPlugin, checkVersions: Readonly<Record<string, string>>): EffectiveLevelRecord[] {
  return [...plugin.coverage.entries.values()].map((entry) =>
    effectiveLevel({ entry, approvals: plugin.coverage.approvals, evaluation: null, checkVersions }),
  );
}

/** Run an audit of the sample and write `<outDir>/run.json`. */
export async function runAudit(input: RunAuditInput): Promise<RunAuditResult> {
  const startedAt = new Date().toISOString();
  const messages: string[] = [];

  let timeouts: EngineTimeouts;
  try {
    timeouts = effectiveTimeouts(input.timeouts);
  } catch (e) {
    return { exitCode: 2, messages: [`timeouts: ${(e as Error).message}`] };
  }

  const read = readSample(input.samplePath);
  if (!read.ok) return { exitCode: 2, messages: read.messages };
  const { sample, sha256: sampleFileHash } = read;

  const plugin = loadRgaa412();
  const registry = new Set(plugin.coverage.checks.checks.map((c) => c.id));
  validateProviders(input.providers, registry);
  const declared = new Map(input.providers.flatMap((p) => p.checks.map((d) => [d.id, d] as const)));
  for (const id of Object.keys(input.checkOptions ?? {})) {
    if (!declared.has(id)) return { exitCode: 2, messages: [`checkOptions: no provider declares check ${id}`] };
  }

  const sanitiser = createSanitiser(sample.safeQueryParams);
  const specs = targetsOf(sample);
  const outcomes: TargetOutcome[] = [];

  const browser = await launchBrowser();
  let browserVersion: string;
  try {
    browserVersion = browser.version();
    for (const spec of specs) {
      const outcome = await examineTarget(browser, spec, {
        providers: input.providers,
        timeouts,
        sanitiser,
        ...(input.checkOptions === undefined ? {} : { runOptions: input.checkOptions }),
        ...(input.privacyProbe === undefined ? {} : { privacyProbe: input.privacyProbe }),
      });
      outcomes.push(outcome);
      if (outcome.execution.established) {
        messages.push(`${spec.targetId}: established; ${outcome.observations.length} observations`);
        if (!outcome.settled) messages.push(`${spec.targetId}: network idle not reached within ${timeouts.settle} ms (not a failure)`);
      } else {
        messages.push(`${spec.targetId}: not established: ${outcome.notEstablishedReason ?? "unknown reason"}`);
      }
    }
  } finally {
    await browser.close();
  }

  // Derivation and reduction (8.3, 8.4). A rejection here is an engine bug.
  const checkVersions = Object.fromEntries([...declared.values()].map((d) => [d.id, d.version]));
  const levels = effectiveLevels(plugin, checkVersions);
  const entries = levels.map((record) => {
    const entry = plugin.coverage.entries.get(record.test);
    if (entry === undefined) throw new EngineBugError(`no entry for ${record.test}`);
    return { entry, level: record.effective };
  });
  const targets = outcomes.map((o) => o.execution);
  const observations = outcomes.flatMap((o) => o.observations);
  const findings: Finding[] = [];
  for (const outcome of outcomes) {
    const derived = plugin.deriveFindings({ target: outcome.execution, observations: outcome.observations, entries });
    if (!derived.ok) {
      throw new EngineBugError(`derivation rejected ${outcome.execution.targetId}: ${JSON.stringify(derived.rejections)}`);
    }
    findings.push(...derived.findings);
  }
  const reduced = plugin.reduce({ sample, targets, findings });
  if (!reduced.ok) throw new EngineBugError(`reduction failed: ${JSON.stringify(reduced.errors)}`);

  const checkOptions = Object.fromEntries(
    [...declared.values()].map((d) => [d.id, effectiveOptions(d, input.checkOptions)]),
  );
  const run: RunFile = {
    schemaVersion: 1,
    statements: buildStatements({ ruleset: { id: plugin.id, version: plugin.version }, sample, targets, findings }),
    manifest: {
      toolVersion: toolVersion(),
      rulesets: [
        {
          id: plugin.id,
          version: plugin.version,
          sourceCommit: plugin.official.source.commit,
          coverageMapHash: coverageMapHash([...plugin.coverage.entries.values()]),
          evaluationSummaryHash: null,
          approvalLogHash: canonicalHash(plugin.coverage.approvals),
        },
      ],
      versions: {
        axeCore: installedVersion("axe-core"),
        playwright: installedVersion("playwright"),
        browser: `chromium ${browserVersion}`,
      },
      os: osDescription(),
      locale: CONTEXT_SETTINGS.locale,
      timeouts: { ...timeouts },
      checkOptions,
      sampleFileHash,
      startedAt,
      endedAt: new Date().toISOString(),
      model: null,
    },
    sample: sanitiseSample(sample, sanitiser),
    sampleWarnings: plugin.checkSample(sample),
    targets,
    observations,
    effectiveLevels: [{ ruleset: plugin.id, levels }],
    findings,
    reduced: [reduced.reduced],
    evidenceFiles: [],
    modelDisclosures: [],
  };
  const runFilePath = writeRunFile(input.outDir, sortRunFile(run));
  messages.push(`run file written: ${runFilePath}`);
  const exitCode = targets.every((t) => t.established) ? 0 : 3;
  return { exitCode, runFilePath, messages };
}
