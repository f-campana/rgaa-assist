/**
 * The working set (spec 10.2, 10.4, 10.5): every case under `corpus/working/`
 * is a valid labelled case whose files exist, whose citations are verbatim
 * official text, and whose pages request nothing outside the case folder and
 * the harness's second origin (`__CROSS_ORIGIN__`).
 *
 * This file checks the cases as data. It runs no check and no browser.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CorpusCaseSchema, CoverageEntrySchema, entryFilePath } from "../../src/schema/index.ts";
import type { CoverageEntry, TestCase } from "../../src/schema/index.ts";
import { checkCitation, loadOfficialData } from "../../src/rulesets/rgaa-4.1.2/index.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const WORKING = join(ROOT, "corpus", "working");
const RULESET = join(ROOT, "src", "rulesets", "rgaa-4.1.2");

/** The minimum useful set (Q50). */
const MINIMUM_SET = ["8.5.1", "10.1.1", "10.1.2", "11.8.2", "8.3.1", "8.4.1", "2.1.1", "6.2.1", "11.1.1", "8.2.1"];

/** Files the harness serves as text, in which `__CROSS_ORIGIN__` is replaced. */
const TEXT_EXT = /\.(html|xhtml|js|css|svg|json|txt)$/;

/**
 * Namespace identifiers. They name a vocabulary and are never requested, so
 * they are the only absolute URLs a page may hold.
 */
const NAMESPACES = [
  "http://www.w3.org/1999/xhtml",
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/XML/1998/namespace",
];

interface Loaded {
  dir: string;
  folderTest: string;
  folderId: string;
  raw: unknown;
}

function listCases(): Loaded[] {
  if (!existsSync(WORKING)) return [];
  const out: Loaded[] = [];
  for (const test of readdirSync(WORKING).sort()) {
    const testDir = join(WORKING, test);
    if (!statSync(testDir).isDirectory()) continue;
    for (const id of readdirSync(testDir).sort()) {
      const dir = join(testDir, id);
      if (!statSync(dir).isDirectory()) continue;
      const raw: unknown = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
      out.push({ dir, folderTest: test, folderId: id, raw });
    }
  }
  return out;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    else out.push(relative(dir, p).split("\\").join("/"));
  }
  return out.sort();
}

