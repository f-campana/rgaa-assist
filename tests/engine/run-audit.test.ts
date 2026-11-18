import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CheckProvider, CheckRunResult } from "../../src/checks/types.ts";
import { runAudit } from "../../src/engine/index.ts";
import { serveFixture } from "../../src/engine/testing/index.ts";
import type { FixtureServer } from "../../src/engine/testing/index.ts";
import { loadRgaa412 } from "../../src/rulesets/rgaa-4.1.2/index.ts";
import { RunFileSchema, SAMPLE_UNVERIFIABLE, WHAT_THIS_IS_NOT, coverageMapHash } from "../../src/schema/index.ts";
import type { CheckId, RunFile } from "../../src/schema/index.ts";

// Planted values that must never reach the run file.
const PLANTED_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwbGFudGVkIn0.c2lnbmF0dXJlLXBsYW50ZWQ";
const PLANTED_QUERY = "jean.dupont-planted";
const PLANTED_VALUE = "valeur-saisie-plantee";

const SITE = {
  "index.html": `<!doctype html><html lang="fr"><title>Accueil</title>
    <form id="formulaire"><label for="q">Recherche</label><input id="q" name="q" value="${PLANTED_VALUE}"></form>
    <div id="formulaire" data-session="${PLANTED_TOKEN}">doublon</div>
    <iframe title="Tiers" src="__CROSS_ORIGIN__/frame.html"></iframe>`,
  "frame.html": `<!doctype html><title>Cadre</title><p>cadre</p>`,
};

/** A stub provider: two real registry ids, one fault, one with no result at all. */
const stub: CheckProvider = {
  name: "custom/stub",
  checks: [
    { id: "custom/8-2-id-duplicate", version: "0.0.1-stub", defaultOptions: { maxLocators: 20 } },
    { id: "custom/8-5-page-title-present", version: "0.0.1-stub", defaultOptions: {} },
  ],
  async run(ctx) {
    const snippets = await ctx.page.locator("[id=formulaire]").evaluateAll((els) => els.map((el) => el.outerHTML));
    return new Map<CheckId, CheckRunResult>([
      [
        "custom/8-2-id-duplicate",
        {
          outcome: "fault",
          evidence: snippets.map((snippet, i) => ({ kind: "dom_node" as const, locator: `#formulaire >> nth=${i}`, snippet, note: `frame ${ctx.page.url()}` })),
          fingerprint: "custom/8-2-id-duplicate:id=formulaire",
        },
      ],
    ]);
  },
};

let server: FixtureServer;
let dir: string;
beforeAll(async () => {
  server = await serveFixture(SITE);
  dir = mkdtempSync(join(tmpdir(), "rgaa-run-"));
});
afterAll(async () => {
  await server.close();
});

function writeSample(name: string, sample: unknown): string {
  const p = join(dir, `${name}.json`);
  writeFileSync(p, JSON.stringify(sample, null, 2));
  return p;
}

