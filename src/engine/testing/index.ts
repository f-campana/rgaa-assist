/**
 * Test fixtures for check builders and the corpus harness.
 *
 * They serve a set of files locally on two origins (`serveFixture`) and
 * establish a target on the served page through the engine's own code path:
 * the same browser launch settings, a fresh context with the engine's
 * settings, `load` then network idle, the same frame list and CDP sessions,
 * the same provider runner, sanitiser and observation validation.
 *
 * One difference, for safety: the fixture context refuses every request
 * whose origin is not one of the two fixture origins (`blockedRequests`
 * lists them), so a test never reaches the network.
 *
 * Usage (one browser per test file):
 *
 * ```ts
 * import { afterAll, beforeAll, expect, it } from "vitest";
 * import type { Browser } from "playwright";
 * import { launchBrowser } from "../../src/engine/index.ts";
 * import { observe, withTarget } from "../../src/engine/testing/index.ts";
 *
 * let browser: Browser;
 * beforeAll(async () => { browser = await launchBrowser(); });
 * afterAll(async () => { await browser.close(); });
 *
 * it("finds the fault", async () => {
 *   const [obs] = await observe(myProvider, { "index.html": "<!doctype html><title>x</title>" }, { browser });
 *   expect(obs?.outcome).toBe("fault");
 * });
 *
 * it("reads the frames", async () => {
 *   await withTarget({ "index.html": `<iframe src="__CROSS_ORIGIN__/f.html"></iframe>`, "f.html": "<p>f</p>" },
 *     async (ctx) => { expect(ctx.frames).toHaveLength(2); }, { browser });
 * });
 *
 * // A corpus case folder: case.json, then its files; the page is `files[0]` of case.json.
 * const outcome = await examineFixture([myProvider], "corpus/working/8.5.1/8.5.1-some-case", { browser });
 * ```
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, BrowserContext } from "playwright";
import type { CheckContext, CheckProvider } from "../../checks/types.ts";
import type { CheckId, Observation, Size, TargetExecution } from "../../schema/index.ts";
import { effectiveTimeouts, launchBrowser } from "../browser.ts";
import type { EngineTimeouts } from "../browser.ts";
import { effectiveOptions, validateProviders } from "../run-checks.ts";
import type { RunCheckOptions } from "../run-checks.ts";
import { examineTarget } from "../run.ts";
import { DEFAULT_VIEWPORT } from "../sample.ts";
import type { TargetSpec } from "../sample.ts";
import { createSanitiser } from "../sanitise.ts";
import { establishTarget } from "../target.ts";
import type { ExaminableTarget } from "../target.ts";
import { serveFixture } from "./server.ts";
import type { FixtureServer, FixtureSource } from "./server.ts";

export { CONTENT_TYPES, CROSS_ORIGIN_PLACEHOLDER, readFixtureFolder, refusedPort, serveFixture } from "./server.ts";
export type { FixtureFiles, FixtureServer, FixtureSource } from "./server.ts";

export interface FixtureOptions {
  /** A browser from `launchBrowser()`, shared by the test file. When absent, one is launched and closed per call. */
  browser?: Browser;
  /**
   * The page to load, relative to the files. Default: `files[0]` of a
   * `case.json` among the files, otherwise `index.html`.
   */
  page?: string;
  /** Default `fixture/initial`. */
  targetId?: string;
  /** Default 1280 × 800, as the engine. */
  viewport?: Size;
  /** Default: the engine's defaults. */
  timeouts?: Partial<EngineTimeouts>;
  /** Default none: every query value is masked. */
  safeQueryParams?: readonly string[];
  /** Options by check id, overriding the definitions' defaults. */
  checkOptions?: RunCheckOptions;
}

/** The page a fixture loads: `options.page`, else `case.json`'s first file, else `index.html`. */
export function fixturePage(source: FixtureSource, page?: string): string {
  if (page !== undefined) return page;
  let caseJson: string | undefined;
  if (typeof source === "string") {
    const p = join(source, "case.json");
    if (existsSync(p)) caseJson = readFileSync(p, "utf8");
  } else {
    const c = source["case.json"];
    if (c !== undefined) caseJson = typeof c === "string" ? c : Buffer.from(c).toString("utf8");
  }
  if (caseJson !== undefined) {
    const files = (JSON.parse(caseJson) as { files?: unknown }).files;
    if (Array.isArray(files) && typeof files[0] === "string") return files[0];
    throw new Error("case.json has no files[0]");
  }
  return "index.html";
}

/** Refuse, in this context, every request to an origin other than the fixture's two. */
async function confineTo(server: FixtureServer, blocked: string[]): Promise<(context: BrowserContext) => Promise<void>> {
  const allowed = new Set([server.mainOrigin, server.crossOrigin]);
  return async (context) => {
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      let origin = "";
      try {
        origin = new URL(url).origin;
      } catch {
        // not a URL with an origin
      }
      if (allowed.has(origin)) await route.continue();
      else {
        blocked.push(url);
        await route.abort("blockedbyclient");
      }
    });
  };
}

