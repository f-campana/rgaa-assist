/**
 * Q70, design 4.10: v1 takes no screenshots. This wrapper fails a run that
 * calls `page.screenshot`, `locator.screenshot`, `elementHandle.screenshot`,
 * or sends CDP `Page.captureScreenshot` or `Page.startScreencast`.
 *
 * It wraps `chromium.launch`, which is what the engine's `launchBrowser`
 * calls, so it covers `runAudit` and `runCli` run in this process. A child
 * process is not covered: it is checked by the image search only.
 * Every harness run installs it.
 */
import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";

const FORBIDDEN_CDP = new Set(["Page.captureScreenshot", "Page.startScreencast"]);

const calls: string[] = [];
let installed = false;
let original: typeof chromium.launch | undefined;

function refuse(what: string): never {
  calls.push(what);
  throw new Error(`privacy harness: ${what} is forbidden (Q70, no screenshots in v1)`);
}

// Prototypes are patched once, from the first live object of each kind.
const patched = new Set<object>();
function patchProto(obj: object, method: string, label: string): void {
  const proto = Object.getPrototypeOf(obj) as Record<string, unknown> | null;
  if (proto === null || patched.has(proto) || typeof proto[method] !== "function") return;
  patched.add(proto);
  proto[method] = function guarded(): never {
    return refuse(label);
  };
}

type CdpSession = { send: (method: string, ...rest: unknown[]) => Promise<unknown> };
type WithCdp = { newCDPSession: (...a: unknown[]) => Promise<CdpSession> };

function guardContext(context: BrowserContext): void {
  const ctx = context as unknown as WithCdp;
  const orig = ctx.newCDPSession.bind(context);
  ctx.newCDPSession = async (...a) => {
    const session = await orig(...a);
    const send = session.send.bind(session);
    session.send = (method, ...rest) => {
      if (FORBIDDEN_CDP.has(method)) {
        calls.push(`CDP ${method}`);
        return Promise.reject(new Error(`privacy harness: CDP ${method} is forbidden (Q70, no screenshots in v1)`));
      }
      return send(method, ...rest);
    };
    return session;
  };
  const seen = (page: Page): void => {
    patchProto(page, "screenshot", "page.screenshot");
    patchProto(page.locator("html"), "screenshot", "locator.screenshot");
    page
      .evaluateHandle("document.documentElement")
      .then(async (h) => {
        const el = h.asElement();
        if (el !== null) patchProto(el, "screenshot", "elementHandle.screenshot");
        await h.dispose().catch(() => undefined);
      })
      .catch(() => undefined);
  };
  for (const p of context.pages()) seen(p);
  context.on("page", seen);
}

export function installCaptureGuard(): void {
  if (installed) return;
  installed = true;
  original = chromium.launch.bind(chromium);
  const orig = original;
  (chromium as unknown as { launch: typeof chromium.launch }).launch = async (...args) => {
    const browser = await orig(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...a) => {
      const c = await newContext(...a);
      guardContext(c);
      return c;
    };
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async (...a) => {
      const p = await newPage(...a);
      guardContext(p.context());
      return p;
    };
    return browser;
  };
}

export function uninstallCaptureGuard(): void {
  if (!installed || original === undefined) return;
  (chromium as unknown as { launch: typeof chromium.launch }).launch = original;
  installed = false;
}

/** Take the calls seen so far and clear the list. */
export function takeCaptureCalls(): string[] {
  return calls.splice(0, calls.length);
}
