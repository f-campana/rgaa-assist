import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(import.meta.dirname, "..", "src", "rulesets", "rgaa-4.1.2", "official");

const HASHES = {
  "criteres.json": "25f71c18150d15514253badd883d0c62e329bc3928814779dc4b41497002a13a",
  "glossaire.json": "6855035e03fd9c47aee743976897f9958539e5b2be88996a41a1b273e29e01a4",
  "methodologies.json": "199dcd99b3c9783465c74936e721f2d905bfbd286ff6a3197358912e2ba1b84d",
} as const;

interface Criteres {
  topics: {
    topic: string;
    criteria: { criterium: { tests: Record<string, unknown> } }[];
  }[];
}

const criteres = JSON.parse(readFileSync(join(dir, "criteres.json"), "utf8")) as Criteres;
const methodologies = JSON.parse(readFileSync(join(dir, "methodologies.json"), "utf8")) as Record<
  string,
  unknown
>;

function testIds(): string[] {
  const ids: string[] = [];
  criteres.topics.forEach((topic, ti) => {
    topic.criteria.forEach((c, ci) => {
      for (const n of Object.keys(c.criterium.tests)) {
        ids.push(`${ti + 1}.${ci + 1}.${n}`);
      }
    });
  });
  return ids;
}

describe("official RGAA 4.1.2 data", () => {
  it("has 13 themes, 106 criteria and 258 tests", () => {
    expect(criteres.topics).toHaveLength(13);
    expect(criteres.topics.reduce((n, t) => n + t.criteria.length, 0)).toBe(106);
    expect(testIds()).toHaveLength(258);
  });

  it("has methodologies keyed exactly by the 258 test ids", () => {
    expect(new Set(Object.keys(methodologies))).toEqual(new Set(testIds()));
    expect(Object.keys(methodologies)).toHaveLength(258);
  });

  for (const [file, expected] of Object.entries(HASHES)) {
    it(`${file} matches the sha256 in SOURCE.md`, () => {
      const actual = createHash("sha256").update(readFileSync(join(dir, file))).digest("hex");
      expect(actual).toBe(expected);
    });
  }
});
