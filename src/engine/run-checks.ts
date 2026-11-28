/**
 * Running check providers on one established target and turning their
 * results into observations (spec 8.3, 8.5; `src/checks/types.ts`).
 *
 * The engine imports no check: the caller gives the providers, custom ones
 * first and the axe provider last. Providers run one at a time, in that
 * order, each aborted through `ctx.signal` after the provider timeout.
 */
import { ObservationSchema } from "../schema/index.ts";
import type { CheckId, Evidence, Observation } from "../schema/index.ts";
import type { CheckContext, CheckDefinition, CheckProvider, CheckRunResult, RawEvidence } from "../checks/types.ts";
import type { Sanitiser } from "./sanitise.ts";
import type { ExaminableTarget } from "./target.ts";
import { classifyPageOrBrowser, zodIssueText } from "./error-class.ts";

/** Options given for a run, by check id. They override the definition's defaults key by key. */
export type RunCheckOptions = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/** A programming error in a provider or in the engine's inputs: the run must fail loudly. */
export class EngineBugError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineBugError";
  }
}

/**
 * Check the providers before anything runs: every check id declared once
 * across all providers and, when `registry` is given, present in it.
 */
export function validateProviders(providers: readonly CheckProvider[], registry?: ReadonlySet<string>): void {
  const seen = new Map<string, string>();
  for (const p of providers) {
    for (const def of p.checks) {
      const other = seen.get(def.id);
      if (other !== undefined) throw new EngineBugError(`check ${def.id} is declared by providers ${other} and ${p.name}`);
      seen.set(def.id, p.name);
      if (registry !== undefined && !registry.has(def.id)) {
        throw new EngineBugError(`check ${def.id} of provider ${p.name} is not in the check registry`);
      }
      if (def.version.trim().length === 0) throw new EngineBugError(`check ${def.id} has an empty version`);
    }
  }
}

/** The effective options of one check: its defaults, overridden key by key by the run's options. */
export function effectiveOptions(def: CheckDefinition, runOptions: RunCheckOptions = {}): Record<string, unknown> {
  return { ...def.defaultOptions, ...(runOptions[def.id] ?? {}) };
}

/** `e001`, `e002`, … so that sorting by id keeps the order returned. */
export function evidenceId(index: number): string {
  return `e${String(index + 1).padStart(3, "0")}`;
}

/** `<targetId>:<checkId>` */
export function observationId(targetId: string, checkId: string): string {
  return `${targetId}:${checkId}`;
}

function nonEmpty(message: string): string {
  return message.trim().length > 0 ? message : "(no message)";
}

function errorObservation(
  base: Pick<Observation, "id" | "checkId" | "checkVersion" | "options" | "targetId">,
  kind: "check_error" | "scope_unreadable",
  message: string,
  sanitiser: Sanitiser,
): Observation {
  return {
    ...base,
    outcome: "error",
    evidence: [],
    fingerprint: `${base.checkId}:error`,
    error: { kind, message: nonEmpty(sanitiser.text(message).value) },
  };
}

function sanitiseEvidence(raw: RawEvidence, index: number, sanitiser: Sanitiser): Evidence {
  // Keep every key the check gave, so that an unexpected one fails validation
  // instead of being dropped silently.
  const out: Record<string, unknown> = { ...raw, id: evidenceId(index) };
  let redactions = 0;
  if (typeof raw.locator === "string") {
    const r = sanitiser.text(raw.locator);
    out["locator"] = r.value;
    redactions += r.redactions;
  }
  if (typeof raw.snippet === "string") {
    const r = sanitiser.snippet(raw.snippet);
    out["snippet"] = r.value;
    redactions += r.redactions;
  }
  if (typeof raw.note === "string") {
    const r = sanitiser.text(raw.note);
    out["note"] = r.value;
    redactions += r.redactions;
  }
  out["redactions"] = redactions;
  return out as Evidence;
}

/**
 * Turn one check's result into a validated observation. A result that does
 * not validate becomes `error` / `check_error` with the validation message,
 * so one bad check never sinks the run.
 */
