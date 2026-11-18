/**
 * Establishing one target (spec 7.4, 8.1) and the frames and CDP sessions a
 * provider gets (`src/checks/types.ts`).
 *
 * M2 establishes `<pageId>/initial` only: a fresh context, the page loaded,
 * network idle awaited up to the settle timeout. No steps, no `expect`, no
 * saved session.
 */
import type { Browser, BrowserContext, CDPSession, Frame, Page } from "playwright";
import { INITIAL_STATE_ID } from "../schema/index.ts";
import type { Size, TargetExecution } from "../schema/index.ts";
import type { FrameInfo } from "../checks/types.ts";
import { CONTEXT_SETTINGS } from "./browser.ts";
import type { EngineTimeouts } from "./browser.ts";
import type { TargetSpec } from "./sample.ts";
import type { Sanitiser } from "./sanitise.ts";

/** Reject with `message` when `promise` has not settled within `ms`. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function firstLine(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.trim().length > 0 ? line.trim() : "unknown error";
}

// ---------------------------------------------------------------------------
// CDP sessions
// ---------------------------------------------------------------------------

const NO_SEPARATE_SESSION = "does not have a separate CDP session";

/**
 * `cdpFor(frame)`: the session of the frame's own CDP target. The main frame
 * uses a session on the page. An out-of-process frame gets its own session
 * (`context.newCDPSession(frame)`). A same-process frame uses the session of
 * its nearest ancestor that has one (the page's, or an out-of-process
 * parent's). Sessions are cached and detached by `detachAll`.
 */
export function createCdpSessions(context: BrowserContext, page: Page): {
  cdpFor(frame: Frame): Promise<CDPSession>;
  detachAll(): Promise<void>;
} {
  const byFrame = new Map<Frame, Promise<CDPSession>>();
  const created: Promise<CDPSession>[] = [];

  const cdpFor = (frame: Frame): Promise<CDPSession> => {
    const cached = byFrame.get(frame);
    if (cached !== undefined) return cached;
    let result: Promise<CDPSession>;
    if (frame === page.mainFrame()) {
      result = context.newCDPSession(page);
      created.push(result);
    } else {
      const own = context.newCDPSession(frame);
      result = own.then(
        (session) => {
          created.push(own);
          return session;
        },
        (e: unknown) => {
          const parent = frame.parentFrame();
          if (parent !== null && e instanceof Error && e.message.includes(NO_SEPARATE_SESSION)) return cdpFor(parent);
          throw e;
        },
      );
    }
    byFrame.set(frame, result);
    // Do not cache a failure: a later call may succeed.
    result.catch(() => byFrame.delete(frame));
    return result;
  };

  const detachAll = async (): Promise<void> => {
    const sessions = await Promise.allSettled(created);
    await Promise.allSettled(
      sessions.flatMap((s) => (s.status === "fulfilled" ? [s.value.detach()] : [])),
    );
    byFrame.clear();
    created.length = 0;
  };

  return { cdpFor, detachAll };
}

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

interface Probe {
  readable: boolean;
  origin: string | null;
  reason?: string;
}

async function probeFrame(frame: Frame, ms: number): Promise<Probe> {
  if (frame.isDetached()) return { readable: false, origin: null, reason: "the frame is detached" };
  try {
    const origin = await withTimeout(
      frame.evaluate(() => (globalThis as unknown as { origin: string }).origin),
      ms,
      `the evaluation did not finish within ${ms} ms`,
    );
    return { readable: true, origin };
  } catch (e) {
    return { readable: false, origin: null, reason: `the evaluation failed: ${firstLine(e)}` };
  }
}

function urlOrigin(url: string): string | null {
  try {
    const o = new URL(url).origin;
    return o === "null" ? null : o;
  } catch {
    return null;
  }
}

/**
 * Children of `parent` in document order: by the position of their frame
 * element among the `iframe`, `frame`, `object` and `embed` elements of the
 * parent's document. A frame whose element cannot be placed (inside a shadow
 * root, or the parent cannot be read) comes after the others, in the order
 * Playwright lists it.
 */
async function orderedChildren(parent: Frame, ms: number): Promise<Frame[]> {
  const kids = parent.childFrames();
  const positions = await Promise.all(
    kids.map(async (kid) => {
      try {
        const handle = await withTimeout(kid.frameElement(), ms, "frame element timeout");
        try {
          return await withTimeout(
            handle.evaluate((el) =>
              Array.from(el.ownerDocument.querySelectorAll("iframe, frame, object, embed")).indexOf(el),
            ),
            ms,
            "frame position timeout",
          );
        } finally {
          await handle.dispose().catch(() => undefined);
        }
      } catch {
        return -1;
      }
    }),
  );
  return kids
    .map((frame, i) => ({ frame, i, pos: positions[i] ?? -1 }))
    .sort((a, b) => {
      const pa = a.pos < 0 ? Number.MAX_SAFE_INTEGER : a.pos;
      const pb = b.pos < 0 ? Number.MAX_SAFE_INTEGER : b.pos;
      return pa !== pb ? pa - pb : a.i - b.i;
    })
    .map((x) => x.frame);
}

/**
 * Every frame of the page, main frame first, then in document tree order,
 * depth first. `readable`: an evaluation in the frame succeeded within the
 * frame-probe timeout. `crossOrigin`: the frame's origin (its document's
 * `origin`, or its URL's when it cannot be read; an `about:` frame that
 * cannot be read takes its parent's) differs from the main frame's.
 */
