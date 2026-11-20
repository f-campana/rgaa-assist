/**
 * The harness on a tiny fake corpus built in a temporary folder, with stub
 * providers. No network, no real site.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import type { CheckProvider, CheckRunResult } from "../../src/checks/types.ts";
import { launchBrowser } from "../../src/engine/index.ts";
import { CorpusError, loadCorpus } from "../../src/evaluation/corpus.ts";
import { corpusLabel, countPhrase, evaluate, measures } from "../../src/evaluation/evaluate.ts";
import type { EvaluationReport } from "../../src/evaluation/evaluate.ts";
import { formatReport } from "../../src/evaluation/format.ts";
import { utcStamp } from "../../src/evaluation/main.ts";
import { loadRgaa412 } from "../../src/rulesets/rgaa-4.1.2/index.ts";
import { WHAT_THIS_IS_NOT } from "../../src/schema/index.ts";
import type { CheckId } from "../../src/schema/index.ts";

const RATIONALE = {
  text: "Fake case for the harness tests.",
  citations: [{ source: "test", test: "8.5.1", line: 1, quote: "Chaque page web a-t-elle un titre de page (balise `<title>`) ?" }],
};

interface FakeCase {
  id: string;
  test: string;
  branch: string;
  fail_only: object;
  full: object;
  html: string;
}

function writeCase(root: string, c: FakeCase): void {
  const dir = join(root, c.test, c.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), c.html);
  writeFileSync(
    join(dir, "case.json"),
    JSON.stringify({
      id: c.id,
      kind: "test",
      test: c.test,
      branch: c.branch,
      routes: [],
      expected: { fail_only: c.fail_only, full: c.full },
      source: { kind: "planted", author: "test" },
      licence: "none",
      adaptation: null,
      files: ["index.html"],
      rationale: RATIONALE,
    }),
  );
}

const WITH_TITLE = `<!doctype html><html lang="fr"><title>Accueil</title><p>x</p>`;
const NO_TITLE = `<!doctype html><html lang="fr"><p>x</p>`;
const NO_LANG = `<!doctype html><html><title>t</title><p>x</p>`;

const CASES: FakeCase[] = [
  // Matches: a title, labelled passed at full.
  { id: "fake-match", test: "8.5.1", branch: "valid", fail_only: { status: "needs_review", reason: "not_enabled" }, full: { status: "passed" }, html: WITH_TITLE },
  // Does not match: no title, but wrongly labelled passed.
  { id: "fake-mismatch", test: "8.5.1", branch: "valid", fail_only: { status: "needs_review", reason: "not_enabled" }, full: { status: "passed" }, html: NO_TITLE },
  // Missing observation: 8.3.1 links axe/html-has-lang, which the stub does not declare.
  { id: "fake-missing", test: "8.3.1", branch: "invalid_fault_proves_failure", fail_only: { status: "failed" }, full: { status: "failed" }, html: NO_LANG },
];

const evidence = (kind: "dom_node" | "scope_examined") => [{ kind, ...(kind === "dom_node" ? { locator: "html", snippet: "<html>" } : { note: "one page" }) }];

/** Stub: faults when the page has no title or no lang; declares no axe/html-has-lang. */
const stub: CheckProvider = {
  name: "custom/stub",
  checks: [
    { id: "custom/8-5-page-title-present", version: "stub-1", defaultOptions: {} },
    { id: "axe/document-title", version: "stub-axe-1", defaultOptions: {} },
    { id: "custom/8-3-default-lang-present", version: "stub-1", defaultOptions: {} },
  ],
  async run(ctx) {
    const hasTitle = (await ctx.page.title()).length > 0;
    const hasLang = (await ctx.page.locator("html").getAttribute("lang")) !== null;
    const result = (ok: boolean, id: string): CheckRunResult =>
      ok
        ? { outcome: "no_fault", evidence: evidence("scope_examined") as never, fingerprint: `${id}:no_fault` }
        : { outcome: "fault", evidence: evidence("dom_node") as never, fingerprint: `${id}:fault` };
    return new Map<CheckId, CheckRunResult>([
      ["custom/8-5-page-title-present", result(hasTitle, "custom/8-5-page-title-present")],
      ["axe/document-title", result(hasTitle, "axe/document-title")],
      ["custom/8-3-default-lang-present", result(hasLang, "custom/8-3-default-lang-present")],
    ]);
  },
};

