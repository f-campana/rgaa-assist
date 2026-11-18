/** Building check results for family A (`src/checks/types.ts`). */
import type { CheckId } from "../../../schema/index.ts";
import type { CheckFailure, CheckResult, FrameInfo, RawEvidence } from "../../types.ts";
import type { RenderedFrame } from "./frames.ts";

export function fault(id: CheckId, what: string, evidence: RawEvidence[]): CheckResult {
  return { outcome: "fault", evidence, fingerprint: `${id}:${what}` };
}

export function noFault(id: CheckId, evidence: RawEvidence[]): CheckResult {
  return { outcome: "no_fault", evidence, fingerprint: `${id}:no_fault` };
}

export function cannotTell(id: CheckId, evidence: RawEvidence[]): CheckResult {
  return { outcome: "cannot_tell", evidence, fingerprint: `${id}:cannot_tell` };
}

export function checkError(message: string): CheckFailure {
  return { outcome: "error", kind: "check_error", message };
}

export function scopeUnreadable(message: string): CheckFailure {
  return { outcome: "error", kind: "scope_unreadable", message };
}

/** The main frame, readable; or the failure to return. */
export function mainFrameOrFailure(frames: readonly FrameInfo[]): FrameInfo | CheckFailure {
  const main = frames[0];
  if (main === undefined || main.parent !== null) return checkError("the engine gave no main frame");
  if (!main.readable) return scopeUnreadable(`the top-level document cannot be read: ${main.unreadableReason ?? "unknown reason"}`);
  return main;
}

export function text(note: string): RawEvidence {
  return { kind: "text", note };
}

export function scope(note: string, locator?: string): RawEvidence {
  return locator === undefined ? { kind: "scope_examined", note } : { kind: "scope_examined", locator, note };
}

export function firstLine(e: unknown): string {
  const t = e instanceof Error ? e.message : String(e);
  return (t.split("\n").find((l) => l.trim().length > 0) ?? "unknown error").trim();
}

/** One line per framed document a frame clause abstained on. */
export function frameNote(frame: RenderedFrame, why: string): string {
  const element = frame.elementKnown ? "a rendered iframe or frame" : "a frame whose element could not be reached (counted as a rendered iframe or frame)";
  return `${element} at ${frame.url}: ${why}`;
}
