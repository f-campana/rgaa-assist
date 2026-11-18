/**
 * Helpers for the axe adapter tests. Offline: pages come from `page.setContent`
 * or from `context.route` on made-up hosts (`*.test`). No real site is loaded.
 */
import type { BrowserContext, Frame, Page } from "playwright";
import { ObservationSchema } from "../../../src/schema/index.ts";
import type { CheckId, Observation } from "../../../src/schema/index.ts";
import { axeChecks } from "../../../src/checks/axe/index.ts";
import type { CheckContext, CheckProvider, CheckRunResult, FrameInfo } from "../../../src/checks/types.ts";

export type Site = Record<string, { body: string; headers?: Record<string, string>; status?: number }>;

/** Answers every request from `site` (keyed by full URL); anything else is a 404. Never reaches a network. */
export async function serve(context: BrowserContext, site: Site): Promise<void> {
  await context.route("**/*", async (route) => {
    const hit = site[route.request().url()];
    if (!hit) {
      await route.fulfill({ status: 404, contentType: "text/html", body: "<!doctype html><title>not found</title>" });
      return;
    }
    await route.fulfill({
      status: hit.status ?? 200,
      contentType: "text/html; charset=utf-8",
      headers: hit.headers ?? {},
      body: hit.body,
    });
  });
}

export function html(body: string, head = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page</title>${head}</head><body>${body}</body></html>`;
}

const originOf = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
};

/** What the engine gives a provider, minus the engine: every frame of the page, main first, depth first. */
export function frameInfos(page: Page): FrameInfo[] {
  const infos = new Map<Frame, FrameInfo>();
  const walk = (frame: Frame, parent: FrameInfo | null): void => {
    const info: FrameInfo = {
      frame,
      parent,
      crossOrigin: parent !== null && originOf(frame.url()) !== originOf(page.mainFrame().url()),
      readable: true,
    };
    infos.set(frame, info);
    for (const child of frame.childFrames()) walk(child, info);
  };
  walk(page.mainFrame(), null);
  return [...infos.values()];
}

export function contextFor(page: Page, options: Record<string, unknown> = {}, signal: AbortSignal = new AbortController().signal): CheckContext {
  return {
    targetId: "home/initial",
    page,
    frames: frameInfos(page),
    cdpFor: () => Promise.reject(new Error("the axe adapter does not use CDP")),
    options: new Map(axeChecks.map((c) => [c.id, { ...c.defaultOptions, ...options }])),
    signal,
  };
}

/** What the engine does to a result (ids, redaction counts) so it can be validated as an observation. */
export function toObservation(provider: CheckProvider, checkId: CheckId, result: CheckRunResult): Observation {
  const def = provider.checks.find((c) => c.id === checkId);
  if (!def) throw new Error(`undeclared check ${checkId}`);
  const base = {
    id: `obs-${checkId.replace("/", "-")}`,
    checkId,
    checkVersion: def.version,
    options: { ...def.defaultOptions },
    targetId: "home/initial",
  };
  if (result.outcome === "error") {
    return ObservationSchema.parse({
      ...base,
      outcome: "error",
      evidence: [],
      fingerprint: `${checkId}:error`,
      error: { kind: result.kind, message: result.message },
    });
  }
  return ObservationSchema.parse({
    ...base,
    outcome: result.outcome,
    fingerprint: result.fingerprint,
    evidence: result.evidence
      .map((e, i) => ({ ...e, id: `e${String(i + 1).padStart(3, "0")}`, redactions: 0 }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}

export function get(results: ReadonlyMap<CheckId, CheckRunResult>, rule: string): CheckRunResult {
  const r = results.get(`axe/${rule}`);
  if (!r) throw new Error(`no result for axe/${rule}`);
  return r;
}
