/**
 * The engine (spec 5): reads the sample, establishes each target in the
 * browser, runs the check providers it is given, hands the observations to
 * the ruleset and writes the run file. M2: one page per target, initial
 * state, no session, no model.
 *
 * Test fixtures for check builders are in `./testing/index.ts`.
 */
export { runAudit, examineTarget, effectiveLevels } from "./run.ts";
export type { RunAuditInput, RunAuditResult, TargetOutcome } from "./run.ts";
export { CONTEXT_SETTINGS, DEFAULT_TIMEOUTS, LAUNCH_ARGS, effectiveTimeouts, launchBrowser } from "./browser.ts";
export type { EngineTimeouts } from "./browser.ts";
export { DEFAULT_VIEWPORT, SUPPORTED_RULESETS, parseSample, readSample, targetsOf } from "./sample.ts";
export type { SampleReadResult, TargetSpec } from "./sample.ts";
export { MASK, SNIPPET_MAX_LENGTH, TOKEN_PATTERNS, TRUNCATION_MARK, createSanitiser, maskTokens } from "./sanitise.ts";
export type { Sanitised, Sanitiser } from "./sanitise.ts";
export { collectFrames, createCdpSessions, establishTarget, withTimeout } from "./target.ts";
export type { ExaminableTarget, TargetHandle, TargetOptions } from "./target.ts";
export {
  EngineBugError,
  effectiveOptions,
  evidenceId,
  observationId,
  runProvider,
  runProviders,
  toObservation,
  validateProviders,
} from "./run-checks.ts";
export type { RunCheckOptions } from "./run-checks.ts";
export {
  buildStatements,
  compareStrings,
  installedVersion,
  osDescription,
  sanitiseSample,
  sortFindings,
  sortObservations,
  sortRunFile,
  toolVersion,
  writeRunFile,
} from "./run-file.ts";
