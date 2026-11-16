import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { entry116, entry116Full } from "../../tests/fixtures/schema-fixtures.ts";
import { canonicalHash, canonicalJson, coverageMapHash, entryHash } from "./canonical.ts";
import { CoverageEntrySchema } from "./coverage.ts";

describe("canonicalJson", () => {
  it("sorts keys by code unit, keeps array order, drops undefined, adds no whitespace", () => {
    expect(canonicalJson({ b: 1, a: [3, 1, { d: true, c: null }], Z: "x", u: undefined })).toBe(
      '{"Z":"x","a":[3,1,{"c":null,"d":true}],"b":1}',
    );
  });

  it("keeps strings exactly, without Unicode normalisation", () => {
    const composed = "é";
    const decomposed = "é";
    expect(canonicalJson(composed)).not.toBe(canonicalJson(decomposed));
    expect(canonicalJson("a b")).toBe('"a b"');
  });

  it("refuses values JSON cannot hold", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow();
    expect(() => canonicalJson(new Date())).toThrow();
    expect(() => canonicalJson(() => 1)).toThrow();
  });

  it("hashes the UTF-8 bytes of the canonical form", () => {
    const expected = createHash("sha256").update('{"a":"’"}', "utf8").digest("hex");
    expect(canonicalHash({ a: "’" })).toBe(expected);
  });
});

describe("entryHash", () => {
  const base = CoverageEntrySchema.parse(entry116Full());

  it("is a lowercase hex sha256", () => {
    expect(entryHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not cover enabled", () => {
    expect(entryHash({ ...base, enabled: "full" })).toBe(entryHash({ ...base, enabled: "none" }));
  });

  it("does not depend on key order in the file", () => {
    const reordered = CoverageEntrySchema.parse(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(entry116Full()).reverse()))));
    expect(entryHash(reordered)).toBe(entryHash(base));
  });

  it("changes when needs changes (spec 6.3 example: removing keyboard)", () => {
    const withKeyboard = { ...base, needs: ["keyboard" as const] };
    expect(entryHash(withKeyboard)).not.toBe(entryHash({ ...withKeyboard, needs: [] }));
  });

  it("changes on any other field: test, candidate, applicability, rationale, links, requirements", () => {
    const h = entryHash(base);
    expect(entryHash({ ...base, test: "1.1.7" })).not.toBe(h);
    expect(entryHash({ ...base, candidate: "fail_only" })).not.toBe(h);
    expect(entryHash({ ...base, applicability: "judgment" })).not.toBe(h);
    expect(entryHash({ ...base, rationale: { ...base.rationale, text: base.rationale.text + "." } })).not.toBe(h);
    expect(entryHash({ ...base, links: base.links.map((l, i) => (i === 1 ? { ...l, faultMeans: "evidence_only" as const } : l)) })).not.toBe(h);
    expect(entryHash({ ...base, links: [...base.links].reverse() })).not.toBe(h);
    const reqs = structuredClone(base.requirements);
    reqs[0]!.statement += " ";
    expect(entryHash({ ...base, requirements: reqs })).not.toBe(h);
  });
});

describe("coverageMapHash", () => {
  it("covers enabled and does not depend on the order entries are given in", () => {
    const a = CoverageEntrySchema.parse(entry116());
    const b = CoverageEntrySchema.parse({ ...entry116(), test: "1.1.5" });
    expect(coverageMapHash([a, b])).toBe(coverageMapHash([b, a]));
    const c = CoverageEntrySchema.parse(entry116Full());
    expect(coverageMapHash([c])).not.toBe(coverageMapHash([{ ...c, enabled: "full" }]));
  });
});
