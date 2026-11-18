/**
 * Derives the pinned ISO 639 code list of `custom/8-4-default-lang-code-valid`
 * from the two files vendored under `source/` (see `source/SOURCE.md`; never
 * edited), and writes it to `iso-639-codes.json`:
 *
 *   node src/checks/custom/8-4-default-lang-code-valid/derive.ts --write
 *
 * - IANA Language Subtag Registry: the subtag of every record of type
 *   `language` or `extlang`, deprecated ones included (ISO 639-1, the
 *   ISO 639-2, 639-3 and 639-5 codes, the reserved range `qaa..qtz`, and
 *   withdrawn codes such as `iw`, `in`, `ji`, `mo`).
 * - Library of Congress ISO 639-2 table: the bibliographic and terminologic
 *   codes and the ISO 639-1 code of every line (`qaa-qtz` expanded), which
 *   adds the bibliographic forms the registry leaves out (`fre`, `ger`, …).
 *
 * The test `tests/checks/custom/8-4-default-lang-code-valid/` checks that the
 * committed list is exactly what this derivation gives from the vendored files.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Change when the derivation (not the sources) changes. */
export const DERIVATION_VERSION = 1;

export const SOURCE_DIR = join(import.meta.dirname, "source");
export const LIST_FILE = join(import.meta.dirname, "iso-639-codes.json");
const REGISTRY = "language-subtag-registry.txt";
const LOC = "ISO-639-2_utf-8.txt";

export interface CodeList {
  /** `iso639-v<derivation>+iana-<File-Date>+loc-<first 12 hex of sha256>` */
  version: string;
  derivationVersion: number;
  sources: {
    ianaRegistry: { file: string; fileDate: string; sha256: string };
    locIso6392: { file: string; sha256: string };
  };
  count: number;
  /** Lowercase, sorted. */
  codes: string[];
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** `aaa..bbb` or `aaa-bbb`, both ends of the same length, letters only. */
function expandRange(from: string, to: string): string[] {
  if (from.length !== to.length || !/^[a-z]+$/.test(from) || !/^[a-z]+$/.test(to) || from > to) {
    throw new Error(`unexpected range ${from}..${to}`);
  }
  const out: string[] = [];
  const cur = [...from].map((c) => c.charCodeAt(0));
  for (;;) {
    const s = String.fromCharCode(...cur);
    out.push(s);
    if (s === to) return out;
    let i = cur.length - 1;
    while (i >= 0 && cur[i] === 122) {
      cur[i] = 97;
      i--;
    }
    if (i < 0) throw new Error(`range ${from}..${to} overflowed`);
    cur[i] = (cur[i] ?? 97) + 1;
  }
}

function fromRegistry(text: string): { fileDate: string; codes: string[] } {
  const records = text.replace(/\r\n/g, "\n").split(/\n%%\n/);
  const head = records[0] ?? "";
  const m = /^File-Date: (\d{4}-\d{2}-\d{2})$/m.exec(head);
  if (m === null) throw new Error("the registry has no File-Date");
  const codes: string[] = [];
  for (const rec of records.slice(1)) {
    const type = /^Type: (\S+)$/m.exec(rec)?.[1];
    if (type !== "language" && type !== "extlang") continue;
    const subtag = /^Subtag: (\S+)$/m.exec(rec)?.[1];
    if (subtag === undefined) throw new Error(`a ${type} record has no Subtag`);
    const lower = subtag.toLowerCase();
    const range = /^([a-z]+)\.\.([a-z]+)$/.exec(lower);
    if (range !== null) codes.push(...expandRange(range[1] ?? "", range[2] ?? ""));
    else codes.push(lower);
  }
  return { fileDate: m[1] ?? "", codes };
}

function fromLoc(text: string): string[] {
  const codes: string[] = [];
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const fields = line.split("|");
    if (fields.length !== 5) throw new Error(`unexpected line in the ISO 639-2 table: ${line}`);
    for (const f of fields.slice(0, 3)) {
      const v = f.trim().toLowerCase();
      if (v === "") continue;
      const range = /^([a-z]+)-([a-z]+)$/.exec(v);
      if (range !== null) codes.push(...expandRange(range[1] ?? "", range[2] ?? ""));
      else codes.push(v);
    }
  }
  return codes;
}

/** The list as derived from the files in `dir`. */
export function deriveCodeList(dir: string = SOURCE_DIR): CodeList {
  const registryBuf = readFileSync(join(dir, REGISTRY));
  const locBuf = readFileSync(join(dir, LOC));
  const registry = fromRegistry(registryBuf.toString("utf8"));
  const loc = fromLoc(locBuf.toString("utf8"));
  const set = new Set([...registry.codes, ...loc]);
  for (const c of set) if (!/^[a-z]{2,3}$/.test(c)) throw new Error(`unexpected code ${JSON.stringify(c)}`);
  const codes = [...set].sort();
  const locSha = sha256(locBuf);
  return {
    version: `iso639-v${DERIVATION_VERSION}+iana-${registry.fileDate}+loc-${locSha.slice(0, 12)}`,
    derivationVersion: DERIVATION_VERSION,
    sources: {
      ianaRegistry: { file: `source/${REGISTRY}`, fileDate: registry.fileDate, sha256: sha256(registryBuf) },
      locIso6392: { file: `source/${LOC}`, sha256: locSha },
    },
    count: codes.length,
    codes,
  };
}

export function serialise(list: CodeList): string {
  const { codes, ...rest } = list;
  const head = JSON.stringify(rest, null, 2).replace(/\n}$/, "");
  const lines: string[] = [];
  for (let i = 0; i < codes.length; i += 16) lines.push(`    ${codes.slice(i, i + 16).map((c) => JSON.stringify(c)).join(", ")}`);
  return `${head},\n  "codes": [\n${lines.join(",\n")}\n  ]\n}\n`;
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1] && process.argv.includes("--write")) {
  const list = deriveCodeList();
  writeFileSync(LIST_FILE, serialise(list));
  console.log(`wrote ${list.count} codes, version ${list.version}`);
}
