/**
 * Loading a corpus set from disk (spec 10.1, 10.2) and hashing it.
 *
 * Layout: `<setDir>/<test>/<case id>/case.json` and the case's files. Every
 * `case.json` is validated with `CorpusCaseSchema` before anything runs; the
 * harness never edits a case.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { CorpusCaseSchema, canonicalHash, compareDottedIds } from "../schema/index.ts";
import type { CorpusCase } from "../schema/index.ts";

export interface LoadedCase {
  /** The folder of the case. */
  dir: string;
  /** Path of the folder under the set, `/`-separated: `8.5.1/8.5.1-valid-title-in-head`. */
  path: string;
  case: CorpusCase;
}

export interface LoadedCorpus {
  /** `working` or `acceptance`, from the folder name. */
  set: string;
  cases: LoadedCase[];
  /** Canonical hash of every case's folder: file paths and the sha256 of each file's bytes. */
  hash: string;
}

export class CorpusError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`invalid corpus:\n${problems.map((p) => `  ${p}`).join("\n")}`);
    this.name = "CorpusError";
    this.problems = problems;
  }
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/** Load and validate a set. Throws `CorpusError` listing every problem. */
export function loadCorpus(setDir: string, set = "working"): LoadedCorpus {
  if (!existsSync(setDir) || !statSync(setDir).isDirectory()) throw new CorpusError([`${setDir} is not a folder`]);
  const problems: string[] = [];
  const cases: LoadedCase[] = [];
  for (const test of readdirSync(setDir).sort()) {
    const testDir = join(setDir, test);
    if (!statSync(testDir).isDirectory()) continue;
    for (const id of readdirSync(testDir).sort()) {
      const dir = join(testDir, id);
      if (!statSync(dir).isDirectory()) continue;
      const path = `${test}/${id}`;
      const file = join(dir, "case.json");
      if (!existsSync(file)) {
        problems.push(`${path}: no case.json`);
        continue;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
      } catch (e) {
        problems.push(`${path}: case.json is not valid JSON: ${(e as Error).message}`);
        continue;
      }
      const parsed = CorpusCaseSchema.safeParse(raw);
      if (!parsed.success) {
        for (const i of parsed.error.issues) problems.push(`${path}: ${i.path.join(".") || "(root)"}: ${i.message}`);
        continue;
      }
      if (parsed.data.id !== id) problems.push(`${path}: case id ${parsed.data.id} differs from its folder name`);
      for (const f of parsed.data.files) {
        if (!existsSync(join(dir, f))) problems.push(`${path}: listed file ${f} does not exist`);
      }
      cases.push({ dir, path, case: parsed.data });
    }
  }
  if (problems.length > 0) throw new CorpusError(problems);

  cases.sort((a, b) => {
    const ta = a.case.test ?? "";
    const tb = b.case.test ?? "";
    return ta === tb ? (a.case.id < b.case.id ? -1 : a.case.id > b.case.id ? 1 : 0) : compareDottedIds(ta, tb);
  });
  const hash = canonicalHash({
    cases: [...cases]
      .sort((a, b) => (a.path < b.path ? -1 : 1))
      .map((c) => ({
        path: c.path,
        files: filesUnder(c.dir).map((f) => ({ path: f, sha256: createHash("sha256").update(readFileSync(join(c.dir, f))).digest("hex") })),
      })),
  });
  return { set, cases, hash };
}
