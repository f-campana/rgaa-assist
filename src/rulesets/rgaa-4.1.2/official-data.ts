/**
 * Typed loader for the vendored RGAA 4.1.2 data in `./official/`. It reads,
 * checks and types the three files. It never rewrites their text.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type {
  GlossaryEntry,
  OfficialCriterion,
  OfficialData,
  OfficialSource,
  OfficialTest,
  OfficialTheme,
} from "../contract.ts";

/** The folder holding the vendored files. */
export const OFFICIAL_DIR = join(import.meta.dirname, "official");

export const OFFICIAL_SOURCE: OfficialSource = {
  repository: "DISIC/accessibilite.numerique.gouv.fr",
  path: "RGAA/",
  commit: "ca4019f95073b6cbd2482a16e9f12b52d8de678d",
  fetched: "2026-11-16",
  licence: "Licence Ouverte 2.0 (Etalab)",
  attribution: "RGAA 4.1.2, DINUM",
};

/** sha256 of each vendored file, as recorded in `official/SOURCE.md`. */
export const OFFICIAL_SHA256 = {
  "criteres.json": "25f71c18150d15514253badd883d0c62e329bc3928814779dc4b41497002a13a",
  "glossaire.json": "6855035e03fd9c47aee743976897f9958539e5b2be88996a41a1b273e29e01a4",
  "methodologies.json": "199dcd99b3c9783465c74936e721f2d905bfbd286ff6a3197358912e2ba1b84d",
} as const;

// Shapes of the raw files. Strict: an unknown key means the source differs
// from what this loader was written for, which is a hard stop (spec 14.4).
const BlockSchema = z.union([z.string(), z.strictObject({ ul: z.array(z.string()) })]);
const RawCriteresSchema = z.strictObject({
  wcag: z.strictObject({ version: z.number() }),
  topics: z.array(
    z.strictObject({
      number: z.int().positive(),
      topic: z.string(),
      criteria: z.array(
        z.strictObject({
          criterium: z.strictObject({
            number: z.int().positive(),
            title: z.string(),
            tests: z.record(z.string().regex(/^[1-9]\d?$/), z.array(z.string()).min(1)),
            references: z.array(
              z.strictObject({ wcag: z.array(z.string()).optional(), techniques: z.array(z.string()).optional() }),
            ),
            particularCases: z.array(BlockSchema).optional(),
            technicalNote: z.array(BlockSchema).optional(),
          }),
        }),
      ),
    }),
  ),
});
const RawGlossarySchema = z.strictObject({
  glossary: z.array(z.strictObject({ title: z.string().min(1), body: z.string() })),
});
const RawMethodologiesSchema = z.record(z.string(), z.string());

function readChecked(dir: string, file: keyof typeof OFFICIAL_SHA256): unknown {
  const bytes = readFileSync(join(dir, file));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== OFFICIAL_SHA256[file]) {
    throw new Error(`${file}: sha256 ${actual} differs from the recorded ${OFFICIAL_SHA256[file]}`);
  }
  return JSON.parse(bytes.toString("utf8")) as unknown;
}

/**
 * Load the official RGAA 4.1.2 data. Throws when a file's sha256 differs
 * from the recorded one, when a file's shape is not the expected one, when
 * numbering is not consecutive, or when the methodologies do not match the
 * tests one to one.
 */
export function loadOfficialData(dir: string = OFFICIAL_DIR): OfficialData {
  const criteres = RawCriteresSchema.parse(readChecked(dir, "criteres.json"));
  const glossaryRaw = RawGlossarySchema.parse(readChecked(dir, "glossaire.json"));
  const methodologies = RawMethodologiesSchema.parse(readChecked(dir, "methodologies.json"));

  const themes: OfficialTheme[] = [];
  const criteria = new Map<string, OfficialCriterion>();
  const tests = new Map<string, OfficialTest>();

  criteres.topics.forEach((topic, ti) => {
    if (topic.number !== ti + 1) throw new Error(`theme at position ${ti + 1} is numbered ${topic.number}`);
    const theme: OfficialTheme = { number: topic.number, name: topic.topic, criteria: [] };
    topic.criteria.forEach(({ criterium: c }, ci) => {
      if (c.number !== ci + 1) throw new Error(`criterion ${topic.number}.${ci + 1} is numbered ${c.number}`);
      const id = `${topic.number}.${c.number}`;
      const testIds: string[] = [];
      Object.entries(c.tests).forEach(([n, lines], i) => {
        if (Number(n) !== i + 1) throw new Error(`test ${id}.${i + 1} is numbered ${n}`);
        const testId = `${id}.${n}`;
        const methodology = methodologies[testId];
        if (methodology === undefined) throw new Error(`no methodology for test ${testId}`);
        tests.set(testId, { id: testId, criterion: id, number: Number(n), lines: [...lines], methodology });
        testIds.push(testId);
      });
      criteria.set(id, {
        id,
        theme: topic.number,
        number: c.number,
        title: c.title,
        tests: testIds,
        particularCases: c.particularCases ?? [],
        technicalNote: c.technicalNote ?? [],
        references: {
          wcag: c.references.flatMap((r) => r.wcag ?? []),
          techniques: c.references.flatMap((r) => r.techniques ?? []),
        },
      });
      theme.criteria.push(id);
    });
    themes.push(theme);
  });

  const extra = Object.keys(methodologies).filter((k) => !tests.has(k));
  if (extra.length > 0) throw new Error(`methodologies for unknown tests: ${extra.join(", ")}`);

  const glossary = new Map<string, GlossaryEntry>();
  for (const e of glossaryRaw.glossary) {
    if (glossary.has(e.title)) throw new Error(`duplicate glossary title: ${e.title}`);
    glossary.set(e.title, { title: e.title, body: e.body });
  }

  return {
    source: OFFICIAL_SOURCE,
    wcagVersion: String(criteres.wcag.version),
    themes,
    criteria,
    tests,
    glossary,
  };
}