let browser: Browser;
let root: string;
let report: EvaluationReport;
beforeAll(async () => {
  browser = await launchBrowser();
  root = mkdtempSync(join(tmpdir(), "rgaa-eval-"));
  for (const c of CASES) writeCase(root, c);
  report = await evaluate({ corpus: loadCorpus(root), plugin: loadRgaa412(), providers: [stub], browser });
}, 60_000);
afterAll(async () => {
  await browser.close();
});

describe("evaluate on a fake corpus", () => {
  it("measures each case at the entry's candidate level", () => {
    const byId = new Map(report.cases.map((c) => [c.case, c]));
    expect(byId.get("fake-match")?.level).toBe("full");
    expect(byId.get("fake-missing")?.level).toBe("fail_only");
    expect(report.cases.map((c) => c.case)).toEqual(["fake-match", "fake-mismatch", "fake-missing"]);
  });

  it("a matching case matches, with its linked outcomes", () => {
    const c = report.cases.find((x) => x.case === "fake-match");
    expect(c?.actual).toMatchObject({ kind: "finding", status: "passed", complete: true });
    expect(c?.matched).toBe(true);
    expect(c?.outcomes).toEqual({ "axe/document-title": "no_fault", "custom/8-5-page-title-present": "no_fault" });
    expect(c?.missingObservations).toEqual([]);
  });

  it("a case that does not match is reported as a mismatch with what happened", () => {
    const c = report.cases.find((x) => x.case === "fake-mismatch");
    expect(c?.actual).toMatchObject({ kind: "finding", status: "failed" });
    expect(c?.expected).toEqual({ status: "passed" });
    expect(c?.matched).toBe(false);
  });

  it("a case with a missing observation says so and is not hidden", () => {
    const c = report.cases.find((x) => x.case === "fake-missing");
    expect(c?.missingObservations).toEqual(["axe/html-has-lang"]);
    expect(c?.outcomes["axe/html-has-lang"]).toBe("missing");
    expect(c?.outcomes["custom/8-3-default-lang-present"]).toBe("fault");
    // The failure fault from the whole link still decides: the case matches, the gap stays visible.
    expect(c?.matched).toBe(true);
  });

  it("tables and the four counts carry their population", () => {
    expect(report.overall.table.cases).toBe(3);
    expect(report.overall.table.missingObservations).toBe(1);
    expect(report.overall.table.expected.passed.passed).toBe(1);
    expect(report.overall.table.expected.passed.failed).toBe(1);
    expect(report.overall.table.expected.failed.failed).toBe(1);
    expect(report.overall.matched).toEqual({ x: 2, n: 3 });
    expect(report.overall.measures).toEqual({
      falseAssurance: { x: 0, n: 3 }, // over all cases: none returned a passed or not_applicable it did not expect
      missedFault: { x: 0, n: 1 },
      falseAlarm: { x: 1, n: 2 }, // the mislabelled case got failed where passed was expected
      unexpectedError: { x: 1, n: 3 }, // the missing observation
    });
    const test851 = report.tests.find((t) => t.test === "8.5.1");
    expect(test851?.matched).toEqual({ x: 1, n: 2 });
  });

  it("reports no per-link tables or measures: per-test numbers and per-check outcome counts only", () => {
    expect("links" in report).toBe(false);
    expect(JSON.stringify(report)).not.toContain('"links"');
    expect(report.tests.map((t) => t.test)).toEqual(["8.3.1", "8.5.1"]);
  });

  it("per check: outcomes over the cases that link it", () => {
    const title = report.checks.find((c) => c.check === "custom/8-5-page-title-present");
    expect(title).toMatchObject({ cases: 2, outcomes: { no_fault: 1, fault: 1, missing: 0 } });
    const axeLang = report.checks.find((c) => c.check === "axe/html-has-lang");
    expect(axeLang).toMatchObject({ cases: 1, outcomes: { missing: 1 } });
  });

  it("records check versions and a corpus hash, and writes no summary: per-link measurement is M5 work (Q56)", () => {
    expect(report.checkVersions["custom/8-5-page-title-present"]).toBe("stub-1");
    expect(report.corpus.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(report.summary).toBeNull();
    expect(report.summaryNote).toContain("Per-link measurement is M5 work");
    expect(report.summaryNote).toContain("M5");
    expect(report.summaryNote).toContain("Q56");
  });

  it("the printed report states counts as 'x of n cases on corpus working@<hash>' and never a rate", () => {
    const text = formatReport(report, "/tmp/results.json");
    expect(text).toContain(`Matched: 2 of 3 cases on corpus ${corpusLabel("working", report.corpus.hash)}`);
    expect(text).toMatch(/False alarm \(a failed, over the cases not expecting failed\): 1 of 2 cases on corpus working@[0-9a-f]{12}/);
    expect(text).toMatch(/False assurance \(an unexpected passed or not_applicable, over all cases\): 0 of 3 cases on corpus working@[0-9a-f]{12}/);
    expect(text).not.toContain("Per link");
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/\b(rate|percent|percentage|score|verdict)\b/i);
    expect(text.trimEnd().endsWith(WHAT_THIS_IS_NOT)).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/%|percent|"rate"|"score"|verdict/i);
  });
});

