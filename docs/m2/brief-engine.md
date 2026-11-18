# M2 brief: engine, sanitiser, run file (core builder)

You are a core builder on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You build the M2 engine: one page, initial state, no session.

## Read first

1. `docs/decisions.md` (it wins over everything), then `docs/spec.md` sections 2, 5, 7.1, 7.4, 8.1 to 8.5, 8.7, 8.8, 11.1.
2. `docs/m2-kickoff.md` (the milestone brief) and `docs/m2-status.md`.
3. The frozen contract: `src/schema/` (above all `run.ts`, `sample.ts`, `statements.ts`, `canonical.ts`, `evaluation.ts`) and `src/rulesets/contract.ts`, `src/rulesets/shared/`, `src/rulesets/rgaa-4.1.2/index.ts`.
4. The check interface: `src/checks/types.ts`. You implement the context it describes. You do not change it; if it cannot work as written, stop and say why in your report.

## You own

- `src/engine/` (new).
- `src/rulesets/shared/check-sample.ts` and its test (implement the stub; see below).
- `tests/engine/` (new).

Touch nothing else. Do not edit `src/schema/`, `src/rulesets/contract.ts`, `src/checks/`, any coverage entry or `checks.json`. If a schema or contract change looks necessary, stop and report it.

## What to build

### 1. Sample reading (`src/engine/sample.ts`)

- Read a sample file, validate it against `SampleFileSchema`, and compute the sha256 of the file's bytes (for the manifest).
- **M2 accepts only what M2 supports.** Refuse as invalid input, with a message that names the field and says "supported from M3": a `session`, any page with `authenticated: true`, any page with `states`, any page `expect`. An empty sample is invalid input already (schema).
- Every page gives one target, `<pageId>/initial` (`INITIAL_STATE_ID`).

### 2. Establishing a target (`src/engine/target.ts`) — spec 7.4, 8.1

- Chromium through Playwright 1.64.1 (installed, pinned; the browser is in the Playwright cache). One browser per run, **a fresh `BrowserContext` per target**, never a storage state. Context options: the sample's viewport (schema default if absent), `reducedMotion: "reduce"`, locale `fr-FR`, timezone `Europe/Paris`. Record what you used.
- Load the page: `goto` with `waitUntil: "load"` and the navigation timeout, then wait for network idle up to the settle timeout without failing when it is not reached.
- **Established** when navigation succeeded and the main response status is below 400. Otherwise not established; the run continues with other targets. Log why (the run file has no field for it; your report should say so as a gap).
- `TargetExecution` for an initial target: `requestedUrl` and `effectiveUrl` sanitised, `viewport.requested` and `applied` (read the applied size from the page), `sessionLoaded: false`, `prerequisitesMet: []`, `steps: []`, `expect: { declared: false, metBeforeSteps: null, met: null }`.
- **Frames.** Build `FrameInfo[]` (main frame first, then document tree order, depth first) from `page.frames()` and `frame.parentFrame()`. `readable`: an evaluation in the frame succeeded within a short timeout; otherwise `false` with the reason. `crossOrigin`: the frame's origin differs from the main frame's.
- **`cdpFor(frame)`**: `context.newCDPSession(frame)` for an out-of-process frame; for the main frame and same-process frames, a session on the page. Cache sessions; detach them when the target is done.
- **Default timeouts** (milliseconds, overridable per run, recorded in the manifest): navigation 30000, settle 5000, frame probe 2000, provider 60000.

### 3. Running checks (`src/engine/run-checks.ts`)

- The engine **takes the list of `CheckProvider`s as an argument**. It imports no check module. (A later builder wires the real providers into the CLI.)
- Run providers one at a time, in the order given; the caller puts custom providers first and the axe provider last (`custom/8-2-id-duplicate` must read the DOM before any other check touches it). Abort a provider on its timeout through `ctx.signal`.
- Effective options per check: the definition's `defaultOptions`, overridden by run options if given.
- Turn each result into an `Observation`:
  - `id`: `<targetId>:<checkId>`; evidence ids `e001`, `e002`, … in the order returned (so sorting by id keeps that order);
  - every string of the evidence passed through the sanitiser, with `redactions` set on each item (0 included);
  - `CheckFailure` becomes `outcome: "error"` with `error: { kind, message }`, the message sanitised, `evidence: []`, fingerprint `<checkId>:error`;
  - a provider that throws gives `check_error` for each of its checks; a declared check with no result gives `check_error` "no result"; a result for an undeclared id is a bug (throw);
  - validate each observation with `ObservationSchema`. An invalid one becomes `error` / `check_error` with the validation message, so one bad check never sinks the run.
- **Nothing runs on a target that was not established** (7.4): no providers, no observations.

### 4. Minimal sanitiser (`src/engine/sanitise.ts`) — spec 8.7, M2 part