/** Every reference to a host the case does not own, as a list of problems. */
export function foreignReferences(text: string): string[] {
  let t = text;
  for (const ns of NAMESPACES) t = t.split(ns).join("");
  const problems: string[] = [];
  for (const m of t.matchAll(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)]*/gi)) problems.push(`absolute URL ${m[0]}`);
  for (const m of t.matchAll(/(?:\b(?:src|href|action|data|poster|srcset|formaction|xlink:href)\s*=\s*["']?|url\(\s*["']?|@import\s+["'])\/\/[^\s"'<>)]*/gi)) {
    problems.push(`protocol-relative URL ${m[0]}`);
  }
  for (const m of t.matchAll(/__CROSS_ORIGIN__(.?)/g)) {
    if (m[1] !== "/") problems.push("__CROSS_ORIGIN__ must be followed by a path starting with /");
  }
  return problems;
}

const official = loadOfficialData();
const cases = listCases();
const parsed = new Map<string, TestCase>();
for (const c of cases) {
  const r = CorpusCaseSchema.safeParse(c.raw);
  if (r.success && r.data.kind === "test") parsed.set(c.dir, r.data);
}

const entries = new Map<string, CoverageEntry>();
function entryFor(test: string): CoverageEntry {
  let e = entries.get(test);
  if (e === undefined) {
    e = CoverageEntrySchema.parse(JSON.parse(readFileSync(join(RULESET, entryFilePath(test)), "utf8")));
    entries.set(test, e);
  }
  return e;
}

describe("working set", () => {
  it("has cases", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it("every case.json is a test case valid against the corpus schema", () => {
    const problems: string[] = [];
    for (const c of cases) {
      const r = CorpusCaseSchema.safeParse(c.raw);
      if (!r.success) problems.push(`${c.folderId}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      else if (r.data.kind !== "test") problems.push(`${c.folderId}: kind is ${r.data.kind}, expected test`);
    }
    expect(problems).toEqual([]);
  });

  it("each case sits in corpus/working/<test>/<id>/ and its test is in the minimum useful set", () => {
    for (const c of cases) {
      const tc = parsed.get(c.dir);
      expect(tc, c.folderId).toBeDefined();
      expect(tc?.id).toBe(c.folderId);
      expect(tc?.test).toBe(c.folderTest);
      expect(MINIMUM_SET).toContain(c.folderTest);
    }
  });

  it("ids are unique", () => {
    const ids = [...parsed.values()].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every listed file exists, the first is the page, and no file is unlisted", () => {
    for (const c of cases) {
      const tc = parsed.get(c.dir);
      if (tc === undefined) continue;
      expect(tc.files[0], tc.id).toMatch(/\.(html|xhtml)$/);
      expect(new Set(tc.files).size, tc.id).toBe(tc.files.length);
      for (const f of tc.files) expect(existsSync(join(c.dir, f)), `${tc.id}: ${f}`).toBe(true);
      const onDisk = filesUnder(c.dir).filter((f) => f !== "case.json");
      expect(onDisk, tc.id).toEqual([...tc.files].sort());
    }
  });

  it("every citation is verbatim official text", () => {
    const problems: string[] = [];
    for (const tc of parsed.values()) {
      tc.rationale.citations.forEach((citation, i) => {
        const p = checkCitation(official, citation);
        if (p !== null) problems.push(`${tc.id} rationale.citations.${i}: ${p}`);
      });
    }
    expect(problems).toEqual([]);
  });

  it("routes name routes or exceptions of the test's coverage entry", () => {
    for (const tc of parsed.values()) {
      const e = entryFor(tc.test);
      const ids = new Set(e.requirements.flatMap((r) => [...r.routes, ...r.exceptions].map((a) => a.id)));
      for (const r of tc.routes) expect(ids.has(r), `${tc.id}: ${r}`).toBe(true);
    }
  });

  it("no file references a host other than __CROSS_ORIGIN__", () => {
    const problems: string[] = [];
    for (const c of cases) {
      const tc = parsed.get(c.dir);
      if (tc === undefined) continue;
      for (const f of tc.files) {
        if (!TEXT_EXT.test(f)) continue;
        for (const p of foreignReferences(readFileSync(join(c.dir, f), "utf8"))) problems.push(`${tc.id}/${f}: ${p}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("the host rule catches what it should", () => {
    expect(foreignReferences('<script src="https://cdn.example/x.js"></script>')).toHaveLength(1);
    expect(foreignReferences('<img src="//cdn.example/x.png">')).toHaveLength(1);
    expect(foreignReferences("a{background:url(//cdn.example/x.png)}")).toHaveLength(1);
    expect(foreignReferences('<iframe src="__CROSS_ORIGIN__frame.html"></iframe>')).toHaveLength(1);
    expect(foreignReferences('<iframe src="__CROSS_ORIGIN__/frame.html"></iframe>')).toEqual([]);
    expect(foreignReferences('<html xmlns="http://www.w3.org/1999/xhtml">')).toEqual([]);
  });

  it("no label, rationale or file name speaks of conformance, a rate or a score", () => {
    for (const c of cases) {
      const text = readFileSync(join(c.dir, "case.json"), "utf8");
      expect(text, c.folderId).not.toMatch(/conform|complian|\bscores?\b|\brates?\b|\d\s*%/i);
      for (const f of filesUnder(c.dir)) expect(f, c.folderId).not.toMatch(/conform|complian|\bscores?\b/i);
    }
  });

  it("expected results respect each entry's candidate level and applicability", () => {
    for (const tc of parsed.values()) {
      const e = entryFor(tc.test);
      // fail_only never says passed or not applicable (6.1).
      expect(["passed", "not_applicable"], tc.id).not.toContain(tc.expected.fail_only.status);
      // not applicable only on a structural entry at full (8.3 step 4, Q40).
      if (tc.expected.full.status === "not_applicable") expect(e.applicability, tc.id).toBe("structural");
      // A case that fails at one level fails at both: a violation does not depend on the level above fail_only.
      expect(tc.expected.fail_only.status === "failed", tc.id).toBe(tc.expected.full.status === "failed");
      // Below full, a result that is not failed is needs_review, not_enabled (8.3 step 4.3).
      if (tc.expected.fail_only.status !== "failed") expect(tc.expected.fail_only, tc.id).toEqual({ status: "needs_review", reason: "not_enabled" });
      // The branch agrees with the expected status at the entry's candidate level (10.2).
      const atCandidate = e.candidate === "full" ? tc.expected.full : tc.expected.fail_only;
      if (tc.branch === "invalid_fault_proves_failure") expect(atCandidate.status, tc.id).toBe("failed");
      if (tc.branch === "outside_support") expect(atCandidate.status, tc.id).toBe("needs_review");
      if (tc.branch === "valid" || tc.branch === "invalid_by_route_valid_by_alternative") {
        expect(atCandidate.status, tc.id).toBe(e.candidate === "full" ? "passed" : "needs_review");
      }
      if (tc.branch === "inapplicable") {
        expect(atCandidate.status, tc.id).toBe(e.candidate === "full" && e.applicability === "structural" ? "not_applicable" : "needs_review");
      }
    }
  });

  it("covers the branches 10.4 asks of every test of the minimum useful set", () => {
    for (const test of MINIMUM_SET) {
      const e = entryFor(test);
      const own = [...parsed.values()].filter((c) => c.test === test);
      expect(own.length, test).toBeGreaterThanOrEqual(5);
      expect(own.some((c) => c.expected.fail_only.status === "failed"), `${test}: a failed case`).toBe(true);
      if (e.candidate !== "full") {
        expect(own.some((c) => c.branch === "valid"), `${test}: a valid case`).toBe(true);
        continue;
      }
      const passed = own.filter((c) => c.expected.full.status === "passed");
      expect(passed.some((c) => c.branch === "valid"), `${test}: a valid case`).toBe(true);
      if (e.applicability === "structural") {
        expect(own.some((c) => c.branch === "inapplicable" && c.expected.full.status === "not_applicable"), `${test}: inapplicable`).toBe(true);
      }
      for (const r of e.requirements) {
        for (const a of [...r.routes, ...r.exceptions]) {
          expect(passed.some((c) => c.routes.includes(a.id)), `${test}: a passed case through ${a.id}`).toBe(true);
        }
        if (r.routes.length + r.exceptions.length > 1) {
          expect(own.some((c) => c.branch === "invalid_by_route_valid_by_alternative" && c.expected.full.status === "passed"), `${test}: invalid by one route, valid by another`).toBe(true);
        }
      }
    }
  });
});
