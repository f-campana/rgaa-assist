/**
 * The harness's own search, tested without a browser (so the harness can fail:
 * a search that finds nothing is not evidence of a safe route).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { M101, M102, M103, ROWS } from "./fixtures/rows.ts";
import { describeHit, imagesUnder, pointerAt, searchBuffer } from "./search.ts";

const buf = (s: string): Buffer => Buffer.from(s, "utf8");

describe("privacy harness search", () => {
  it("finds a marker raw, in HTML, percent and JSON forms, and by prefix alone", () => {
    const raw = searchBuffer("f", buf(`xx ${M101} yy`), [M101]);
    expect(raw.map((h) => h.form)).toContain("raw");
    expect(searchBuffer("f", buf("a qx101-a&amp;b&lt;c&gt;&quot;d&#39; z"), [M101]).map((h) => h.form)).toContain("html");
    expect(searchBuffer("f", buf(`?q=${encodeURIComponent(M102)}`), [M102]).map((h) => h.form)).toContain("percent");
    expect(searchBuffer("f", buf(JSON.stringify({ k: M103 })), [M103]).map((h) => h.form)).toContain("json");
    expect(searchBuffer("f", buf('{"k":"qx103-a\\"b\\\\c\\u2028\\t"}'), [M103]).length).toBeGreaterThan(0);
    const cut = searchBuffer("f", buf("a qx001-hid"), ["qx001-hiddentext"]);
    expect(cut.map((h) => h.form)).toEqual(["prefix"]);
    expect(searchBuffer("f", buf("nothing here"), [M101, M102, M103])).toEqual([]);
  });

  it("gives byte offset and JSON pointer, and nothing around the hit", () => {
    const text = JSON.stringify({ a: [{ locator: "pre qx002-secretvalue post" }] });
    const [hit] = searchBuffer("run.json", buf(text), ["qx002-secretvalue"]);
    expect(hit?.offset).toBe(text.indexOf("qx002-"));
    expect(hit?.pointer).toBe("/a/0/locator");
    const line = describeHit(hit!);
    expect(line).toContain("qx002-");
    expect(line).not.toContain("secretvalue");
    expect(line).not.toContain("pre ");
    expect(pointerAt(buf('{"k~/":1}'), 2)).toBe("/k~0~1");
  });

  it("every row's markers follow design 4.2", () => {
    const seen = new Set<string>();
    for (const row of ROWS) {
      for (const m of row.markers) {
        if (/^qx(10[123]|216)-/.test(m)) continue; // the escaping markers hold punctuation by design
        expect(m, row.id).toMatch(/^qx\d{3}-[a-z]+$/);
        expect(m.length, row.id).toBeLessThan(32);
      }
      expect(seen.has(row.id), `duplicate row ${row.id}`).toBe(false);
      seen.add(row.id);
    }
  });

  it("every control states the pieces it expects, per check and piece", () => {
    for (const row of ROWS.filter((r) => r.oracle.saved.kind === "text")) {
      expect((row.oracle.expect ?? []).length, row.id).toBeGreaterThan(0);
      for (const e of row.oracle.expect ?? []) expect(e.contains ?? e.equals, row.id).toBeTruthy();
    }
  });

  it("flags image files by extension and by signature", () => {
    const dir = mkdtempSync(join(tmpdir(), "qxp-selftest-"));
    try {
      writeFileSync(join(dir, "a.png"), "x");
      writeFileSync(join(dir, "b.bin"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]));
      writeFileSync(join(dir, "c.dat"), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
      writeFileSync(join(dir, "d.txt"), "plain");
      const found = imagesUnder("t", dir).map((i) => `${i.file.slice(2)}:${i.reason}`).sort();
      expect(found).toEqual(["a.png:extension", "b.bin:signature", "c.dat:signature"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