export async function collectFrames(page: Page, frameProbeMs: number): Promise<FrameInfo[]> {
  const main = page.mainFrame();
  const out: FrameInfo[] = [];
  const mainProbe = await probeFrame(main, frameProbeMs);
  const mainOrigin = mainProbe.origin ?? urlOrigin(main.url());

  const visit = async (frame: Frame, parent: FrameInfo | null, parentOrigin: string | null): Promise<void> => {
    const probe = frame === main ? mainProbe : await probeFrame(frame, frameProbeMs);
    let origin = probe.origin;
    if (origin === null) {
      origin = frame.url().startsWith("about:") ? parentOrigin : urlOrigin(frame.url());
    }
    const info: FrameInfo = {
      frame,
      parent,
      crossOrigin: frame === main ? false : origin === null || origin === "null" || origin !== mainOrigin,
      readable: probe.readable,
      ...(probe.readable ? {} : { unreadableReason: probe.reason ?? "unknown" }),
    };
    out.push(info);
    for (const child of await orderedChildren(frame, frameProbeMs)) {
      await visit(child, info, origin);
    }
  };
  await visit(main, null, mainOrigin);
  return out;
}

// ---------------------------------------------------------------------------
// The target
// ---------------------------------------------------------------------------

export interface TargetOptions {
  timeouts: EngineTimeouts;
  sanitiser: Sanitiser;
  /**
   * Called on the fresh context before the page is created. The engine
   * passes nothing; the test fixtures use it to refuse any request that
   * would leave the machine.
   */
  prepareContext?: (context: BrowserContext) => Promise<void>;
}

/** What a provider needs from an established target, before options and signal. */
export interface ExaminableTarget {
  targetId: string;
  context: BrowserContext;
  page: Page;
  frames: readonly FrameInfo[];
  cdpFor(frame: Frame): Promise<CDPSession>;
}

export interface TargetHandle {
  /** Ready for the run file: URLs already sanitised. */
  execution: TargetExecution;
  /** Present exactly when the target was established. */
  examinable?: ExaminableTarget;
  /**
   * Why the target was not established (sanitised). The run file has no
   * field for it; the engine returns it in its messages.
   */
  notEstablishedReason?: string;
  /** Network idle was reached within the settle timeout. */
  settled: boolean;
  /** Detach the CDP sessions and close the context. Safe to call twice. */
  close(): Promise<void>;
}

/** Establish one `initial` target in a fresh context (7.4). */
export async function establishTarget(browser: Browser, spec: TargetSpec, options: TargetOptions): Promise<TargetHandle> {
  const { timeouts, sanitiser } = options;
  if (!spec.targetId.endsWith(`/${INITIAL_STATE_ID}`)) throw new Error(`M2 establishes initial targets only: ${spec.targetId}`);

  const context = await browser.newContext({ ...CONTEXT_SETTINGS, viewport: { ...spec.viewport } });
  let closed = false;
  let detach: () => Promise<void> = async () => undefined;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await detach().catch(() => undefined);
    await context.close().catch(() => undefined);
  };

  try {
    if (options.prepareContext !== undefined) await options.prepareContext(context);
    const page = await context.newPage();

    let failure: string | undefined;
    try {
      const response = await page.goto(spec.url, { waitUntil: "load", timeout: timeouts.navigation });
      if (response === null) failure = "navigation gave no main response";
      else if (response.status() >= 400) failure = `the main response has status ${response.status()}`;
    } catch (e) {
      failure = `navigation failed: ${firstLine(e)}`;
    }

    let settled = false;
    if (failure === undefined) {
      settled = await page
        .waitForLoadState("networkidle", { timeout: timeouts.settle })
        .then(() => true)
        .catch(() => false);
    }

    const applied = await readViewport(page, spec.viewport, timeouts.frameProbe);
    const reached = page.url();
    const execution: TargetExecution = {
      targetId: spec.targetId,
      requestedUrl: sanitiser.url(spec.url).value,
      effectiveUrl: sanitiser.url(reached.length > 0 ? reached : "about:blank").value,
      viewport: { requested: { ...spec.viewport }, applied },
      sessionLoaded: false,
      prerequisitesMet: [],
      steps: [],
      expect: { declared: false, metBeforeSteps: null, met: null },
      established: failure === undefined,
    };

    if (failure !== undefined) {
      return { execution, notEstablishedReason: sanitiser.text(failure).value, settled, close };
    }

    const sessions = createCdpSessions(context, page);
    detach = sessions.detachAll;
    const frames = await collectFrames(page, timeouts.frameProbe);
    return {
      execution,
      examinable: { targetId: spec.targetId, context, page, frames, cdpFor: sessions.cdpFor },
      settled,
      close,
    };
  } catch (e) {
    await close();
    throw e;
  }
}

/** The viewport as the page reports it; the requested size when the page cannot be read. */
async function readViewport(page: Page, requested: Size, ms: number): Promise<Size> {
  try {
    const size = await withTimeout(
      page.evaluate(() => {
        const w = globalThis as unknown as { innerWidth: number; innerHeight: number };
        return { width: w.innerWidth, height: w.innerHeight };
      }),
      ms,
      "viewport read timeout",
    );
    if (Number.isInteger(size.width) && Number.isInteger(size.height) && size.width > 0 && size.height > 0) return size;
  } catch {
    // fall through
  }
  return page.viewportSize() ?? { ...requested };
}
