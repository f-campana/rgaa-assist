/**
 * The browser the engine uses (spec 8.1) and its fixed settings.
 *
 * Chromium through Playwright 1.64.1, headless. One browser per run, a fresh
 * `BrowserContext` per target (7.4), never a storage state.
 *
 * `--site-per-process` is passed at launch. Without it, the headless Chromium
 * that Playwright launches keeps cross-site frames in their parent's process,
 * so they have no CDP target of their own; with it, cross-site frames are
 * out-of-process as in a desktop Chrome, and `cdpFor` gives them their own
 * session. It downloads nothing and changes no page behaviour a visitor
 * would see.
 */
import { chromium } from "playwright";
import type { Browser, BrowserContextOptions } from "playwright";

/** Default timeouts in milliseconds (overridable per run, recorded in the manifest). */
export interface EngineTimeouts {
  /** `page.goto` until `load`. */
  navigation: number;
  /** Waiting for network idle after `load`; not reaching it is not a failure. */
  settle: number;
  /** One evaluation in one frame, to tell whether it can be read. */
  frameProbe: number;
  /** One provider on one target; the provider is aborted after it. */
  provider: number;
}

export const DEFAULT_TIMEOUTS: Readonly<EngineTimeouts> = {
  navigation: 30_000,
  settle: 5_000,
  frameProbe: 2_000,
  provider: 60_000,
};

export function effectiveTimeouts(overrides: Partial<EngineTimeouts> = {}): EngineTimeouts {
  const t = { ...DEFAULT_TIMEOUTS };
  for (const key of Object.keys(t) as (keyof EngineTimeouts)[]) {
    const v = overrides[key];
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 0) throw new Error(`timeout ${key} must be a non-negative integer, got ${String(v)}`);
    t[key] = v;
  }
  return t;
}

/** Context settings used for every target, apart from the viewport (which is per target). */
export const CONTEXT_SETTINGS = {
  reducedMotion: "reduce",
  locale: "fr-FR",
  timezoneId: "Europe/Paris",
  /** Downloads are out of scope (Q28). */
  acceptDownloads: false,
} as const satisfies BrowserContextOptions;

/** Arguments passed to Chromium at launch. */
export const LAUNCH_ARGS: readonly string[] = ["--site-per-process"];

/** Launch the engine's browser. The caller closes it. */
export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true, args: [...LAUNCH_ARGS] });
}
