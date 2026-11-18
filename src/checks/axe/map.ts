/**
 * Turns axe-core results into check results (spec 8.3, 8.5). Pure: no browser,
 * no files. The provider (`index.ts`) gathers the axe results and the frames
 * that could not be analysed, and this module decides what each rule says.
 */
import { createHash } from "node:crypto";
import type { AxeResults, NodeResult, Result } from "axe-core";
import type { CheckId } from "../../schema/index.ts";
import type { CheckFailure, CheckResult, CheckRunResult, RawEvidence } from "../types.ts";

/**
 * Locator format. axe's `target` is a list of selectors, one per frame hop,
 * and an element inside a shadow tree is itself a list of selectors, one per
 * shadow hop. We write frame hops joined by ` >>> ` (outermost frame first)
 * and shadow hops joined by ` >> `. So `["iframe#a", ["#host", "img"]]`
 * becomes `iframe#a >>> #host >> img`.
 */
export const FRAME_HOP = " >>> ";
export const SHADOW_HOP = " >> ";

export function locatorOf(target: readonly (string | readonly string[])[]): string {
  return target.map((hop) => (typeof hop === "string" ? hop : hop.join(SHADOW_HOP))).join(FRAME_HOP);
}

/** A frame (or a whole page) whose document axe did not analyse. */
export interface ScopeGap {
  /** Locator of the frame element in its parent, when known. */
  locator?: string;
  /** HTML of the frame element, when known. */
  snippet?: string;
  /** Why the document was not analysed, in words. */
  reason: string;
}

export interface MapOptions {
  /** At most this many locators are listed in a `scope_examined` evidence of a `no_fault`. */
  passLocatorCap: number;
}

/** The id of the extra rule that reports frames axe could not analyse. It is a scope probe, not a check. */
export const SCOPE_PROBE_RULE = "frame-tested";

export function reportedIn(results: AxeResults, ruleId: string): { list: keyof Pick<AxeResults, "violations" | "incomplete" | "passes" | "inapplicable">; result: Result }[] {
  const out: { list: "violations" | "incomplete" | "passes" | "inapplicable"; result: Result }[] = [];
  for (const list of ["violations", "incomplete", "passes", "inapplicable"] as const) {
    for (const r of results[list]) if (r.id === ruleId) out.push({ list, result: r });
  }
  return out;
}

/** Frames axe reported as not analysed (`frame-tested` nodes left undecided), as gaps. */
export function untestedFramesOf(results: AxeResults): ScopeGap[] {
  const gaps: ScopeGap[] = [];
  for (const { list, result } of reportedIn(results, SCOPE_PROBE_RULE)) {
    if (list !== "incomplete") continue;
    for (const node of result.nodes) {
      gaps.push({
        locator: locatorOf(node.target),
        snippet: node.html,
        reason: "axe could not analyse the document of this frame (no result came back from it)",
      });
    }
  }
  return gaps;
}

/** How many frames axe did analyse: nodes of `frame-tested` that were decided (passed). */
export function testedFrameCount(results: AxeResults): number {
  let n = 0;
  for (const { list, result } of reportedIn(results, SCOPE_PROBE_RULE)) if (list === "passes") n += result.nodes.length;
  return n;
}

function failedCheckIds(node: NodeResult): string[] {
  return [...node.any, ...node.all, ...node.none].map((c) => c.id);
}

/** Stable across pages: the failing axe check ids and the nodes' HTML, each sorted, hashed. */
export function faultFingerprint(checkId: CheckId, nodes: readonly NodeResult[]): string {
  const ids = [...new Set(nodes.flatMap(failedCheckIds))].sort();
  const html = nodes.map((n) => n.html).sort();
  const hash = createHash("sha256").update(JSON.stringify({ ids, html })).digest("hex").slice(0, 16);
  return `${checkId}:${hash}`;
}

function messagesOf(node: NodeResult): string {
  if (node.failureSummary) return node.failureSummary;
  return [...node.any, ...node.all, ...node.none].map((c) => c.message).filter((m) => m).join(" | ");
}

function nodeEvidence(node: NodeResult, note: string): RawEvidence {
  const e: RawEvidence = { kind: "dom_node", locator: locatorOf(node.target), snippet: node.html };
  if (note) e.note = note;
  return e;
}

function gapEvidence(gap: ScopeGap): RawEvidence {
  const e: RawEvidence = { kind: "scope_examined", note: `Frame not analysed, scope incomplete: ${gap.reason}` };
  if (gap.locator) e.locator = gap.locator;
  if (gap.snippet) e.snippet = gap.snippet;
  return e;
}

function nodesOf(results: AxeResults, ruleId: string, list: "violations" | "incomplete" | "passes"): NodeResult[] {
  return reportedIn(results, ruleId)
    .filter((r) => r.list === list)
    .flatMap((r) => r.result.nodes);
}

/** What one rule says, given every list axe filled and the gaps in scope. */
export function mapRule(
  checkId: CheckId,
  ruleId: string,
  results: AxeResults,
  gaps: readonly ScopeGap[],
  testedFrames: number,
  opts: MapOptions,
): CheckRunResult {
  const reported = reportedIn(results, ruleId);
  if (reported.length === 0) {
    const f: CheckFailure = { outcome: "error", kind: "check_error", message: `rule not reported: axe-core gave no result for ${ruleId} in any list` };
    return f;
  }
  const violations = nodesOf(results, ruleId, "violations");
  const incomplete = nodesOf(results, ruleId, "incomplete");
  const passes = nodesOf(results, ruleId, "passes");
  const gapNotes = gaps.map(gapEvidence);

  if (violations.length > 0) {
    const evidence = [
      ...violations.map((n) => nodeEvidence(n, messagesOf(n))),
      ...incomplete.map((n) => nodeEvidence(n, `Could not be decided by axe-core: ${messagesOf(n)}`)),
      ...gapNotes,
    ];
    const r: CheckResult = { outcome: "fault", evidence, fingerprint: faultFingerprint(checkId, violations) };
    return r;
  }
  if (incomplete.length > 0) {
    const evidence = [...incomplete.map((n) => nodeEvidence(n, messagesOf(n))), ...gapNotes];
    return { outcome: "cannot_tell", evidence, fingerprint: `${checkId}:cannot_tell` };
  }
  if (passes.length > 0) {
    const shown = passes.slice(0, opts.passLocatorCap).map((n) => locatorOf(n.target));
    const scope: RawEvidence = {
      kind: "scope_examined",
      locator: JSON.stringify(shown),
      note: `${passes.length} element(s) examined by axe-core rule ${ruleId}, none faulty; ${shown.length} locator(s) listed (cap ${opts.passLocatorCap}), as a JSON array.`,
    };
    if (gaps.length > 0) {
      return { outcome: "cannot_tell", evidence: [scope, ...gapNotes], fingerprint: `${checkId}:cannot_tell` };
    }
    return { outcome: "no_fault", evidence: [scope], fingerprint: `${checkId}:no_fault` };
  }
  // Only in `inapplicable`.
  const scope: RawEvidence = {
    kind: "scope_examined",
    note: `axe-core rule ${ruleId} found no matching element in the frames examined: the main document and ${testedFrames} frame(s).`,
  };
  if (gaps.length > 0) {
    return { outcome: "cannot_tell", evidence: [scope, ...gapNotes], fingerprint: `${checkId}:cannot_tell` };
  }
  return { outcome: "inapplicable", evidence: [scope], fingerprint: `${checkId}:inapplicable` };
}
