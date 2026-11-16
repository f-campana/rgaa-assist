import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { entry116, registry } from "../../../tests/fixtures/schema-fixtures.ts";
import { loadCoverageMap } from "./coverage-map.ts";
import { loadRgaa412 } from "./index.ts";
import { loadOfficialData } from "./official-data.ts";

const official = loadOfficialData();

function rulesetDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "rgaa-coverage-"));
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

describe("coverage map loader", () => {
  // M1 gate: the committed map loads without a problem, nothing is enabled and nothing is approved.
  it("loads the committed RGAA 4.1.2 map: valid, nothing enabled, empty approval log", () => {
    const r = loadCoverageMap(official);
    expect(r.ok ? [] : r.problems).toEqual([]);
    if (r.ok) {
      expect([...r.map.entries.values()].filter((e) => e.enabled !== "none").map((e) => e.test)).toEqual([]);
      expect(r.map.approvals.events).toEqual([]);
    }
  });

  it("loads an entry from its theme folder", () => {
    const r = loadCoverageMap(official, rulesetDir({ "coverage/01/1.1.6.json": entry116() }));
    expect(r.ok ? [...r.map.entries.keys()] : r.problems).toEqual(["1.1.6"]);
  });

  it("refuses an entry in the wrong file", () => {
    const r = loadCoverageMap(official, rulesetDir({ "coverage/02/1.1.6.json": entry116() }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0]!.message).toMatch(/belongs at coverage\/01\/1.1.6.json/);
  });

  it("refuses an invalid entry, an unregistered check and a quote that is not verbatim", () => {
    const bad = entry116();
    bad.requirements = [];
    const unregistered = entry116();
    unregistered.test = "1.1.7";
    unregistered.links[0].check = "axe/unknown";
    const paraphrase = entry116();
    paraphrase.test = "1.1.5";
    paraphrase.rationale.citations[0].quote = "the test is validated";
    const r = loadCoverageMap(
      official,
      rulesetDir({
        "coverage/01/1.1.6.json": bad,
        "coverage/01/1.1.7.json": unregistered,
        "coverage/01/1.1.5.json": paraphrase,
        "coverage/01/broken.json": "{",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const text = r.problems.map((p) => `${p.file}: ${p.message}`).join("\n");
      expect(text).toMatch(/1\.1\.6\.json: .*at least one requirement/);
      expect(text).toMatch(/1\.1\.7\.json: check axe\/unknown is not in the check registry/);
      expect(text).toMatch(/1\.1\.5\.json: quote not found verbatim/);
      expect(text).toMatch(/broken\.json: not valid JSON/);
    }
  });

  it("refuses an approval log for a test that does not exist", () => {
    const log = {
      schemaVersion: 1,
      events: [{ seq: 1, kind: "demotion", test: "14.1.1", level: "none", reason: "r", by: "x", at: "2026-12-01T00:00:00Z" }],
    };
    const r = loadCoverageMap(official, rulesetDir({ "approvals.json": log }));
    expect(r.ok).toBe(false);
  });
});

describe("the RGAA 4.1.2 plug-in", () => {
  it("loads with its id, version, official data and coverage map", () => {
    const p = loadRgaa412();
    expect(p.id).toBe("rgaa-4.1.2");
    expect(p.version).toBe("4.1.2");
    expect(p.official.source.commit).toBe("ca4019f95073b6cbd2482a16e9f12b52d8de678d");
    expect(p.coverage.entries.size).toBeLessThanOrEqual(258);
    expect(typeof p.deriveFindings).toBe("function");
    expect(typeof p.reduce).toBe("function");
    expect(typeof p.checkSample).toBe("function");
  });
});
