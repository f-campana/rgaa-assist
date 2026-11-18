/**
 * Family B: one reading of the whole page, shared by both checks.
 *
 * `scanDocument` runs once in every frame of `ctx.frames`, then the closed
 * shadow roots are read through CDP. The two checks decide from the same
 * reading, so the page is walked once per frame for both.
 */
import type { CheckContext, FrameInfo } from "../../types.ts";
import { readClosedShadowRoots } from "./closed-shadow.ts";
import type { ClosedShadowNames, ClosedShadowReading } from "./closed-shadow.ts";
import { scanDocument } from "./scan.ts";
import type { ScanInput, ScanOutput } from "./scan.ts";

export interface NestedReading {
  /** Position in `ctx.frames` (1 is the first nested frame). */
  index: number;
  url: string;
  crossOrigin: boolean;
  scan?: ScanOutput;
  /** Why the document could not be read; absent when `scan` is present. */
  unreadable?: string;
}

export interface PageReading {
  top: ScanOutput;
  nested: NestedReading[];
  closed: ClosedShadowReading;
}

export class TopUnreadable extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number, what: string, signal: AbortSignal): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  let onAbort: (() => void) | undefined;
  const stop = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not finish within ${ms} ms`)), ms);
    onAbort = () => reject(new Error(`${what} was aborted: the provider timeout expired`));
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  p.catch(() => undefined);
  return Promise.race([p, stop]).finally(() => {
    clearTimeout(timer);
    if (onAbort) signal.removeEventListener("abort", onAbort);
  });
}

function firstLine(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).split("\n")[0] ?? "";
}

async function scanFrame(info: FrameInfo, input: ScanInput, timeoutMs: number, signal: AbortSignal): Promise<ScanOutput> {
  if (!info.readable) throw new Error(info.unreadableReason ?? "the engine could not run a script in this frame");
  return withTimeout(info.frame.evaluate(scanDocument, input), timeoutMs, "reading the document", signal);
}

export async function readPage(
  ctx: CheckContext,
  input: ScanInput,
  closedNames: Omit<ClosedShadowNames, "timeoutMs" | "sampleCap">,
  timeoutMs: number,
): Promise<PageReading> {
  const [mainInfo, ...rest] = ctx.frames;
  if (mainInfo === undefined) throw new TopUnreadable("the target has no frame");
  let top: ScanOutput;
  try {
    top = await scanFrame(mainInfo, input, timeoutMs, ctx.signal);
  } catch (e) {
    throw new TopUnreadable(`the top-level document could not be read: ${firstLine(e)}`);
  }
  const nested: NestedReading[] = [];
  for (const [i, info] of rest.entries()) {
    const base = { index: i + 1, url: info.frame.url(), crossOrigin: info.crossOrigin };
    try {
      nested.push({ ...base, scan: await scanFrame(info, input, timeoutMs, ctx.signal) });
    } catch (e) {
      if (ctx.signal.aborted) throw e;
      nested.push({ ...base, unreadable: firstLine(e) });
    }
  }
  const closed = await readClosedShadowRoots(ctx, { ...closedNames, sampleCap: input.sampleCap, timeoutMs });
  return { top, nested, closed };
}
