import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OFFICIAL_DIR, OFFICIAL_SHA256, OFFICIAL_SOURCE, loadOfficialData } from "./official-data.ts";

const data = loadOfficialData();

describe("official RGAA 4.1.2 data, typed", () => {
  it("has 13 themes, 106 criteria, 258 tests and 119 glossary entries", () => {
    expect(data.themes).toHaveLength(13);
    expect(data.criteria.size).toBe(106);
    expect(data.tests.size).toBe(258);
    expect(data.glossary.size).toBe(119);
    expect(data.wcagVersion).toBe("2.1");
  });

  it("keeps official order and links themes, criteria and tests", () => {
    expect(data.themes[0]!.name).toBe("Images");
    expect([...data.tests.keys()].slice(0, 3)).toEqual(["1.1.1", "1.1.2", "1.1.3"]);
    for (const theme of data.themes) {
      for (const cid of theme.criteria) {
        const c = data.criteria.get(cid)!;
        expect(c.theme).toBe(theme.number);
        for (const tid of c.tests) expect(data.tests.get(tid)!.criterion).toBe(cid);
      }
    }
    const total = data.themes.reduce((n, t) => n + t.criteria.reduce((m, c) => m + data.criteria.get(c)!.tests.length, 0), 0);
    expect(total).toBe(258);
  });

  it("gives test 1.1.6 its question and three conditions, exactly", () => {
    const t = data.tests.get("1.1.6")!;
    expect(t.lines).toHaveLength(4);
    expect(t.lines[3]).toBe("Un mécanisme permet à l’utilisateur de remplacer l’élément `<object>` par un [contenu alternatif](#contenu-alternatif).");
    expect(t.methodology.startsWith("1. Retrouver dans le document les balises ouvrantes `<object>`")).toBe(true);
  });

  it("keeps particular cases, technical notes and references", () => {
    const c13 = data.criteria.get("1.3")!;
    expect(c13.particularCases.length).toBeGreaterThan(0);
    expect(data.criteria.get("1.2")!.technicalNote.length).toBeGreaterThan(0);
    expect(data.criteria.get("1.1")!.references.wcag).toEqual(["1.1.1 Non-text Content (A)"]);
    const withList = [...data.criteria.values()].find((c) => c.particularCases.some((b) => typeof b !== "string"));
    expect(withList).toBeDefined();
  });

  it("records the source commit of SOURCE.md", () => {
    const md = readFileSync(join(OFFICIAL_DIR, "SOURCE.md"), "utf8");
    expect(md).toContain(OFFICIAL_SOURCE.commit);
    for (const sha of Object.values(OFFICIAL_SHA256)) expect(md).toContain(sha);
  });

  it("refuses a file whose content differs from the recorded hash", () => {
    const dir = mkdtempSync(join(tmpdir(), "rgaa-official-"));
    for (const f of Object.keys(OFFICIAL_SHA256)) copyFileSync(join(OFFICIAL_DIR, f), join(dir, f));
    expect(() => loadOfficialData(dir)).not.toThrow();
    const g = join(dir, "glossaire.json");
    writeFileSync(g, readFileSync(g, "utf8").replace("Image objet", "Image object"));
    expect(() => loadOfficialData(dir)).toThrow(/sha256/);
  });
});
