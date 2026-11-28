/**
 * Design 4.6, the static check (supplemental). It flags template literals with interpolation and string
 * concatenations that feed check-owned strings in `src/checks/**`: notes, fingerprint labels, enumeration or
 * branch descriptions, error messages and reasons. It is NOT a provenance proof: it misses aliases, returns,
 * object properties and assignments through other names. The proof is structural (design 3.2): page text reaches
 * output only through derivations the engine reads itself.
 *
 * Reports `file:line` only, never the text of a hit.
 *
 * Run by `pnpm test:privacy` (never by `pnpm test`). It does not fail on today's code: the current hits are the
 * known list in `static-check.known.json` (per-file counts). It fails when a file gains hits beyond its known
 * count, or when a hit appears in a new file. To print the current hits: `node tests/privacy/static-check.privacy.ts`.
 * To record a reviewed new baseline: `node tests/privacy/static-check.privacy.ts --record`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const CHECKS = join(ROOT, "src", "checks");
const KNOWN = join(import.meta.dirname, "static-check.known.json");

/** The key before the literal that makes it a check-owned string. */
const OWNED = /\b(note|notes|fingerprint|label|labels|branch|message|reason|why|detail|description|enumeration|abstentions?|locatorList|unread)\b\s*[:=(,[]|\b(note|fingerprint|label|branch|reason|describe\w*|\w*Note|\w*Label)\s*\(|return\s*$|\bfault\(|\bcannotTell\(|\bnoFault\(|\bcheckError\(|\bscope\(|=>\s*$/;

export interface Hit {
  file: string;
  line: number;
  kind: "template" | "concatenation";
}

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|js|mjs)$/.test(name) && !/\.test\.|\.d\.ts$/.test(name)) out.push(p);
  }
  return out.sort();
}

interface Lit {
  start: number;
  end: number;
  template: boolean;
  interpolated: boolean;
}

/** A small tokenizer: string, template (with nested `${}`), comment and regex literals. */
function literals(src: string): Lit[] {
  const lits: Lit[] = [];
  const n = src.length;
  let prevSignificant = "";
  const skipTemplate = (from: number): { end: number; interpolated: boolean } => {
    let i = from + 1;
    let interpolated = false;
    while (i < n) {
      const c = src[i];
      if (c === "\\") i += 2;
      else if (c === "`") return { end: i + 1, interpolated };
      else if (c === "$" && src[i + 1] === "{") {
        interpolated = true;
        i += 2;
        let depth = 1;
        while (i < n && depth > 0) {
          const d = src[i];
          if (d === "{") depth += 1;
          else if (d === "}") depth -= 1;
          else if (d === "`") {
            i = skipTemplate(i).end;
            continue;
          } else if (d === '"' || d === "'") {
            i += 1;
            while (i < n && src[i] !== d) i += src[i] === "\\" ? 2 : 1;
          }
          i += 1;
        }
      } else i += 1;
    }
    return { end: n, interpolated };
  };
  let i = 0;
  while (i < n) {
    const c = src[i] as string;
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i += 1;
    } else if (c === "/" && next === "*") {
      const e = src.indexOf("*/", i + 2);
      i = e < 0 ? n : e + 2;
    } else if (c === "`") {
      const t = skipTemplate(i);
      lits.push({ start: i, end: t.end, template: true, interpolated: t.interpolated });
      i = t.end;
      prevSignificant = "`";
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      lits.push({ start: i, end: j + 1, template: false, interpolated: false });
      i = j + 1;
      prevSignificant = c;
    } else if (c === "/" && /[(,=:[!&|?{};]|^$/.test(prevSignificant)) {
      let j = i + 1;
      let inClass = false;
      while (j < n && src[j] !== "\n" && (inClass || src[j] !== "/")) {
        if (src[j] === "\\") j += 1;
        else if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        j += 1;
      }
      i = j + 1;
      prevSignificant = "/";
    } else {
      if (!/\s/.test(c)) prevSignificant = c;
      i += 1;
    }
  }
  return lits;
}

export function scan(): Hit[] {
  const hits: Hit[] = [];
  for (const path of files(CHECKS)) {
    const src = readFileSync(path, "utf8");
    const file = relative(ROOT, path);
    const lineOf = (pos: number): number => src.slice(0, pos).split("\n").length;
    const lits = literals(src);
    lits.forEach((lit, k) => {
      const lineStart = src.lastIndexOf("\n", lit.start - 1) + 1;
      const before = src.slice(Math.max(0, lineStart - 200), lit.start);
      const owned = OWNED.test(before.split("\n").slice(-2).join(" "));
      if (lit.template) {
        if (lit.interpolated && owned) hits.push({ file, line: lineOf(lit.start), kind: "template" });
        return;
      }
      // A string literal joined to something else with `+` (either side), where the other side is not a string literal.
      const after = src.slice(lit.end, lit.end + 40).trimStart();
      const prev = k > 0 ? lits[k - 1] : undefined;
      const joinsAfter = after.startsWith("+") && !/^\+\s*["'`]/.test(after) && !after.startsWith("+=");
      const gap = prev === undefined ? "" : src.slice(prev.end, lit.start);
      void gap;
      const joinsBefore = /\+\s*$/.test(src.slice(Math.max(0, lit.start - 6), lit.start)) && !/["'`]\s*\+\s*$/.test(src.slice(Math.max(0, lit.start - 6), lit.start));
      if ((joinsAfter || joinsBefore) && owned) hits.push({ file, line: lineOf(lit.start), kind: "concatenation" });
    });
  }
  return hits;
}

function counts(hits: Hit[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of hits) out[h.file] = (out[h.file] ?? 0) + 1;
  return out;
}

if (process.argv[1] !== undefined && process.argv[1].endsWith("static-check.privacy.ts") && !process.env.VITEST) {
  const hits = scan();
  if (process.argv.includes("--record")) {
    writeFileSync(KNOWN, `${JSON.stringify({ note: "Per-file hit counts of the static check on the recorded code. New hits beyond these fail the check.", total: hits.length, counts: counts(hits) }, null, 2)}\n`);
  }
  process.stdout.write(`${hits.map((h) => `${h.file}:${h.line} (${h.kind})`).join("\n")}\ntotal ${hits.length}\n`);
  process.exit(0);
}

describe("design 4.6: static check of check-owned strings (supplemental, not a provenance proof)", () => {
  it("finds no hit beyond the known list (hits are file:line only)", () => {
    const hits = scan();
    const known = JSON.parse(readFileSync(KNOWN, "utf8")) as { counts: Record<string, number> };
    const now = counts(hits);
    const grown = Object.entries(now).filter(([file, c]) => c > (known.counts[file] ?? 0));
    const report = grown.map(([file, c]) => `${file}: ${c} hits, known ${known.counts[file] ?? 0}: lines ${hits.filter((h) => h.file === file).map((h) => h.line).join(",")}`);
    expect(report, "new template literals or concatenations in check-owned strings").toEqual([]);
  });
  it("sees something (the scanner is alive)", () => {
    expect(scan().length).toBeGreaterThan(0);
  });
});

