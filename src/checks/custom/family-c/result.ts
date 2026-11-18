/**
 * Turning per-element verdicts into one page result, the same way for the
 * four checks of family C:
 *
 * 1. `fault` if any element has a fault, in a document that was read. A
 *    definite fault wins over a document the check could not read; the
 *    unread documents are listed as limits (M1 gate package).
 * 2. Otherwise `cannot_tell` if a document could not be read, or if any
 *    element got cannot_tell. An unread document comes before `no_fault`
 *    and `inapplicable`: it may hold the elements the test is about.
 * 3. Otherwise `no_fault` if at least one element was examined.
 * 4. Otherwise `inapplicable`.
 */
import type { CheckResult, RawEvidence } from "../../types.ts";
import type { CheckId } from "../../../schema/index.ts";
import type { ElementBase } from "./scan.js";
import type { FrameRead, PageRead } from "./read.ts";

export interface Verdict {
  kind: "fault" | "cannot_tell" | "ok";
  /** Which step of the record decided, in words. */
  branch: string;
  frame: FrameRead;
  element: Pick<ElementBase, "locator" | "snippet"> & { descriptor?: string };
}

export interface Unread {
  frame: FrameRead;
  reason: string;
}

export interface AssembleInput {
  checkId: CheckId;
  verdicts: Verdict[];
  unread: Unread[];
  /** Plural noun for what the check looks for: "frame elements (iframe, frame)". */
  what: string;
  /** At most this many cannot_tell elements, and examined locators of a no_fault, are listed. */
  listCap: number;
}

/** The element's locator with its frame hops: `iframe#a >>> #host >> img`. */
export function fullLocator(frame: FrameRead, locator: string): string {
  return frame.prefix === "" ? locator : `${frame.prefix} >>> ${locator}`;
}

function frameName(frame: FrameRead): string {
  if (frame.index === 0) return `the main document (${frame.url || "no address"})`;
  const where = frame.prefix !== "" ? `frame element ${frame.prefix}` : "a frame whose frame element could not be read";
  return `${where} (${frame.url || "no address"})`;
}

/** Frames whose part of the scan ran, for scope notes. */
export function framesList(read: PageRead, examined: (f: FrameRead) => boolean): string {
  const names = read.frames.filter(examined).map(frameName);
  return `${names.length} document(s): ${names.join("; ")}`;
}

function scopeEvidence(input: AssembleInput, read: PageRead, examined: (f: FrameRead) => boolean, extra: string): RawEvidence {
  const n = input.verdicts.length;
  return {
    kind: "scope_examined",
    note: `${n} ${input.what} examined in ${framesList(read, examined)}. ${extra}`.trim(),
  };
}

function unreadEvidence(u: Unread): RawEvidence {
  const e: RawEvidence = {
    kind: "text",
    note: `Not read: ${frameName(u.frame)}. ${u.reason}. The check abstains on what it may hold.`,
  };
  if (u.frame.prefix !== "") e.locator = u.frame.prefix;
  return e;
}

function elementEvidence(v: Verdict): RawEvidence {
  return {
    kind: "dom_node",
    locator: fullLocator(v.frame, v.element.locator),
    snippet: v.element.snippet,
    note: v.branch,
  };
}

/** `<checkId>:<what>` from the faulty elements' descriptors, without page addresses or generated ids. */
function faultFingerprint(checkId: CheckId, faults: Verdict[]): string {
  const ds = [...new Set(faults.map((f) => f.element.descriptor ?? "element"))].sort();
  const what = ds.join("|");
  return `${checkId}:${what.length > 300 ? `${what.slice(0, 300)}…` : what}`;
}

export function assemble(input: AssembleInput, read: PageRead, examined: (f: FrameRead) => boolean): CheckResult {
  const { checkId, verdicts, unread, listCap } = input;
  const faults = verdicts.filter((v) => v.kind === "fault");
  const abstained = verdicts.filter((v) => v.kind === "cannot_tell");
  const ok = verdicts.filter((v) => v.kind === "ok");
  const counts = `${faults.length} with a fault, ${abstained.length} the check abstains on, ${ok.length} meeting the requirement.`;

  if (faults.length > 0) {
    return {
      outcome: "fault",
      evidence: [
        ...faults.map(elementEvidence),
        ...unread.map(unreadEvidence),
        scopeEvidence(input, read, examined, counts),
      ],
      fingerprint: faultFingerprint(checkId, faults),
    };
  }

  if (unread.length > 0 || abstained.length > 0) {
    const shown = abstained.slice(0, listCap);
    const evidence: RawEvidence[] = [...unread.map(unreadEvidence), ...shown.map(elementEvidence)];
    if (abstained.length > shown.length) {
      evidence.push({ kind: "text", note: `${abstained.length - shown.length} more element(s) the check abstains on are not listed (cap ${listCap}).` });
    }
    evidence.push(scopeEvidence(input, read, examined, counts));
    return { outcome: "cannot_tell", evidence, fingerprint: `${checkId}:cannot_tell` };
  }

  if (ok.length > 0) {
    const shown = ok.slice(0, listCap).map((v) => fullLocator(v.frame, v.element.locator));
    return {
      outcome: "no_fault",
      evidence: [
        {
          kind: "scope_examined",
          locator: JSON.stringify(shown),
          note: `${ok.length} ${input.what} examined in ${framesList(read, examined)}, none faulty; ${shown.length} locator(s) listed (cap ${listCap}), as a JSON array.`,
        },
      ],
      fingerprint: `${checkId}:no_fault`,
    };
  }

  return {
    outcome: "inapplicable",
    evidence: [
      {
        kind: "scope_examined",
        note: `No ${input.what} found in ${framesList(read, examined)}, shadow trees included.`,
      },
    ],
    fingerprint: `${checkId}:inapplicable`,
  };
}

/**
 * The scan part a check needs, frame by frame: verdict inputs for frames
 * where it ran, `Unread` entries for the others.
 */
export function partsOf<T>(
  read: PageRead,
  pick: (f: FrameRead) => { ok: true; value: T } | { ok: false; error: string } | undefined,
): { parts: { frame: FrameRead; value: T }[]; unread: Unread[] } {
  const parts: { frame: FrameRead; value: T }[] = [];
  const unread: Unread[] = [];
  for (const frame of read.frames) {
    if (frame.unread !== undefined) {
      unread.push({ frame, reason: frame.unread });
      continue;
    }
    const p = pick(frame);
    if (p === undefined) unread.push({ frame, reason: "the frame was not scanned" });
    else if (p.ok) parts.push({ frame, value: p.value });
    else unread.push({ frame, reason: `the check's reading failed in this document: ${p.error}` });
  }
  return { parts, unread };
}

/** Accessibility look-up result for an element: true exposed, false not, null unknown or not asked. */
export function exposure(frame: FrameRead, ax: number | null | undefined): boolean | null {
  if (ax === null || ax === undefined) return null;
  const v = frame.ax.get(ax);
  return v === undefined ? null : v;
}
