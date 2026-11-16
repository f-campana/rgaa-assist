import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAxeTable,
  readCommittedAxeTable,
  serializeAxeTable,
  type AxeTable,
} from "../scripts/build-axe-table.ts";

const official = join(import.meta.dirname, "..", "src", "rulesets", "rgaa-4.1.2", "official");

interface Criteres {
  topics: { criteria: { criterium: { tests: Record<string, unknown> } }[] }[];
}
const criteres = JSON.parse(readFileSync(join(official, "criteres.json"), "utf8")) as Criteres;
const officialIds = new Set<string>();
criteres.topics.forEach((topic, ti) =>
  topic.criteria.forEach((c, ci) => {
    for (const n of Object.keys(c.criterium.tests)) officialIds.add(`${ti + 1}.${ci + 1}.${n}`);
  }),
);

describe("axe table", () => {
  it("equals what the script generates now", () => {
    expect(readCommittedAxeTable()).toBe(serializeAxeTable(buildAxeTable()));
  });

  it("only names RGAA tests that exist in criteres.json", () => {
    const table = JSON.parse(readCommittedAxeTable()) as AxeTable;
    for (const rule of table.rules) {
      for (const id of rule.rgaaTests) expect(officialIds.has(id), `${rule.id} -> ${id}`).toBe(true);
    }
    for (const id of Object.keys(table.testIndex)) expect(officialIds.has(id), id).toBe(true);
  });

  it("has 67 rules covering 40 distinct tests (figures from the spec)", () => {
    const table = JSON.parse(readCommittedAxeTable()) as AxeTable;
    const tests = new Set(table.rules.flatMap((r) => r.rgaaTests));
    expect(table.rules.length).toBe(67);
    expect(tests.size).toBe(40);
  });
});
