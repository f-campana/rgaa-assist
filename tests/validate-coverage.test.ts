import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { formatReport, main, validateCoverage } from "../scripts/validate-coverage.ts";
import { entry116, entry116Full, registry } from "./fixtures/schema-fixtures.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function rulesetDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "rgaa-validate-"));
  dirs.push(dir);
  const all: Record<string, unknown> = {
    "checks.json": registry(),
    "approvals.json": { schemaVersion: 1, events: [] },
    ...files,
  };
  for (const [rel, content] of Object.entries(all)) {
    const p = join(dir, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}

describe("validate-coverage", () => {
  it("accepts a valid entry and counts it by theme and candidate level", () => {
    const r = validateCoverage({ dir: rulesetDir({ "coverage/01/1.1.6.json": entry116() }) });
    expect(r.exitCode).toBe(0);
    expect(r.entryFiles).toBe(1);
    expect(r.validFiles).toBe(1);
    expect(r.byTheme).toEqual({ "01": 1 });
    expect(r.byCandidate).toEqual({ none: 1 });
    const text = formatReport(r);
    expect(text).toContain("Valid entry files: 1");
    expect(text).not.toMatch(/%|percent|conform/i);
  });

  it("treats an empty map as valid", () => {
    const r = validateCoverage({ dir: rulesetDir({}) });
    expect(r.exitCode).toBe(0);
    expect(r.entryFiles).toBe(0);
  });

  it("reports a quote that is not verbatim with its field path", () => {
    const e = entry116();
    e.requirements[0].routes[2].citations[0].quote = "Un mécanisme permet à l'utilisateur";
    const r = validateCoverage({ dir: rulesetDir({ "coverage/01/1.1.6.json": e }) });
    expect(r.exitCode).toBe(1);
    expect(r.validFiles).toBe(0);
    const text = formatReport(r);
    expect(text).toContain("INVALID coverage/01/1.1.6.json");
    expect(text).toContain("  requirements.0.routes.2.citations.0: quote not found verbatim");
  });

  it("reports an entry in the wrong folder", () => {
    const r = validateCoverage({ dir: rulesetDir({ "coverage/02/1.1.6.json": entry116() }) });
    expect(r.exitCode).toBe(1);
    expect(formatReport(r)).toContain("test: entry for 1.1.6 belongs at coverage/01/1.1.6.json");
  });

  it("reports a file whose name does not match its test", () => {
    const r = validateCoverage({ dir: rulesetDir({ "coverage/01/1.1.7.json": entry116() }) });
    expect(r.exitCode).toBe(1);
    expect(formatReport(r)).toMatch(/belongs at coverage\/01\/1\.1\.6\.json/);
  });

  it("reports a test id that does not exist", () => {
    const e = entry116();
    e.test = "1.1.99";
    const r = validateCoverage({ dir: rulesetDir({ "coverage/01/1.1.99.json": e }) });
    expect(r.exitCode).toBe(1);
    expect(formatReport(r)).toContain("no test 1.1.99");
  });

  it("reports a check id that is not in the registry", () => {
    const e = entry116Full();
    e.links[1].check = "custom/not-registered";
    const r = validateCoverage({ dir: rulesetDir({ "coverage/01/1.1.6.json": e }) });
    expect(r.exitCode).toBe(1);
    expect(formatReport(r)).toMatch(/links\.\d+\.check: check custom\/not-registered is not in the check registry/);
  });

  it("reports a file that is not valid JSON", () => {
    const r = validateCoverage({ dir: rulesetDir({ "coverage/01/1.1.6.json": "{ nope" }) });
    expect(r.exitCode).toBe(1);
    expect(formatReport(r)).toContain("(file): not valid JSON");
  });

  it("keeps counting the valid files when another is invalid", () => {
    const r = validateCoverage({
      dir: rulesetDir({ "coverage/01/1.1.6.json": entry116(), "coverage/01/1.1.7.json": "{" }),
    });
    expect(r.exitCode).toBe(1);
    expect(r.entryFiles).toBe(2);
    expect(r.validFiles).toBe(1);
  });

  it("lists the tests with no entry file with --missing, and it is not an error", () => {
    const dir = rulesetDir({ "coverage/01/1.1.6.json": entry116() });
    const r = validateCoverage({ dir, missing: true });
    expect(r.exitCode).toBe(0);
    expect(r.missingTests).toHaveLength(257);
    expect(r.missingTests).toContain("1.1.1");
    expect(r.missingTests).not.toContain("1.1.6");
    expect(formatReport(r)).toContain("Tests with no entry file: 257");
    expect(validateCoverage({ dir }).missingTests).toBeUndefined();
  });

  it("checks only the files or folders given as arguments", () => {
    const dir = rulesetDir({ "coverage/01/1.1.6.json": entry116(), "coverage/01/1.1.7.json": "{" });
    const good = validateCoverage({ dir, paths: [join(dir, "coverage/01/1.1.6.json")] });
    expect(good.exitCode).toBe(0);
    expect(good.entryFiles).toBe(1);
    const folder = validateCoverage({ dir, paths: [join(dir, "coverage/01")] });
    expect(folder.exitCode).toBe(1);
    expect(folder.entryFiles).toBe(2);
    const none = validateCoverage({ dir, paths: [join(dir, "coverage/09")] });
    expect(none.exitCode).toBe(1);
  });

  it("fails on a broken registry", () => {
    const r = validateCoverage({ dir: rulesetDir({ "checks.json": { schemaVersion: 1, checks: [{ id: "nope" }] } }) });
    expect(r.exitCode).toBe(1);
    expect(formatReport(r)).toContain("INVALID checks.json");
  });

  it("main returns the exit code and writes the report", () => {
    let text = "";
    expect(main([], (s) => (text += s))).toBe(0);
    expect(text).toMatch(/Entry files: \d+/);
    expect(main(["--bogus"], () => {})).toBe(2);
  });
});
