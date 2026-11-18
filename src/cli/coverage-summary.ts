/**
 * The coverage map summary (spec 11.1 `coverage`): counts of entries and of
 * registry checks. Counts only: no rate, no share of a total, no verdict.
 */
import { LEVELS } from "../schema/index.ts";
import type { Level } from "../schema/index.ts";
import type { RulesetPlugin } from "../rulesets/contract.ts";

export type LevelCounts = Record<Level, number>;

export interface CoverageSummary {
  ruleset: { id: string; version: string };
  byCandidate: LevelCounts;
  byEnabled: LevelCounts;
  /** Per theme (two digits), in theme order. */
  byTheme: { theme: string; candidate: LevelCounts; enabled: LevelCounts }[];
  checks: {
    byKind: Record<string, number>;
    exists: { built: number; notBuilt: number };
    byKindAndExists: { kind: string; built: number; notBuilt: number }[];
  };
}

const zero = (): LevelCounts => Object.fromEntries(LEVELS.map((l) => [l, 0])) as LevelCounts;

export function summariseCoverage(plugin: RulesetPlugin): CoverageSummary {
  const byCandidate = zero();
  const byEnabled = zero();
  const themes = new Map<string, { candidate: LevelCounts; enabled: LevelCounts }>();
  for (const entry of plugin.coverage.entries.values()) {
    byCandidate[entry.candidate] += 1;
    byEnabled[entry.enabled] += 1;
    const theme = (entry.test.split(".")[0] ?? "").padStart(2, "0");
    const t = themes.get(theme) ?? { candidate: zero(), enabled: zero() };
    t.candidate[entry.candidate] += 1;
    t.enabled[entry.enabled] += 1;
    themes.set(theme, t);
  }
  const byKind: Record<string, number> = {};
  const kinds = new Map<string, { built: number; notBuilt: number }>();
  let built = 0;
  let notBuilt = 0;
  for (const check of plugin.coverage.checks.checks) {
    byKind[check.kind] = (byKind[check.kind] ?? 0) + 1;
    const k = kinds.get(check.kind) ?? { built: 0, notBuilt: 0 };
    if (check.exists) {
      k.built += 1;
      built += 1;
    } else {
      k.notBuilt += 1;
      notBuilt += 1;
    }
    kinds.set(check.kind, k);
  }
  return {
    ruleset: { id: plugin.id, version: plugin.version },
    byCandidate,
    byEnabled,
    byTheme: [...themes.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([theme, v]) => ({ theme, ...v })),
    checks: {
      byKind,
      exists: { built, notBuilt },
      byKindAndExists: [...kinds.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([kind, v]) => ({ kind, ...v })),
    },
  };
}

function levelsLine(c: LevelCounts): string {
  return LEVELS.map((l) => `${l} ${c[l]}`).join(", ");
}

export function formatCoverage(s: CoverageSummary): string {
  const lines = [
    `Coverage map of ${s.ruleset.id} (${s.ruleset.version}): counts of entries, not a measure of any site.`,
    "",
    `Entries by candidate level: ${levelsLine(s.byCandidate)}`,
    `Entries by enabled level:   ${levelsLine(s.byEnabled)}`,
    "",
    "Per theme (candidate | enabled):",
    ...s.byTheme.map((t) => `  theme ${t.theme}: ${levelsLine(t.candidate)} | ${levelsLine(t.enabled)}`),
    "",
    "Checks in the registry by kind and by whether they exist:",
    ...s.checks.byKindAndExists.map((k) => `  ${k.kind}: ${k.built} built, ${k.notBuilt} not built`),
    `  all kinds: ${s.checks.exists.built} built, ${s.checks.exists.notBuilt} not built`,
  ];
  return lines.join("\n");
}
