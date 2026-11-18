/**
 * Frames in which axe-core cannot run. A frame whose scripts are blocked
 * (an `iframe` with `sandbox` and no `allow-scripts`, or a document sent with
 * a `Content-Security-Policy: sandbox` header) accepts an injected script but
 * never fires its timers, so `axe.runPartial` never settles there and
 * `@axe-core/playwright` waits forever for it. We probe every frame first and
 * make the blocked ones fail at once for the duration of the axe run, which
 * `@axe-core/playwright` already treats as "this frame could not be tested".
 */
import type { Frame } from "playwright";
import type { FrameInfo } from "../types.ts";
import type { ScopeGap } from "./map.ts";

const TIMER_PROBE = "new Promise((resolve) => setTimeout(() => resolve(true), 0))";

async function timersRun(frame: Frame, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const hang = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const ran = frame.evaluate(TIMER_PROBE).then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([ran, hang]);
  } finally {
    clearTimeout(timer);
  }
}

export interface BlockedFrames {
  /** One gap per frame axe cannot run in. */
  gaps: ScopeGap[];
  /** True when the main frame itself is blocked: nothing can be analysed. */
  mainBlocked: boolean;
  /** Puts the frames back as they were. Always call it. */
  restore(): void;
}

export async function blockUnscriptableFrames(frames: readonly FrameInfo[], timeoutMs: number): Promise<BlockedFrames> {
  const verdicts = await Promise.all(
    frames.map(async (info) => {
      if (!info.readable) return { info, reason: info.unreadableReason ?? "the engine could not run a script in this frame" };
      if (await timersRun(info.frame, timeoutMs)) return { info, reason: undefined };
      return { info, reason: `scripts do not run in this frame (a timer did not fire within ${timeoutMs} ms), for example a sandboxed frame without allow-scripts` };
    }),
  );
  const gaps: ScopeGap[] = [];
  const patched: Frame[] = [];
  let mainBlocked = false;
  for (const { info, reason } of verdicts) {
    if (reason === undefined) continue;
    if (info.parent === null) mainBlocked = true;
    gaps.push({ reason: `frame ${info.frame.url() || "(no address)"}: ${reason}` });
    const frame = info.frame as unknown as { evaluate: unknown };
    Object.defineProperty(frame, "evaluate", {
      configurable: true,
      value: () => Promise.reject(new Error("axe adapter: no script can run in this frame")),
    });
    patched.push(info.frame);
  }
  return {
    gaps,
    mainBlocked,
    restore() {
      for (const f of patched) delete (f as unknown as { evaluate?: unknown }).evaluate;
    },
  };
}