describe("runAudit", () => {
  let result: Awaited<ReturnType<typeof runAudit>>;
  let run: RunFile;
  let text: string;
  let samplePath: string;

  beforeAll(async () => {
    samplePath = writeSample("site", {
      project: { name: "Fixture site", ruleset: "rgaa-4.1.2" },
      viewport: { width: 1024, height: 768 },
      pages: [
        { id: "home", url: server.url(`index.html?q=${PLANTED_QUERY}&lang=fr#top`), kinds: ["home"] },
        { id: "gone", url: server.url("gone.html"), kinds: ["contact"] },
      ],
      documents: [{ url: `${server.mainOrigin}/doc.pdf?sig=${PLANTED_QUERY}` }],
      safeQueryParams: ["lang"],
    });
    result = await runAudit({
      samplePath,
      outDir: join(dir, "out"),
      providers: [stub],
      timeouts: { settle: 1_000 },
    });
    text = readFileSync(result.runFilePath ?? "", "utf8");
    run = JSON.parse(text) as RunFile;
  }, 120_000);

  it("exits 3 when a target is not established, and still writes a valid run file", () => {
    expect(result.exitCode).toBe(3);
    expect(result.runFilePath).toBe(join(dir, "out", "run.json"));
    const parsed = RunFileSchema.safeParse(run);
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
    expect(result.messages).toContain("gone/initial: not established: the main response has status 404");
    expect(result.messages.some((m) => m.startsWith("home/initial: established;"))).toBe(true);
  });

  it("records the targets as they happened", () => {
    expect(run.targets.map((t) => [t.targetId, t.established])).toEqual([
      ["gone/initial", false],
      ["home/initial", true],
    ]);
    const home = run.targets[1];
    expect(home?.requestedUrl).toBe(`${server.mainOrigin}/index.html?q=[redacted]&lang=fr#[redacted]`);
    expect(home?.viewport).toEqual({ requested: { width: 1024, height: 768 }, applied: { width: 1024, height: 768 } });
  });

  it("runs checks only on the established target, with every declared check observed", () => {
    expect(run.observations.map((o) => o.id)).toEqual(["home/initial:custom/8-2-id-duplicate", "home/initial:custom/8-5-page-title-present"]);
    expect(run.observations[0]?.outcome).toBe("fault");
    expect(run.observations[0]?.evidence.map((e) => e.id)).toEqual(["e001", "e002"]);
    expect(run.observations[1]?.error).toEqual({ kind: "check_error", message: "no result" });
  });

  it("gives only needs_review or not_tested findings, every entry on every target", () => {
    const plugin = loadRgaa412();
    expect(run.findings).toHaveLength(plugin.coverage.entries.size * 2);
    expect(new Set(run.findings.map((f) => f.status))).toEqual(new Set(["needs_review", "not_tested"]));
    for (const f of run.findings.filter((x) => x.targetId === "gone/initial")) {
      expect(f).toMatchObject({ status: "not_tested", reason: "target_not_established", complete: false });
    }
    expect(run.effectiveLevels[0]?.levels.every((l) => l.effective === "none")).toBe(true);
    expect(run.reduced[0]?.criterionOnSample.length).toBeGreaterThan(0);
    expect(run.statements.covered.testsDecided).toBe(0);
  });

  it("writes the three statements from what happened", () => {
    expect(run.statements.covered.pagesExamined).toEqual(["home"]);
    expect(run.statements.covered.targetsExamined).toEqual(["home/initial"]);
    expect(run.statements.notCovered.targetsNotExamined).toEqual([{ targetId: "gone/initial", reason: "target_not_established" }]);
    const onHome = run.findings.filter((f) => f.targetId === "home/initial");
    expect(run.statements.notCovered.testsForReview.length + run.statements.notCovered.testsNotTested.length).toBe(onHome.length);
    expect(run.statements.notCovered.sampleUnverifiable).toEqual([...SAMPLE_UNVERIFIABLE]);
    expect(run.statements.whatThisIsNot).toBe(WHAT_THIS_IS_NOT);
  });

  it("fills the manifest", () => {
    const m = run.manifest;
    const plugin = loadRgaa412();
    expect(m.toolVersion).toMatch(/^0\.0\.0(\+git\.[0-9a-f]{40}(\.dirty)?)?$/);
    expect(m.rulesets).toEqual([
      expect.objectContaining({
        id: "rgaa-4.1.2",
        version: "4.1.2",
        sourceCommit: "ca4019f95073b6cbd2482a16e9f12b52d8de678d",
        coverageMapHash: coverageMapHash([...plugin.coverage.entries.values()]),
        evaluationSummaryHash: null,
      }),
    ]);
    expect(m.versions.axeCore).toBe("4.14.0");
    expect(m.versions.playwright).toBe("1.64.1");
    expect(m.versions.browser).toMatch(/^chromium \d+\./);
    expect(m.locale).toBe("fr-FR");
    expect(m.timeouts).toEqual({ navigation: 30_000, settle: 1_000, frameProbe: 2_000, provider: 60_000 });
    expect(m.checkOptions).toEqual({ "custom/8-2-id-duplicate": { maxLocators: 20 }, "custom/8-5-page-title-present": {} });
    expect(m.sampleFileHash).toBe(createHash("sha256").update(readFileSync(samplePath)).digest("hex"));
    expect(Date.parse(m.endedAt)).toBeGreaterThanOrEqual(Date.parse(m.startedAt));
    expect(m.model).toBeNull();
  });

  it("copies the sanitised sample and the sample warnings", () => {
    expect(run.sample.pages[0]?.url).toBe(`${server.mainOrigin}/index.html?q=[redacted]&lang=fr#[redacted]`);
    expect(run.sample.documents[0]?.url).toBe(`${server.mainOrigin}/doc.pdf?sig=[redacted]`);
    expect(run.sampleWarnings).toContainEqual({ code: "fixed_kind_missing", kind: "legal_notice" });
    expect(run.sampleWarnings).toContainEqual({ code: "too_few_random_pages", randomPages: 0, otherPages: 2, required: 1 });
  });

  it("writes none of the planted values", () => {
    expect(text).not.toContain(PLANTED_TOKEN);
    expect(text).not.toContain(PLANTED_QUERY);
    expect(text).not.toContain(PLANTED_VALUE);
    const fault = run.observations[0];
    expect(fault?.evidence[0]?.snippet).toContain('value="[redacted]"');
    expect(fault?.evidence[1]?.snippet).toContain('data-session="[redacted]"');
  });

  it("states no rate, score or verdict", () => {
    expect(text).not.toMatch(/"(rate|score|grade|verdict|conform\w*)"\s*:/i);
    expect(text).not.toMatch(/%/);
  });
});