async function withFixture<T>(
  source: FixtureSource,
  options: FixtureOptions,
  fn: (env: { browser: Browser; server: FixtureServer; spec: TargetSpec; blocked: string[]; prepareContext: (c: BrowserContext) => Promise<void> }) => Promise<T>,
): Promise<T> {
  const page = fixturePage(source, options.page);
  const server = await serveFixture(source);
  const ownBrowser = options.browser === undefined;
  const browser = options.browser ?? (await launchBrowser());
  const blocked: string[] = [];
  try {
    const spec: TargetSpec = {
      targetId: options.targetId ?? "fixture/initial",
      pageId: (options.targetId ?? "fixture/initial").split("/")[0] ?? "fixture",
      url: server.url(page),
      viewport: options.viewport ?? DEFAULT_VIEWPORT,
    };
    return await fn({ browser, server, spec, blocked, prepareContext: await confineTo(server, blocked) });
  } finally {
    if (ownBrowser) await browser.close().catch(() => undefined);
    await server.close();
  }
}

/** Extra things `withTarget` hands to its callback beside the check context. */
export interface FixtureTargetInfo {
  server: FixtureServer;
  execution: TargetExecution;
  target: ExaminableTarget;
  /** Requests refused because they would have left the fixture origins. */
  blockedRequests: readonly string[];
}

/**
 * Establish a target on the served page through the engine's code path, call
 * `fn` with the `CheckContext` a provider would get (options from
 * `options.checkOptions`, a signal that is never aborted), then clean up.
 * Throws when the target is not established.
 */
export async function withTarget<T>(
  source: FixtureSource,
  fn: (ctx: CheckContext, info: FixtureTargetInfo) => Promise<T>,
  options: FixtureOptions = {},
): Promise<T> {
  return withFixture(source, options, async ({ browser, server, spec, blocked, prepareContext }) => {
    const handle = await establishTarget(browser, spec, {
      timeouts: effectiveTimeouts(options.timeouts),
      sanitiser: createSanitiser(options.safeQueryParams ?? []),
      prepareContext,
    });
    try {
      const target = handle.examinable;
      if (target === undefined) throw new Error(`fixture target not established: ${handle.notEstablishedReason ?? "unknown"}`);
      const ctx: CheckContext = {
        targetId: target.targetId,
        page: target.page,
        frames: target.frames,
        cdpFor: target.cdpFor,
        options: new Map<CheckId, Record<string, unknown>>(Object.entries(options.checkOptions ?? {})),
        signal: new AbortController().signal,
      };
      return await fn(ctx, { server, execution: handle.execution, target, blockedRequests: blocked });
    } finally {
      await handle.close();
    }
  });
}

/** What `examineFixture` gives: the target record and the observations, as the engine would write them. */
export interface FixtureOutcome {
  execution: TargetExecution;
  observations: Observation[];
  /** Effective options by check id, as the manifest would record them. */
  checkOptions: Record<string, Record<string, unknown>>;
  blockedRequests: readonly string[];
}

/**
 * Run providers on the served page exactly as the engine does (in the order
 * given, with the provider timeout), and return the sanitised, validated
 * observations with the target record. Throws when the target is not
 * established. For the corpus harness, which then derives findings.
 */
export async function examineFixture(
  providers: readonly CheckProvider[],
  source: FixtureSource,
  options: FixtureOptions = {},
): Promise<FixtureOutcome> {
  validateProviders(providers);
  return withFixture(source, options, async ({ browser, spec, blocked, prepareContext }) => {
    const outcome = await examineTarget(browser, spec, {
      providers,
      timeouts: effectiveTimeouts(options.timeouts),
      sanitiser: createSanitiser(options.safeQueryParams ?? []),
      prepareContext,
      ...(options.checkOptions === undefined ? {} : { runOptions: options.checkOptions }),
    });
    if (!outcome.execution.established) {
      throw new Error(`fixture target not established: ${outcome.notEstablishedReason ?? "unknown"}`);
    }
    const checkOptions = Object.fromEntries(
      providers.flatMap((p) => p.checks.map((d) => [d.id, effectiveOptions(d, options.checkOptions)] as const)),
    );
    return { execution: outcome.execution, observations: outcome.observations, checkOptions, blockedRequests: [...blocked] };
  });
}

/** Run one provider on the served page exactly as the engine does; its sanitised, validated observations. */
export async function observe(provider: CheckProvider, source: FixtureSource, options: FixtureOptions = {}): Promise<Observation[]> {
  return (await examineFixture([provider], source, options)).observations;
}
