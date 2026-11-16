// Builds work/packets/theme-NN.md from the vendored official data and the axe
// table. Official text is reproduced exactly; nothing is interpreted.
// An axe tag only says a rule is relevant to a test, never that it decides it.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AxeTable } from "./build-axe-table.ts";

const root = join(import.meta.dirname, "..");
const officialDir = join(root, "src", "rulesets", "rgaa-4.1.2", "official");

interface Criterium {
  number: number;
  title: string;
  tests: Record<string, string[]>;
  references: unknown[];
  particularCases?: NoteItem[];
  technicalNote?: NoteItem[];
}
/** A note entry is a string, or a list holder `{ ul: string[] }`. */
type NoteItem = string | { ul: string[] };
interface Criteres {
  topics: { number: number; topic: string; criteria: { criterium: Criterium }[] }[];
}
interface Glossary {
  glossary: { title: string; body: string }[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

// "#image-objet" -> glossary title "Image objet": the anchor is the title
// lower-cased, accents removed, runs of non-alphanumerics turned into "-".
export function anchorOf(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function anchorsIn(text: string): string[] {
  return [...text.matchAll(/\]\(#([^)\s]*)\)/g)].map((m) => m[1]!);
}

/** Flattens note entries to [path, text] pairs: "2" for a string, "2 ul 1" for a list item. */
export function noteTexts(items: NoteItem[] | undefined): [string, string][] {
  const out: [string, string][] = [];
  (items ?? []).forEach((item, i) => {
    if (typeof item === "string") out.push([String(i + 1), item]);
    else item.ul.forEach((t, j) => out.push([`${i + 1} ul ${j + 1}`, t]));
  });
  return out;
}

// Fence long enough to hold any backtick run in the text.
function fence(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  return "`".repeat(Math.max(3, longest + 1));
}

function block(label: string, text: string): string {
  const f = fence(text);
  return `${label}\n\n${f}text\n${text}\n${f}\n`;
}

export interface PacketSet {
  /** file name -> content */
  files: Map<string, string>;
  /** theme number -> anchors that no glossary title maps to */
  unresolved: Map<number, string[]>;
}

export function buildPackets(): PacketSet {
  const criteres = readJson<Criteres>(join(officialDir, "criteres.json"));
  const methodologies = readJson<Record<string, string>>(join(officialDir, "methodologies.json"));
  const glossary = readJson<Glossary>(join(officialDir, "glossaire.json")).glossary;
  const axe = readJson<AxeTable>(join(officialDir, "..", "axe-rules.json"));
  const byAnchor = new Map(glossary.map((g) => [anchorOf(g.title), g]));
  const axeById = new Map(axe.rules.map((r) => [r.id, r]));

  const files = new Map<string, string>();
  const unresolved = new Map<number, string[]>();

  for (const topic of criteres.topics) {
    const used = new Set<string>();
    const out: string[] = [];
    const body: string[] = [];
    let testCount = 0;

    for (const { criterium: c } of topic.criteria) {
      const cid = `${topic.number}.${c.number}`;
      testCount += Object.keys(c.tests).length;
      for (const a of anchorsIn(c.title)) used.add(a);
      body.push(`## Criterion ${cid}\n`);
      body.push(block(`Title (criteres.json ${cid} title):`, c.title));
      for (const [path, t] of noteTexts(c.particularCases)) {
        for (const a of anchorsIn(t)) used.add(a);
        body.push(block(`Particular case ${path} (criteres.json ${cid} particularCases ${path}):`, t));
      }
      for (const [path, t] of noteTexts(c.technicalNote)) {
        for (const a of anchorsIn(t)) used.add(a);
        body.push(block(`Technical note ${path} (criteres.json ${cid} technicalNote ${path}):`, t));
      }
      body.push(
        block(`References (criteres.json ${cid} references):`, JSON.stringify(c.references, null, 2)),
      );

      for (const [n, lines] of Object.entries(c.tests)) {
        const tid = `${cid}.${n}`;
        body.push(`### Test ${tid}\n`);
        lines.forEach((line, i) => {
          for (const a of anchorsIn(line)) used.add(a);
          body.push(block(`Wording line ${i + 1} (criteres.json ${tid} line ${i + 1}):`, line));
        });
        const m = methodologies[tid];
        body.push(
          m === undefined
            ? `Methodology (methodologies.json ${tid}): none\n`
            : block(`Methodology (methodologies.json ${tid}):`, m),
        );
        const ruleIds = axe.testIndex[tid] ?? [];
        if (ruleIds.length === 0) {
          body.push(`axe-core rules tagged for ${tid}: none\n`);
        } else {
          body.push(
            `axe-core rules tagged for ${tid} (axe-rules.json, axe-core ${axe.axeVersion}). A tag says the rule is relevant to this test; it does not say the rule decides it.\n`,
          );
          for (const id of ruleIds) {
            const r = axeById.get(id)!;
            body.push(
              `- \`${r.id}\`: ${r.help} (best-practice: ${r.bestPractice ? "yes" : "no"}; experimental: ${r.experimental ? "yes" : "no"}; enabled by default: ${r.enabledByDefault ? "yes" : "no"})`,
            );
          }
          body.push("");
        }
      }
    }

    const missing = [...used].filter((a) => !byAnchor.has(a)).sort();
    unresolved.set(topic.number, missing);

    out.push(`# Theme ${topic.number}: ${topic.topic}\n`);
    out.push(`Criteria: ${topic.criteria.length}. Tests: ${testCount}.\n`);
    if (missing.length > 0) {
      out.push("Unresolved glossary anchors (no glossary title maps to them):\n");
      for (const a of missing) out.push(`- \`#${a}\``);
      out.push("");
    }
    out.push(...body);
    out.push("## Glossary entries linked from this theme\n");
    const entries = glossary.filter((g) => used.has(anchorOf(g.title)));
    if (entries.length === 0) out.push("None.\n");
    for (const g of entries) {
      out.push(block(`glossaire.json "${g.title}" (anchor #${anchorOf(g.title)}), title:`, g.title));
      out.push(block(`glossaire.json "${g.title}" body:`, g.body));
    }
    files.set(`theme-${String(topic.number).padStart(2, "0")}.md`, `${out.join("\n")}\n`);
  }
  return { files, unresolved };
}

export function writePackets(dir: string): PacketSet {
  const set = buildPackets();
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of set.files) writeFileSync(join(dir, name), content);
  return set;
}

if (import.meta.main) {
  const dir = join(root, "work", "packets");
  const set = writePackets(dir);
  console.log(`Wrote ${set.files.size} packets to ${dir}`);
  for (const [theme, a] of set.unresolved) {
    if (a.length > 0) console.log(`Theme ${theme} unresolved anchors: ${a.join(", ")}`);
  }
}
