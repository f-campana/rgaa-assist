import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { anchorOf, anchorsIn, noteTexts, writePackets } from "../scripts/build-packets.ts";

const official = join(import.meta.dirname, "..", "src", "rulesets", "rgaa-4.1.2", "official");

interface Criterium {
  title: string;
  tests: Record<string, string[]>;
  particularCases?: (string | { ul: string[] })[];
  technicalNote?: (string | { ul: string[] })[];
}
interface Criteres {
  topics: { number: number; criteria: { criterium: Criterium }[] }[];
}
const criteres = JSON.parse(readFileSync(join(official, "criteres.json"), "utf8")) as Criteres;
const glossary = (
  JSON.parse(readFileSync(join(official, "glossaire.json"), "utf8")) as {
    glossary: { title: string; body: string }[];
  }
).glossary;
const known = new Set(glossary.map((g) => anchorOf(g.title)));

const dirs: string[] = [];
function generate(): Map<string, string> {
  const dir = mkdtempSync(join(tmpdir(), "rgaa-packets-"));
  dirs.push(dir);
  writePackets(dir);
  const out = new Map<string, string>();
  for (const name of readdirSync(dir).sort()) out.set(name, readFileSync(join(dir, name), "utf8"));
  return out;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("theme packets", () => {
  const first = generate();

  it("writes theme-01 to theme-13", () => {
    expect([...first.keys()]).toEqual(
      Array.from({ length: 13 }, (_, i) => `theme-${String(i + 1).padStart(2, "0")}.md`),
    );
  });

  it("is identical when generated twice", () => {
    expect(generate()).toEqual(first);
  });

  it("has every test id in exactly one packet", () => {
    for (const topic of criteres.topics) {
      topic.criteria.forEach((c, ci) => {
        for (const n of Object.keys(c.criterium.tests)) {
          const id = `${topic.number}.${ci + 1}.${n}`;
          const heading = `### Test ${id}\n`;
          const holders = [...first.entries()].filter(([, text]) => text.includes(`\n${heading}`));
          expect(holders.map(([name]) => name), id).toEqual([
            `theme-${String(topic.number).padStart(2, "0")}.md`,
          ]);
          const text = holders[0]![1];
          expect(text.split(`\n${heading}`).length - 1, id).toBe(1);
        }
      });
    }
  });

  it("reproduces official wording exactly", () => {
    for (const topic of criteres.topics) {
      const text = first.get(`theme-${String(topic.number).padStart(2, "0")}.md`)!;
      topic.criteria.forEach((c, ci) => {
        for (const [n, lines] of Object.entries(c.criterium.tests)) {
          lines.forEach((line, i) => {
            const label = `(criteres.json ${topic.number}.${ci + 1}.${n} line ${i + 1}):`;
            const at = text.indexOf(label);
            expect(at, label).toBeGreaterThan(-1);
            expect(text.slice(at).includes(`\n${line}\n`), label).toBe(true);
          });
        }
      });
    }
  });

  it("reproduces particular cases and technical notes exactly", () => {
    for (const topic of criteres.topics) {
      const text = first.get(`theme-${String(topic.number).padStart(2, "0")}.md`)!;
      topic.criteria.forEach((c, ci) => {
        for (const [field, items] of [
          ["particularCases", c.criterium.particularCases],
          ["technicalNote", c.criterium.technicalNote],
        ] as const) {
          for (const [path, t] of noteTexts(items)) {
            const label = `(criteres.json ${topic.number}.${ci + 1} ${field} ${path}):`;
            const at = text.indexOf(label);
            expect(at, label).toBeGreaterThan(-1);
            expect(text.slice(at).includes(`\n${t}\n`), label).toBe(true);
          }
        }
      });
    }
  });

  it("resolves or lists every anchor", () => {
    for (const topic of criteres.topics) {
      const text = first.get(`theme-${String(topic.number).padStart(2, "0")}.md`)!;
      const anchors = new Set<string>();
      for (const { criterium: c } of topic.criteria) {
        for (const t of [
          c.title,
          ...noteTexts(c.particularCases).map(([, t]) => t),
          ...noteTexts(c.technicalNote).map(([, t]) => t),
          ...Object.values(c.tests).flat(),
        ]) {
          for (const a of anchorsIn(t)) anchors.add(a);
        }
      }
      for (const a of anchors) {
        if (known.has(a)) {
          const g = glossary.find((e) => anchorOf(e.title) === a)!;
          const label = `glossaire.json "${g.title}" body:`;
          expect(text.split(label).length - 1, `${a} once`).toBe(1);
        } else {
          expect(text.includes(`- \`#${a}\``), `${a} listed as unresolved`).toBe(true);
        }
      }
    }
  });
});