export function toObservation(
  targetId: string,
  def: CheckDefinition,
  options: Record<string, unknown>,
  result: CheckRunResult,
  sanitiser: Sanitiser,
): Observation {
  const base = {
    id: observationId(targetId, def.id),
    checkId: def.id,
    checkVersion: def.version,
    options,
    targetId,
  };
  if (result.outcome === "error") {
    const kind = result.kind === "scope_unreadable" ? "scope_unreadable" : "check_error";
    return errorObservation(base, kind, typeof result.message === "string" ? result.message : String(result.message), sanitiser);
  }
  let candidate: unknown;
  try {
    const evidence = Array.isArray(result.evidence) ? result.evidence.map((e, i) => sanitiseEvidence(e, i, sanitiser)) : result.evidence;
    candidate = {
      ...base,
      outcome: result.outcome,
      evidence,
      fingerprint: typeof result.fingerprint === "string" ? sanitiser.text(result.fingerprint).value : result.fingerprint,
    };
  } catch {
    return errorObservation(base, "check_error", "invalid result: the evidence could not be read", sanitiser);
  }
  const parsed = ObservationSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues.map((i) => zodIssueText(i)).join("; ");
  return errorObservation(base, "check_error", `invalid observation: ${issues}`, sanitiser);
}

class ProviderTimeout extends Error {}

/**
 * Run one provider on one target. Every declared check gets exactly one
 * observation. A provider that throws or times out gives `check_error` for
 * each of its checks; a declared check with no result gives `check_error`
 * "no result"; a result for an undeclared check id is a bug (throws).
 */
export async function runProvider(
  target: ExaminableTarget,
  provider: CheckProvider,
  input: { runOptions?: RunCheckOptions; timeoutMs: number; sanitiser: Sanitiser },
): Promise<Observation[]> {
  const { sanitiser, timeoutMs } = input;
  const options = new Map<CheckId, Record<string, unknown>>(
    provider.checks.map((def) => [def.id, effectiveOptions(def, input.runOptions)]),
  );
  const controller = new AbortController();
  const ctx: CheckContext = {
    targetId: target.targetId,
    page: target.page,
    frames: target.frames,
    cdpFor: target.cdpFor,
    options,
    signal: controller.signal,
  };

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new ProviderTimeout(`provider ${provider.name} timed out after ${timeoutMs} ms`));
      reject(new ProviderTimeout(`provider ${provider.name} timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });

  let results: ReadonlyMap<CheckId, CheckRunResult> | undefined;
  let failure: string | undefined;
  try {
    const running = Promise.resolve().then(() => provider.run(ctx));
    running.catch(() => undefined); // a late rejection after a timeout is not unhandled
    results = await Promise.race([running, timeout]);
  } catch (e) {
    failure = e instanceof ProviderTimeout ? e.message : `provider ${provider.name} threw: ${classifyPageOrBrowser(e).message}`;
  } finally {
    clearTimeout(timer);
    if (!controller.signal.aborted) controller.abort(new Error("provider finished"));
  }

  if (failure === undefined && !(results instanceof Map)) {
    failure = `provider ${provider.name} returned no map of results`;
  }

  const declared = new Set(provider.checks.map((d) => d.id));
  if (failure === undefined && results !== undefined) {
    for (const id of results.keys()) {
      if (!declared.has(id)) throw new EngineBugError(`provider ${provider.name} returned a result for undeclared check ${id}`);
    }
  }

  return provider.checks.map((def) => {
    const opts = options.get(def.id) ?? {};
    if (failure !== undefined) {
      return errorObservation(
        { id: observationId(target.targetId, def.id), checkId: def.id, checkVersion: def.version, options: opts, targetId: target.targetId },
        "check_error",
        failure,
        sanitiser,
      );
    }
    const result = results?.get(def.id);
    if (result === undefined) {
      return errorObservation(
        { id: observationId(target.targetId, def.id), checkId: def.id, checkVersion: def.version, options: opts, targetId: target.targetId },
        "check_error",
        "no result",
        sanitiser,
      );
    }
    return toObservation(target.targetId, def, opts, result, sanitiser);
  });
}

/** Run every provider, in the order given, on one established target. */
export async function runProviders(
  target: ExaminableTarget,
  providers: readonly CheckProvider[],
  input: { runOptions?: RunCheckOptions; timeoutMs: number; sanitiser: Sanitiser },
): Promise<Observation[]> {
  const out: Observation[] = [];
  for (const provider of providers) out.push(...(await runProvider(target, provider, input)));
  return out;
}