One sanitiser runs on everything before it is written. Every function returns the cleaned value and the number of redactions.
- **URLs** (sample copy: `pages[].url`, `documents[].url`, `navigate` steps; target `requestedUrl`, `effectiveUrl`; URLs inside error messages, snippets and notes): query-string values masked unless the parameter is in the sample's `safeQueryParams`; fragments masked. Keep parameter names. Choose one mask string and use it everywhere.
- **Snippets**: drop form-field values (the `value` attribute of `input` and `option`, the content of `textarea`); mask token-shaped strings (JWTs, long hex, long base64 or base64url runs, strings that look like API keys; document your patterns and test them with planted values); cap length (choose a cap, record it, mark truncation).
- **Notes, locators returned by checks, error messages**: token masking and URL masking. Locators and step values written by the sample author are stored as written (8.7).
- Screenshots are off in M2. Cookies, headers and storage are never read or recorded.
- Tests with planted values for every rule. The full channel tests are the M3 gate; do not attempt them.

### 5. Sample check (`src/rulesets/shared/check-sample.ts`)

The run file needs `sampleWarnings`, and an empty list would claim the sample was checked. Implement the stub exactly as its doc comment specifies (spec 7.5), with tests. It is a pure function. (Orchestrator's decision: needed for a truthful run file.)

### 6. Derivation, reduction, run file (`src/engine/run.ts`, `src/engine/run-file.ts`)

- Load the plug-in with `loadRgaa412()`. For each entry compute `effectiveLevel` (`src/rulesets/shared/effective-level.ts`): evaluation summary `null` (none exists yet), the ruleset's approval log, `checkVersions` from the providers given. Every entry is `enabled: none`, so every level is `none`.
- `deriveFindings` per target with every entry at its effective level; `reduce` over the sample. A rejection or reduction error is a bug in the engine: fail loudly.
- **Expected outcome on real pages:** every finding is `needs_review` (`not_enabled` or `no_check`) or `not_tested` (`missing_observation` for links to checks not built yet, `check_error`, `target_not_established`). That is correct, not a defect.
- Statements (spec 2.3, `StatementsSchema`): fill every field from what actually happened. No rate, no score, no count shown against a total.
- Manifest (8.8): tool version (`package.json` version plus the git commit if available), ruleset id, version, source commit (`OFFICIAL_SOURCE`), coverage-map hash, evaluation-summary hash `null`, approval-log hash; axe-core, Playwright and browser versions (read them at run time: `browser.version()`, the installed package versions); OS; locale; effective timeouts; effective check options by check id; sample-file hash; start and end time; `model: null`.
- The sample copy in the run file is the sanitised sample.
- Sort every array as `run.ts` documents. Validate the whole file with `RunFileSchema` before writing it. Write `<outDir>/run.json` (pretty-printed, stable key order is not required beyond what `run.ts` asks).
- Entry point, for the CLI builder: `runAudit({ samplePath, outDir, providers, timeouts? }): Promise<{ exitCode: 0 | 2 | 3; runFilePath?: string; messages: string[] }>`, with the exit codes of 11.1 (0 completed, 2 invalid input, 3 one or more targets not established). Export it and the pieces from `src/engine/index.ts`.

### 7. Test fixtures for check builders (`src/engine/testing/`)

Three custom-check builders and the corpus harness will use this after you merge, so make it solid and documented.
- Serve a set of files **locally** on two origins: a main origin and a second, cross-site origin (for example `127.0.0.1` and `localhost` on two ports), with correct content types (`.html`, `.xhtml` as `application/xhtml+xml`, `.css`, `.js`, `.svg`, images). In served text files, replace the placeholder `__CROSS_ORIGIN__` with the second origin (scheme, host and port, no trailing slash). No request leaves the machine.
- `withTarget(files, fn)`: establish a target on the served page through **the same code path as the engine** (fresh context, load, settle, frames, CDP), call `fn(ctx: CheckContext)`, clean up.
- `observe(provider, files)`: run one provider on the served page exactly as the engine does and return the sanitised, validated observations.
- Accept files as a map of path to content or as a folder path (corpus cases are folders with `case.json` and an `index.html` first in `files`).

## Tests

- Vitest, under `tests/engine/` and beside the code. Launch Chromium once per test file. Tests make **no network request**: only the local fixture servers.
- Cover: sample refusals; established and not established (a 404, a refused connection); frames including a cross-origin frame (readable, with its own CDP session); a provider that throws, one that times out, one that omits a check, one that returns an invalid observation; sanitiser rules with planted values; check-sample warnings; a full `runAudit` on a fixture site with a stub provider, whose run file validates and whose findings are all `needs_review` or `not_tested`.
- `pnpm test`, `pnpm typecheck` and `pnpm validate-coverage` must pass.

## Rules

- Set up with `pnpm install --offline --frozen-lockfile`. Add no dependency and download nothing. Chromium is already installed.
- Never load a real site. Never type a credential. Never load a storage state.
- No output, log or test name may state or imply conformance, or show a rate or score (spec 2).
- Commit on your branch with clear messages, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Reply with: the branch and last commit; what you built, file by file in a few words; test counts; every place where the spec, the contract or `src/checks/types.ts` was unclear or did not fit, and what you did; gaps you left; your token use if you know it.
