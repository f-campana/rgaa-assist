import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allProviders } from "../../src/checks/index.ts";
import { runCli } from "../../src/cli/commands.ts";
import { serveFixture } from "../../src/engine/testing/index.ts";
import type { FixtureServer } from "../../src/engine/testing/index.ts";
import { WHAT_THIS_IS_NOT } from "../../src/schema/index.ts";

async function cli(...argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(argv, { out: (t) => out.push(t), err: (t) => err.push(t) });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

/** No rate, percentage, score or verdict in any output. */
function expectNoRate(text: string): void {
  expect(text).not.toMatch(/%/);
  expect(text).not.toMatch(/\b(rate|percent|percentage|score|verdict)\b/i);
  expect(text).not.toMatch(/\b\d+ of 106\b/);
}

let dir: string;
let server: FixtureServer;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "rgaa-cli-"));
  server = await serveFixture({
    "index.html": `<!doctype html><html lang="fr"><title>Accueil</title><h1>Accueil</h1><p>Texte.</p>`,
  });
});
afterAll(async () => {
  await server.close();
});

function sampleFile(name: string, pages: { id: string; url: string; kinds: string[] }[], extra: object = {}): string {
  const p = join(dir, `${name}.json`);
  writeFileSync(p, JSON.stringify({ project: { name: "Fixture", ruleset: "rgaa-4.1.2" }, pages, ...extra }));
  return p;
}

describe("providers", () => {
  it("lists the axe provider last", () => {
    const providers = allProviders();
    expect(providers.at(-1)?.name).toMatch(/axe/);
    expect(providers.slice(0, -1).every((p) => !/axe/.test(p.name))).toBe(true);
  });
});

describe("coverage", () => {
  it("prints counts of entries and checks, then the claim sentence", async () => {
    const r = await cli("coverage");
    expect(r.code).toBe(0);
    expect(r.out).toContain("Entries by candidate level:");
    expect(r.out).toContain("Entries by enabled level:");
    expect(r.out).toMatch(/theme 08:/);
    expect(r.out).toMatch(/axe: \d+ built, \d+ not built/);
    expect(r.out).toMatch(/custom: \d+ built, \d+ not built/);
    expect(r.out.trimEnd().endsWith(WHAT_THIS_IS_NOT)).toBe(true);
    expectNoRate(r.out);
  });

  it("refuses an unknown ruleset and stray arguments", async () => {
    expect((await cli("coverage", "--ruleset", "rgaa-5")).code).toBe(2);
    expect((await cli("coverage", "extra")).code).toBe(2);
    expect((await cli("coverage", "--nope")).code).toBe(2);
  });
});

describe("check-sample", () => {
  it("prints warnings of a valid sample and exits 0", async () => {
    const path = sampleFile("warn", [{ id: "home", url: server.url("index.html"), kinds: ["home"] }]);
    const r = await cli("check-sample", path);
    expect(r.code).toBe(0);
    expect(r.out).toContain("is valid");
    expect(r.out).toMatch(/fixed_kind_missing/);
    expect(r.out.trimEnd().endsWith(WHAT_THIS_IS_NOT)).toBe(true);
    expectNoRate(r.out);
  });

  it("exits 2 on an empty sample, bad JSON, a missing file and a missing argument", async () => {
    const empty = sampleFile("empty", []);
    expect((await cli("check-sample", empty)).code).toBe(2);
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{ not json");
    const r = await cli("check-sample", bad);
    expect(r.code).toBe(2);
    expect(r.err).toContain("not valid JSON");
    expect((await cli("check-sample", join(dir, "absent.json"))).code).toBe(2);
    expect((await cli("check-sample")).code).toBe(2);
  });
});

describe("report and unknown commands", () => {
  it("report says it arrives in M4 and exits 2", async () => {
    const r = await cli("report", "run.json");
    expect(r.code).toBe(2);
    expect(r.err).toContain("M4");
  });
  it("an unknown command and no command exit 2", async () => {
    expect((await cli("frobnicate")).code).toBe(2);
    expect((await cli()).code).toBe(2);
  });
});

describe("audit", () => {
  it("refuses a missing --out, a bad --fail-on and unsupported sample features, writing nothing", async () => {
    const path = sampleFile("a", [{ id: "home", url: server.url("index.html"), kinds: ["home"] }]);
    expect((await cli("audit", path)).code).toBe(2);
    const bad = await cli("audit", path, "--out", join(dir, "o0"), "--fail-on", "passed");
    expect(bad.code).toBe(2);
    expect(existsSync(join(dir, "o0"))).toBe(false);
    const withSession = sampleFile("sess", [{ id: "home", url: server.url("index.html"), kinds: ["home"] }], {
      session: { storageState: "state.json" },
    });
    const r = await cli("audit", withSession, "--out", join(dir, "o1"));
    expect(r.code).toBe(2);
    expect(r.err).toContain("session");
    expect((await cli("audit", join(dir, "absent.json"), "--out", join(dir, "o2"))).code).toBe(2);
  });

  it("audits a local fixture site: exit 0, a run file, counts by status, no rate", async () => {
    const path = sampleFile("ok", [{ id: "home", url: server.url("index.html"), kinds: ["home"] }]);
    const out = join(dir, "run-ok");
    const r = await cli("audit", path, "--out", out);
    expect(r.code).toBe(0);
    expect(existsSync(join(out, "run.json"))).toBe(true);
    expect(r.out).toContain(`Run file: ${join(out, "run.json")}`);
    expect(r.out).toMatch(/Test findings by status \(all targets\): passed 0, failed 0, not_applicable 0, needs_review \d+, not_tested \d+/);
    expect(r.out.trimEnd().endsWith(WHAT_THIS_IS_NOT)).toBe(true);
    expectNoRate(r.out);
    // Nothing is enabled, so no criterion is failed and --fail-on failed does not trip.
    const again = await cli("audit", path, "--out", join(dir, "run-ok2"), "--fail-on", "failed");
    expect(again.code).toBe(0);
    expect(JSON.parse(readFileSync(join(out, "run.json"), "utf8")).targets[0].established).toBe(true);
  }, 60_000);

  it("exits 3 when a target is not established, and still writes the run file", async () => {
    const path = sampleFile("gone", [
      { id: "home", url: server.url("index.html"), kinds: ["home"] },
      { id: "gone", url: server.url("gone.html"), kinds: ["contact"] },
    ]);
    const out = join(dir, "run-gone");
    const r = await cli("audit", path, "--out", out);
    expect(r.code).toBe(3);
    expect(existsSync(join(out, "run.json"))).toBe(true);
    expect(r.out).toContain("1 not established");
    expectNoRate(r.out);
  }, 60_000);
});
