/**
 * Text form of an evaluation report. Counts only, each with its population
 * and the corpus it was measured on. No rate, percentage, score or verdict.
 */
import { STATUSES, WHAT_THIS_IS_NOT } from "../schema/index.ts";
import type { ResultTable } from "../schema/index.ts";
import { countPhrase } from "./evaluate.ts";
import type { CaseReport, EvaluationReport, Measures } from "./evaluate.ts";

const COLUMNS = [...STATUSES, "crash"] as const;
const SHORT: Record<string, string> = {
  passed: "passed",
  failed: "failed",
  not_applicable: "n/a",
  needs_review: "review",
  not_tested: "not_tested",
  crash: "crash",
};

export function formatTable(table: ResultTable, indent = "  "): string[] {
  const width = 11;
  const pad = (s: string): string => s.padEnd(width);
  const first = (s: string): string => s.padEnd(18);
  const lines = [`${indent}${first("expected \\ actual")}${COLUMNS.map((c) => pad(SHORT[c] as string)).join("")}`];
  for (const status of STATUSES) {
    const row = table.expected[status];
    lines.push(`${indent}${first(status)}${COLUMNS.map((c) => pad(String(row[c]))).join("")}`);
  }
  lines.push(`${indent}cases with at least one missing observation: ${table.missingObservations}, cases in the table: ${table.cases}`);
  return lines;
}

export function formatMeasures(m: Measures, label: string, indent = "  "): string[] {
  return [
    `${indent}False assurance (an unexpected passed or not_applicable, over all cases): ${countPhrase(m.falseAssurance, label)}`,
    `${indent}Missed fault (not failed, over the cases expecting failed): ${countPhrase(m.missedFault, label)}`,
    `${indent}False alarm (a failed, over the cases not expecting failed): ${countPhrase(m.falseAlarm, label)}`,
    `${indent}Unexpected error (over all cases): ${countPhrase(m.unexpectedError, label)}`,
  ];
}

function describeActual(c: CaseReport): string {
  if (c.actual.kind === "crash") return `crash (${c.actual.message.slice(0, 120)})`;
  return `${c.actual.status}${c.actual.reason === undefined ? "" : `/${c.actual.reason}`}${c.actual.complete ? "" : ", incomplete"}`;
}

function describeExpected(c: CaseReport): string {
  return `${c.expected.status}${c.expected.reason === undefined ? "" : `/${c.expected.reason}`}${c.expected.complete === undefined ? "" : c.expected.complete ? ", complete" : ", incomplete"}`;
}

export function formatReport(r: EvaluationReport, filePath?: string): string {
  const label = r.corpus.label;
  const out: string[] = [];
  out.push(`Evaluation of ${r.ruleset.id} on corpus ${label} (${r.corpus.cases} cases in the set, full hash ${r.corpus.hash})`);
  out.push(`Measured at each entry's candidate level, through an in-memory copy with enabled set to the candidate. Nothing was enabled or written to the coverage map.`);
  out.push(`Tool ${r.toolVersion}, run at ${r.createdAt}.`);
  out.push("");
  out.push("Check versions in this run:");
  const versions = Object.entries(r.checkVersions);
  if (versions.length === 0) out.push("  (no provider declared any check)");
  for (const [id, v] of versions) out.push(`  ${id} ${v}`);
  out.push("");
  out.push(`Matched: ${countPhrase(r.overall.matched, label)}`);
  out.push(...formatMeasures(r.overall.measures, label, ""));
  out.push("Table, all measured cases:");
  out.push(...formatTable(r.overall.table));
  if (r.unmeasured.length > 0) {
    out.push("");
    out.push(`Not measured: ${r.unmeasured.length} case(s)`);
    for (const u of r.unmeasured) out.push(`  ${u.case}: ${u.reason}`);
  }

  out.push("");
  out.push("Per test:");
  for (const t of r.tests) {
    out.push(`  Test ${t.test} (measured at ${t.level}, entry ${t.entryHash.slice(0, 12)})`);
    out.push(`    Matched: ${countPhrase(t.matched, label)}`);
    out.push(...formatMeasures(t.measures, label, "    "));
    out.push(...formatTable(t.table, "    "));
  }

  out.push("");
  out.push("Per check (outcomes over the cases that link it):");
  for (const c of r.checks) {
    const o = Object.entries(c.outcomes)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k} ${n}`)
      .join(", ");
    out.push(`  ${c.check}  [${c.built ? `built, version ${c.checkVersion ?? "unknown"}` : "not built"}]  ${c.cases} case(s): ${o === "" ? "none" : o}`);
  }

  out.push("");
  out.push("Per case:");
  for (const c of r.cases) {
    const outcomes = Object.entries(c.outcomes)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    out.push(`  ${c.matched ? "match   " : "MISMATCH"} ${c.case}: expected ${describeExpected(c)}; actual ${describeActual(c)}`);
    if (outcomes !== "") out.push(`           ${outcomes}`);
  }

  out.push("");
  out.push(`Evaluation summary ${r.summaryNote}`);
  if (filePath !== undefined) out.push(`Results file: ${filePath}`);
  out.push("");
  out.push(WHAT_THIS_IS_NOT);
  return out.join("\n");
}
