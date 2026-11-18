/**
 * Family B: evidence shared by both checks. A check gathers its fault hits
 * and its abstentions (each named after the branch of its record that
 * abstains) and turns them into a `CheckResult` here.
 */
import type { CheckResult, RawEvidence } from "../../types.ts";
import type { NestedReading, PageReading } from "./read.ts";
import type { Region, ScanOutput } from "./scan.ts";

export interface Sample {
  locator: string;
  snippet: string;
}

/** One case of step (2) the page holds. */
export interface Abstention {
  /** The branch of the record, quoted or closely paraphrased. */
  branch: string;
  /** Where: "the top-level document", "frame 2 (<url>)", … */
  where: string;
  /** How many instances (0 when the abstention is about a document or root that could not be read). */
  count: number;
  samples: Sample[];
}

export interface Fault {
  /** What the fingerprint groups on: `center`, `td@width`. */
  detail: string;
  locator: string;
  snippet: string;
  note: string;
}

export const REGION_LABEL: Readonly<Record<Region, string>> = {
  tree: "the document tree",
  "tree-noscript": "the document tree, under a noscript element",
  shadow: "a shadow tree",
  template: "the content of a template element",
  "noscript-text": "the text of a noscript element, parsed as HTML",
};

export function nestedLabel(n: NestedReading): string {
  return `frame ${n.index} (${n.crossOrigin ? "cross-origin, " : ""}${n.url || "no address"})`;
}

function scanSummary(s: ScanOutput): string {
  const e = s.elements;
  const total = e.tree + e["tree-noscript"] + e.shadow + e.template + e["noscript-text"];
  return (
    `${total} element(s): ${e.tree + e["tree-noscript"]} in the document tree (${e["tree-noscript"]} under noscript), ` +
    `${e.shadow} in ${s.shadowRoots} open shadow root(s), ${e.template} in ${s.templates} template content(s), ` +
    `${e["noscript-text"]} in ${s.noscriptTexts} noscript text(s) parsed as HTML`
  );
}

/** What was examined, for `scope_examined`. */
export function scopeNote(reading: PageReading, what: string): string {
  const parts = [`Searched for ${what}, hidden elements included.`, `Top-level document (${reading.top.contentType}): ${scanSummary(reading.top)}.`];
  if (reading.nested.length === 0) parts.push("No nested document.");
  for (const n of reading.nested) {
    parts.push(n.scan ? `${nestedLabel(n)}: ${scanSummary(n.scan)}.` : `${nestedLabel(n)}: could not be read (${n.unreadable ?? "unknown"}).`);
  }
  parts.push(
    `Closed shadow roots read through CDP: ${reading.closed.closedRoots}, holding ${reading.closed.elements} element(s)` +
      (reading.closed.unreadable.length > 0 ? `; not read: ${reading.closed.unreadable.join("; ")}.` : "."),
  );
  return parts.join(" ");
}

function abstentionEvidence(a: Abstention): RawEvidence[] {
  const head = `(2) ${a.branch}, in ${a.where}${a.count > 0 ? `: ${a.count} instance(s)` : ""}`;
  if (a.samples.length === 0) return [{ kind: "text", note: `${head}.` }];
  return a.samples.map((s, i) => ({
    kind: "dom_node" as const,
    locator: s.locator,
    snippet: s.snippet,
    note: i === 0 && a.count > a.samples.length ? `${head}; ${a.samples.length} listed.` : `${head}.`,
  }));
}

export function faultResult(checkId: string, faults: Fault[], faultTotal: number, abstentions: Abstention[]): CheckResult {
  const evidence: RawEvidence[] = faults.map((f) => ({ kind: "dom_node", locator: f.locator, snippet: f.snippet, note: f.note }));
  if (faultTotal > faults.length) {
    evidence.push({ kind: "text", note: `(1) ${faultTotal} faulty instance(s) in all; the first ${faults.length} are named (cap).` });
  }
  if (abstentions.length > 0) {
    evidence.push({
      kind: "text",
      note:
        "The fault wins over these cases of (2), also present: " +
        abstentions.map((a) => `${a.branch}, in ${a.where}${a.count > 0 ? ` (${a.count})` : ""}`).join("; ") +
        ".",
    });
  }
  const details = [...new Set(faults.map((f) => f.detail))].sort();
  return { outcome: "fault", evidence, fingerprint: `${checkId}:${details.join(",")}` };
}

export function cannotTellResult(checkId: string, reading: PageReading, what: string, abstentions: Abstention[]): CheckResult {
  return {
    outcome: "cannot_tell",
    evidence: [{ kind: "scope_examined", note: scopeNote(reading, what) }, ...abstentions.flatMap(abstentionEvidence)],
    fingerprint: `${checkId}:cannot_tell`,
  };
}

export function noFaultResult(checkId: string, reading: PageReading, what: string, applying: Sample[], applyingNote: string): CheckResult {
  const scope: RawEvidence = { kind: "scope_examined", note: `${scopeNote(reading, what)} Nothing that gives a fault or a case of (2). ${applyingNote}`.trim() };
  if (applying.length > 0) scope.locator = JSON.stringify([...new Set(applying.map((s) => s.locator))]);
  return { outcome: "no_fault", evidence: [scope], fingerprint: `${checkId}:no_fault` };
}
