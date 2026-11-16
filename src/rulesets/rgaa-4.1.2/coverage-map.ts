/**
 * Loader for the RGAA 4.1.2 coverage map: the entry files under `coverage/`,
 * the check registry `checks.json` and the approval log `approvals.json`.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  ApprovalLogSchema,
  CheckRegistrySchema,
  compareDottedIds,
  entryFilePath,
  validateEntry,
} from "../../schema/index.ts";
import type { CoverageEntry } from "../../schema/index.ts";
import type { CoverageMap, OfficialData } from "../contract.ts";
import { checkEntryCitations } from "./citations.ts";

/** The ruleset folder: `coverage/`, `checks.json` and `approvals.json` are in it. */
export const RULESET_DIR = import.meta.dirname;

export interface CoverageProblem {
  /** Path of the file, relative to the ruleset folder, with `/` separators. */
  file: string;
  path: (string | number)[];
  message: string;
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) out.push(...listJsonFiles(p));
    else if (d.name.endsWith(".json")) out.push(p);
  }
  return out;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

/**
 * Load and check the coverage map. Problems found, all reported together:
 * - `checks.json` or `approvals.json` fails its schema;
 * - an entry file is not valid JSON or fails `validateEntry`;
 * - an entry file is not at `entryFilePath(entry.test)`;
 * - an entry's test is not in the official data, or two files hold the same test;
 * - a citation is not verbatim (`checkEntryCitations`);
 * - an approval-log event names a test that is not in the official data.
 * A missing `coverage/` folder is an empty map (no entry is written yet).
 */
export function loadCoverageMap(
  official: OfficialData,
  dir: string = RULESET_DIR,
): { ok: true; map: CoverageMap } | { ok: false; problems: CoverageProblem[] } {
  const problems: CoverageProblem[] = [];

  const checksParsed = CheckRegistrySchema.safeParse(readJson(join(dir, "checks.json")));
  if (!checksParsed.success) {
    for (const i of checksParsed.error.issues) problems.push({ file: "checks.json", path: i.path.map(String), message: i.message });
  }
  const approvalsParsed = ApprovalLogSchema.safeParse(readJson(join(dir, "approvals.json")));
  if (!approvalsParsed.success) {
    for (const i of approvalsParsed.error.issues) problems.push({ file: "approvals.json", path: i.path.map(String), message: i.message });
  } else {
    approvalsParsed.data.events.forEach((e, i) => {
      if (!official.tests.has(e.test)) {
        problems.push({ file: "approvals.json", path: ["events", i, "test"], message: `no test ${e.test}` });
      }
    });
  }
  if (!checksParsed.success || !approvalsParsed.success) return { ok: false, problems };

  const loaded: CoverageEntry[] = [];
  for (const abs of listJsonFiles(join(dir, "coverage"))) {
    const file = relative(dir, abs).split(sep).join("/");
    let raw: unknown;
    try {
      raw = readJson(abs);
    } catch (e) {
      problems.push({ file, path: [], message: `not valid JSON: ${(e as Error).message}` });
      continue;
    }
    const v = validateEntry(raw, checksParsed.data);
    if (!v.ok) {
      for (const i of v.issues) problems.push({ file, ...i });
      continue;
    }
    const entry = v.entry;
    if (file !== entryFilePath(entry.test)) {
      problems.push({ file, path: ["test"], message: `entry for ${entry.test} belongs at ${entryFilePath(entry.test)}` });
    }
    if (!official.tests.has(entry.test)) {
      problems.push({ file, path: ["test"], message: `no test ${entry.test} in the official data` });
      continue;
    }
    for (const p of checkEntryCitations(official, entry)) problems.push({ file, ...p });
    loaded.push(entry);
  }

  const entries = new Map<string, CoverageEntry>();
  for (const e of loaded.sort((a, b) => compareDottedIds(a.test, b.test))) {
    if (entries.has(e.test)) {
      problems.push({ file: entryFilePath(e.test), path: ["test"], message: `two entries for test ${e.test}` });
    }
    entries.set(e.test, e);
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, map: { entries, checks: checksParsed.data, approvals: approvalsParsed.data } };
}
