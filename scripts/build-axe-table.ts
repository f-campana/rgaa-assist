// Builds src/rulesets/rgaa-4.1.2/axe-rules.json from the installed axe-core.
// An axe tag only says a rule is relevant to an RGAA test. It never says the
// rule decides the test.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const axe = require("axe-core") as typeof import("axe-core");

export const AXE_TABLE_PATH = join(
  import.meta.dirname,
  "..",
  "src",
  "rulesets",
  "rgaa-4.1.2",
  "axe-rules.json",
);

export interface AxeRuleEntry {
  id: string;
  rgaaTests: string[];
  tags: string[];
  bestPractice: boolean;
  experimental: boolean;
  enabledByDefault: boolean;
  description: string;
  help: string;
  helpUrl: string;
}

export interface AxeTable {
  axeVersion: string;
  rules: AxeRuleEntry[];
  testIndex: Record<string, string[]>;
}

// Tags are spelled "RGAA-<theme>.<criterion>.<test>", e.g. "RGAA-1.1.2".
// Every such rule also carries the marker tag "RGAAv4", which is not a test.
const TEST_TAG = /^RGAA-(\d+\.\d+\.\d+)$/;

function compareIds(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function buildAxeTable(): AxeTable {
  const rules: AxeRuleEntry[] = [];
  // axe.getRules() is the public API. Its `enabled` is the rule's own enabled
  // flag and not carrying a tag in the audit's default tagExclude
  // (experimental): whether axe.run() runs the rule with no options.
  for (const rule of axe.getRules()) {
    const rgaaTests = rule.tags
      .map((t) => TEST_TAG.exec(t)?.[1])
      .filter((t): t is string => t !== undefined)
      .sort(compareIds);
    if (rgaaTests.length === 0) continue;
    rules.push({
      id: rule.ruleId,
      rgaaTests,
      tags: [...rule.tags],
      bestPractice: rule.tags.includes("best-practice"),
      experimental: rule.tags.includes("experimental"),
      enabledByDefault: rule.enabled,
      description: rule.description,
      help: rule.help,
      helpUrl: rule.helpUrl,
    });
  }
  rules.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const index = new Map<string, string[]>();
  for (const r of rules) {
    for (const t of r.rgaaTests) index.set(t, [...(index.get(t) ?? []), r.id]);
  }
  const testIndex: Record<string, string[]> = {};
  for (const t of [...index.keys()].sort(compareIds)) testIndex[t] = index.get(t)!;

  return { axeVersion: axe.version, rules, testIndex };
}

export function serializeAxeTable(table: AxeTable): string {
  return `${JSON.stringify(table, null, 2)}\n`;
}

export function readCommittedAxeTable(): string {
  return readFileSync(AXE_TABLE_PATH, "utf8");
}

if (import.meta.main) {
  const table = buildAxeTable();
  writeFileSync(AXE_TABLE_PATH, serializeAxeTable(table));
  console.log(
    `axe-core ${table.axeVersion}: ${table.rules.length} rules, ${Object.keys(table.testIndex).length} RGAA tests -> ${AXE_TABLE_PATH}`,
  );
}