describe("corpus loading", () => {
  it("refuses an invalid case, listing the problem", () => {
    const bad = mkdtempSync(join(tmpdir(), "rgaa-eval-bad-"));
    mkdirSync(join(bad, "8.5.1", "broken"), { recursive: true });
    writeFileSync(join(bad, "8.5.1", "broken", "case.json"), JSON.stringify({ id: "broken", kind: "test" }));
    expect(() => loadCorpus(bad)).toThrow(CorpusError);
  });

  it("the hash follows the content of the cases and their files", () => {
    const a = mkdtempSync(join(tmpdir(), "rgaa-eval-h-"));
    writeCase(a, CASES[0] as FakeCase);
    const h1 = loadCorpus(a).hash;
    expect(loadCorpus(a).hash).toBe(h1);
    writeFileSync(join(a, "8.5.1", "fake-match", "index.html"), `${WITH_TITLE}<!-- changed -->`);
    expect(loadCorpus(a).hash).not.toBe(h1);
  });
});

describe("measures and phrasing", () => {
  it("counts a crash as an unexpected error and a missed fault", () => {
    const m = measures([{ expected: { status: "failed" }, actual: { kind: "crash", message: "x" }, missingObservations: [] }]);
    expect(m.missedFault).toEqual({ x: 1, n: 1 });
    expect(m.unexpectedError).toEqual({ x: 1, n: 1 });
  });
  const finding = (status: "passed" | "not_applicable" | "failed" | "needs_review") =>
    ({ kind: "finding", status, complete: true }) as const;
  it("false assurance counts a swap: expected passed, got not_applicable", () => {
    const m = measures([{ expected: { status: "passed" }, actual: finding("not_applicable"), missingObservations: [] }]);
    expect(m.falseAssurance).toEqual({ x: 1, n: 1 });
  });
  it("false assurance counts the reverse swap: expected not_applicable, got passed", () => {
    const m = measures([{ expected: { status: "not_applicable" }, actual: finding("passed"), missingObservations: [] }]);
    expect(m.falseAssurance).toEqual({ x: 1, n: 1 });
  });
  it("false assurance counts a passed where failed or needs_review was expected, and not a matching passed", () => {
    const m = measures([
      { expected: { status: "failed" }, actual: finding("passed"), missingObservations: [] },
      { expected: { status: "needs_review" }, actual: finding("not_applicable"), missingObservations: [] },
      { expected: { status: "passed" }, actual: finding("passed"), missingObservations: [] },
      { expected: { status: "not_applicable" }, actual: finding("not_applicable"), missingObservations: [] },
      { expected: { status: "passed" }, actual: finding("failed"), missingObservations: [] },
    ]);
    expect(m.falseAssurance).toEqual({ x: 2, n: 5 });
  });
  it("an expected not_tested is not an unexpected error", () => {
    const m = measures([
      { expected: { status: "not_tested" }, actual: { kind: "finding", status: "not_tested", complete: false }, missingObservations: ["axe/x"] },
    ]);
    expect(m.unexpectedError).toEqual({ x: 0, n: 1 });
  });
  it("phrases a count with its population and corpus", () => {
    expect(countPhrase({ x: 0, n: 12 }, "working@abc")).toBe("0 of 12 cases on corpus working@abc");
    expect(utcStamp(new Date("2026-11-18T10:15:30.123Z"))).toBe("20261118T101530Z");
  });
});