describe("runAudit exit codes", () => {
  it("exits 0 when every target is established", async () => {
    const samplePath = writeSample("ok", {
      project: { name: "OK", ruleset: "rgaa-4.1.2" },
      pages: [{ id: "home", url: server.url("index.html"), kinds: ["home"] }],
    });
    const r = await runAudit({ samplePath, outDir: join(dir, "ok-out"), providers: [], timeouts: { settle: 500 } });
    expect(r.exitCode).toBe(0);
    const run = JSON.parse(readFileSync(r.runFilePath ?? "", "utf8")) as RunFile;
    expect(RunFileSchema.safeParse(run).success).toBe(true);
    expect(run.observations).toEqual([]);
    expect(new Set(run.findings.map((f) => f.status))).toEqual(new Set(["needs_review", "not_tested"]));
  }, 120_000);

  it("exits 2 on invalid input and writes nothing", async () => {
    const samplePath = writeSample("bad", {
      project: { name: "Bad", ruleset: "rgaa-4.1.2" },
      pages: [{ id: "home", url: server.url("index.html"), kinds: ["home"], states: [{ id: "menu", steps: [{ click: "button" }], expect: { visible: "nav" } }] }],
    });
    const out = join(dir, "bad-out");
    const r = await runAudit({ samplePath, outDir: out, providers: [stub] });
    expect(r).toEqual({ exitCode: 2, messages: ["sample: pages.0.states (home): states are supported from M3"] });
    expect(existsSync(out)).toBe(false);

    const empty = writeSample("empty", { project: { name: "E", ruleset: "rgaa-4.1.2" }, pages: [] });
    expect((await runAudit({ samplePath: empty, outDir: out, providers: [] })).exitCode).toBe(2);
    expect((await runAudit({ samplePath: join(dir, "missing.json"), outDir: out, providers: [] })).exitCode).toBe(2);
    const ok = writeSample("ok2", { project: { name: "OK", ruleset: "rgaa-4.1.2" }, pages: [{ id: "h", url: server.url("index.html"), kinds: ["home"] }] });
    expect((await runAudit({ samplePath: ok, outDir: out, providers: [stub], checkOptions: { "custom/unknown": {} } })).exitCode).toBe(2);
    expect((await runAudit({ samplePath: ok, outDir: out, providers: [stub], timeouts: { settle: -1 } })).exitCode).toBe(2);
    expect(existsSync(out)).toBe(false);
  });
});
