/**
 * The axe adapter (spec 5.1): one provider for the 67 axe-core rules that carry
 * an RGAA test tag (`src/rulesets/rgaa-4.1.2/axe-rules.json`). It runs
 * axe-core through `@axe-core/playwright` on the established page and maps each
 * rule's result to one check result. Read-only on the page apart from axe-core
 * putting its own `window.axe` global in each frame it enters. Writes no file.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AxeResults } from "axe-core";
import { AxeBuilder } from "@axe-core/playwright";
import type { CheckId } from "../../schema/index.ts";
import type { CheckContext, CheckDefinition, CheckFailure, CheckProvider, CheckRunResult } from "../types.ts";
import { blockUnscriptableFrames } from "./frames.ts";
import { SCOPE_PROBE_RULE, mapRule, testedFrameCount, untestedFramesOf } from "./map.ts";
import type { ScopeGap } from "./map.ts";

export const ADAPTER_VERSION = 1;

interface AxeRuleFile {
  axeVersion: string;
  rules: { id: string }[];
}

const RULES_FILE = join(import.meta.dirname, "..", "..", "rulesets", "rgaa-4.1.2", "axe-rules.json");
const ruleFile = JSON.parse(readFileSync(RULES_FILE, "utf8")) as AxeRuleFile;

/** The 67 rules, in file order. */
export const AXE_RULE_IDS: readonly string[] = ruleFile.rules.map((r) => r.id);
export const AXE_VERSION = ruleFile.axeVersion;
export const CHECK_VERSION = `axe-core@${AXE_VERSION}+adapter.${ADAPTER_VERSION}`;

/** Effective options of every check of this provider (recorded in the manifest and each observation). */
export const DEFAULT_OPTIONS: Readonly<Record<string, unknown>> = Object.freeze({
  /** Exactly these rules run, including those axe disables by default. */
  rules: AXE_RULE_IDS,
  runOnly: "rules above, plus the scope probe below",
  /** Not a check: reports the frames axe could not analyse. Its result never becomes an observation. */
  scopeProbeRule: SCOPE_PROBE_RULE,
  resultTypes: ["violations", "incomplete", "passes", "inapplicable"],
  /** Frames are examined, cross-site ones too (partial results are merged in a blank page of the same context). */
  iframes: true,
  legacyMode: false,
  /** Longest list of locators in the `scope_examined` evidence of a `no_fault`. */
  passLocatorCap: 25,
  /** How long a frame gets to fire a timer before it is taken for a frame in which scripts are blocked. */
  frameProbeTimeoutMs: 1500,
});

const checkIdOf = (rule: string): CheckId => `axe/${rule}`;

export const axeChecks: readonly CheckDefinition[] = AXE_RULE_IDS.map((rule) => ({
  id: checkIdOf(rule),
  version: CHECK_VERSION,
  defaultOptions: DEFAULT_OPTIONS,
}));

function allFail(message: string): Map<CheckId, CheckRunResult> {
  const failure: CheckFailure = { outcome: "error", kind: "check_error", message };
  return new Map(AXE_RULE_IDS.map((r) => [checkIdOf(r), failure]));
}

function numberOption(options: Readonly<Record<string, unknown>>, key: string, fallback: number): number {
  const v = options[key];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
}

async function runAxe(ctx: CheckContext, timeoutMs: number): Promise<{ results: AxeResults; blockedGaps: ScopeGap[] }> {
  const blocked = await blockUnscriptableFrames(ctx.frames, timeoutMs);
  try {
    if (blocked.mainBlocked) throw new Error("scripts do not run in the main frame of the page");
    const run = new AxeBuilder({ page: ctx.page })
      .options({
        runOnly: { type: "rule", values: [...AXE_RULE_IDS, SCOPE_PROBE_RULE] },
        resultTypes: ["violations", "incomplete", "passes", "inapplicable"],
        iframes: true,
      })
      .analyze();
    const aborted = new Promise<never>((_, reject) => {
      const onAbort = () => reject(new Error("axe run aborted: the provider timeout expired"));
      if (ctx.signal.aborted) onAbort();
      else ctx.signal.addEventListener("abort", onAbort, { once: true });
    });
    // If the abort wins, the analysis may still settle later; its outcome is ignored.
    run.catch(() => undefined);
    const results = await Promise.race([run, aborted]);
    return { results, blockedGaps: blocked.gaps };
  } finally {
    blocked.restore();
  }
}

export const axeProvider: CheckProvider = {
  name: "axe",
  checks: axeChecks,
  async run(ctx: CheckContext): Promise<ReadonlyMap<CheckId, CheckRunResult>> {
    const options = ctx.options.get(axeChecks[0]!.id) ?? DEFAULT_OPTIONS;
    const passLocatorCap = Math.floor(numberOption(options, "passLocatorCap", 25));
    const timeoutMs = numberOption(options, "frameProbeTimeoutMs", 1500);

    let results: AxeResults;
    let blockedGaps: ScopeGap[];
    try {
      ({ results, blockedGaps } = await runAxe(ctx, timeoutMs));
    } catch (e) {
      return allFail(`axe-core run failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (results.testEngine.version !== AXE_VERSION) {
      return allFail(`axe-core ${results.testEngine.version} ran, but the rule list is for ${AXE_VERSION}`);
    }

    const gaps = [...untestedFramesOf(results), ...blockedGaps];
    const tested = testedFrameCount(results);
    const out = new Map<CheckId, CheckRunResult>();
    for (const rule of AXE_RULE_IDS) {
      out.set(checkIdOf(rule), mapRule(checkIdOf(rule), rule, results, gaps, tested, { passLocatorCap }));
    }
    return out;
  },
};
