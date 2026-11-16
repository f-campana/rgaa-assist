// pnpm validate-coverage [--missing] [path ...]
//
// Checks the coverage entry files of the RGAA 4.1.2 ruleset with the loader in
// src/rulesets/rgaa-4.1.2/coverage-map.ts (shape, structural rules, check
// registry, file location, verbatim citations). It writes no second validator.
// The summary is counts of entry files and entries. It says nothing about any
// website. Missing entries are listed on request and are not an error.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { CoverageEntrySchema, entryFilePath } from "../src/schema/index.ts";
import type { OfficialData } from "../src/rulesets/contract.ts";
import { RULESET_DIR, loadCoverageMap } from "../src/rulesets/rgaa-4.1.2/coverage-map.ts";
import { loadOfficialData } from "../src/rulesets/rgaa-4.1.2/official-data.ts";

export interface ValidateOptions {
  /** The ruleset folder. Defaults to the RGAA 4.1.2 folder. */
  dir?: string;
  official?: OfficialData;
  /** Only these files or folders. Relative paths resolve against the working directory. */
  paths?: string[];
  /** Also list the test ids that have no entry file. */
  missing?: boolean;
}

export interface FileReport {
  /** Relative to the ruleset folder, with `/` separators. */
  file: string;
  issues: { path: string; message: string }[];
}

export interface ValidationReport {
  /** Problems in `checks.json` or `approvals.json`, or in a path argument. They make validation fail. */
  general: FileReport[];
  /** Every entry file in scope, valid or not. */
  files: FileReport[];
  entryFiles: number;
  validFiles: number;
  /** Valid entries per theme (two digits) and per candidate level. */
  byTheme: Record<string, number>;
  byCandidate: Record<string, number>;
  /** Present only with `missing`. */
  missingTests?: string[];
  /** 1 when any file or general problem is invalid. */
  exitCode: 0 | 1;
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) out.push(...listJsonFiles(p));
    else if (d.name.endsWith(".json")) out.push(p);
  }
  return out.sort();
}

const posix = (p: string): string => p.split(sep).join("/");
const fieldPath = (p: (string | number)[]): string => (p.length === 0 ? "(file)" : p.join("."));

export function validateCoverage(options: ValidateOptions = {}): ValidationReport {
  const dir = options.dir ?? RULESET_DIR;
  const official = options.official ?? loadOfficialData();
  const coverageDir = join(dir, "coverage");

  const general: FileReport[] = [];
  let scope = listJsonFiles(coverageDir);
  if (options.paths !== undefined && options.paths.length > 0) {
    const wanted = options.paths.map((p) => resolve(p));
    for (const [i, w] of wanted.entries()) {
      const hit = scope.some((f) => f === w || f.startsWith(w + sep));
      if (!hit) {
        general.push({
          file: options.paths[i]!,
          issues: [{ path: "(path)", message: existsSync(w) && statSync(w).isFile() ? "not an entry file under coverage/" : "no entry file found at this path" }],
        });
      }
    }
    scope = scope.filter((f) => wanted.some((w) => f === w || f.startsWith(w + sep)));
  }

  const loaded = loadCoverageMap(official, dir);
  const byFile = new Map<string, FileReport>();
  if (!loaded.ok) {
    for (const p of loaded.problems) {
      const issue = { path: fieldPath(p.path), message: p.message };
      if (p.file === "checks.json" || p.file === "approvals.json") {
        let g = general.find((r) => r.file === p.file);
        if (g === undefined) general.push((g = { file: p.file, issues: [] }));
        g.issues.push(issue);
      } else {
        let r = byFile.get(p.file);
        if (r === undefined) byFile.set(p.file, (r = { file: p.file, issues: [] }));
        r.issues.push(issue);
      }
    }
  }

  const files: FileReport[] = [];
  const byTheme: Record<string, number> = {};
  const byCandidate: Record<string, number> = {};
  let validFiles = 0;
  for (const abs of scope) {
    const file = posix(relative(dir, abs));
    const bad = byFile.get(file);
    if (bad !== undefined) {
      files.push(bad);
      continue;
    }
    files.push({ file, issues: [] });
    // Only count a file when the whole map loaded: with a broken registry the
    // entries were never checked against it.
    if (!loaded.ok && general.some((g) => g.file === "checks.json" || g.file === "approvals.json")) continue;
    const entry = CoverageEntrySchema.parse(JSON.parse(readFileSync(abs, "utf8")));
    validFiles++;
    const theme = entry.test.split(".")[0]!.padStart(2, "0");
    byTheme[theme] = (byTheme[theme] ?? 0) + 1;
    byCandidate[entry.candidate] = (byCandidate[entry.candidate] ?? 0) + 1;
  }

  const report: ValidationReport = {
    general,
    files,
    entryFiles: scope.length,
    validFiles,
    byTheme,
    byCandidate,
    exitCode: general.length > 0 || files.some((f) => f.issues.length > 0) ? 1 : 0,
  };
  if (options.missing === true) {
    report.missingTests = [...official.tests.keys()].filter((t) => !existsSync(join(dir, entryFilePath(t))));
  }
  return report;
}

export function formatReport(r: ValidationReport): string {
  const out: string[] = [];
  for (const f of [...r.general, ...r.files.filter((f) => f.issues.length > 0)]) {
    out.push(`INVALID ${f.file}`);
    for (const i of f.issues) out.push(`  ${i.path}: ${i.message}`);
  }
  if (out.length > 0) out.push("");
  out.push(`Entry files: ${r.entryFiles}`);
  out.push(`Valid entry files: ${r.validFiles}`);
  out.push("Valid entries per theme:");
  const themes = Object.keys(r.byTheme).sort();
  if (themes.length === 0) out.push("  none");
  for (const t of themes) out.push(`  theme ${t}: ${r.byTheme[t]}`);
  out.push("Valid entries per candidate level:");
  for (const l of ["none", "fail_only", "full"]) out.push(`  ${l}: ${r.byCandidate[l] ?? 0}`);
  if (r.missingTests !== undefined) {
    out.push(`Tests with no entry file: ${r.missingTests.length}`);
    if (r.missingTests.length > 0) out.push(r.missingTests.join(" "));
  }
  return `${out.join("\n")}\n`;
}

/** Runs the command on `argv` (without node and script), returns the exit code. */
export function main(argv: string[], write: (s: string) => void = (s) => process.stdout.write(s)): number {
  const missing = argv.includes("--missing");
  const paths = argv.filter((a) => !a.startsWith("--"));
  const unknown = argv.filter((a) => a.startsWith("--") && a !== "--missing");
  if (unknown.length > 0) {
    write(`Unknown option: ${unknown.join(" ")}\nUsage: pnpm validate-coverage [--missing] [path ...]\n`);
    return 2;
  }
  const report = validateCoverage({ paths, missing });
  write(formatReport(report));
  return report.exitCode;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
