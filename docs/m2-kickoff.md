# M2 kickoff brief

**Draft, 2026-11-18.** Written by the M1 orchestrator after Fabien approved M1 (Q50) and set the M2 ceiling (Q51). M2 does not start until Fabien has answered the choices at the end of this brief and said to start. His answers are then written into the section "Confirmed with Fabien", and the draft line above is removed.

You are starting milestone M2 of rgaa-assist. You split the work, brief the builders, review every diff and run the gate. You write no feature code, no check and no corpus case.

## Read first, in this order

1. `docs/decisions.md`. It wins over everything else. Q50 and Q51 are the latest.
2. `docs/spec.md`. Sections 2, 5, 7.1, 7.4, 8, 10, 11.1, 13 and 14 govern M2.
3. `docs/m1-status.md`, for what M1 left: the frozen contract, the check registry, the open points.
4. `docs/m1/gate-package.md`, for the minimum useful set and what is still unsure.
5. This brief. Where it disagrees with the spec, the spec wins and you tell Fabien.

## What M2 delivers (spec 14.1)

- **The engine on one page in its initial state.** It reads a sample file, loads each page in a fresh Chromium context through Playwright, runs the checks, hands the observations to the ruleset, and writes the run file (8.8).
- **The axe adapter.** It runs axe-core 4.14.0 through `@axe-core/playwright` and returns observations under the check ids of the registry (`axe/<rule>`), with the effective options recorded.
- **Derivation and reduction for RGAA 4.1.2, wired to real runs.** The pure functions exist since M1. M2 feeds them real observations and writes findings and reduced results.
- **A run on one PremiumShot page (Q20).** One page, initial state only, without a saved session.
- **The CLI commands that this needs:** `audit` and `coverage` (11.1), with the exit codes of 11.1.
- **The start of the corpus (M5 starts with M2).** A working set in `corpus/working/`, served locally, and the first working-set numbers.

Not in M2: steps, `expect`, states other than `initial`, saved sessions, the full capture policy and its channel tests, `checkSample`, reports, the model. Those are M3, M4 and M6.

**Nothing is enabled in M2.** Every entry stays `enabled: none`, so every finding of the PremiumShot run is `needs_review` with reason `not_enabled`, or `not_tested`. That is the expected result, not a defect. The run shows that the engine produces valid observations and a valid run file; the working-set numbers show how the checks behave against labelled cases.

## What M1 hands over

- **The contract is frozen** (`ca5c92b`, amended only by Q40 and Q43). Changing a schema or a signature goes through you and is logged. If a change would alter a decision, stop and ask.
- **The coverage map and the check registry are approved as they stand (Q50).** A builder implements a check exactly as its record in `src/rulesets/rgaa-4.1.2/checks.json` describes it. If a record cannot be implemented as written, or the implementation would have to be narrower or wider, that is a finding to report to Fabien, not a change to make. Setting a record's `exists` to `true` once its check is merged and tested is the only edit to the registry a builder makes.
- **Every failure link in the minimum useful set is a custom check.** The axe links of those ten tests are all `evidence_only`. An M2 limited to the axe adapter produces no observation that could ever support `failed` or `passed` on the set. Choice 5 below asks Fabien how much of this M2 takes on.
- **Open points that touch M2** (gate package, "Unsure, and open"): one check result cannot serve several requirements over different elements; the contract does not order checks that change the page. M2 runs read-only checks in the initial state only, so neither should block it. If one does, stop and ask.

## Order of work

1. **Record the baseline** in `docs/cost-log.md`: weekly all-models usage at the start. The ceiling of Q51 is counted from it.
2. **Pin and install** Playwright, its Chromium build and `@axe-core/playwright`, as Fabien authorised (choice 2). Record the exact versions; they go into the run file's manifest.
3. **Engine skeleton and run-file writer.** One core builder. Sample reading (the `initial` state of each page, no session), a fresh context per target, a `TargetExecution` per target, the manifest of 8.8, and a run file that validates against the M1 schema.
4. **Minimal sanitiser.** In M2 the sanitiser applies the rules of 8.7 that do not depend on a session: query-string values and fragments masked unless listed in `safeQueryParams`, form-field values dropped from snippets, token-shaped strings masked, error messages passed through it, every redaction counted. Screenshots stay off in M2. The full channel tests are the M3 gate.
5. **Axe adapter.** One module builder, in parallel with step 3 once the observation type is fixed (it is, since M1).
6. **Custom checks**, to the extent of choice 5. One core builder per check family, each owning its own files under `src/checks/custom/`.
7. **Working set.** Cases in `corpus/working/`, written by an agent that wrote none of the checks they test (10.5). Each case names one test, one branch and its exact expected status (10.2), its source and its licence. Evaluation serves them locally and makes no network request.
8. **Wiring and the CLI.** `audit` runs the engine and writes the run folder; `coverage` prints the map summary.
9. **The PremiumShot run**, on the page Fabien names (choice 1).
10. **The check-in at 20 points** (below).
11. **Codex's review**, then corrections, then the gate.

## Rules

- **One writer per directory at a time.** Each builder works in its own worktree and is told which directories it owns.
- **Results are checked, not trusted.** Read every diff and run the tests yourself. A builder's report is not evidence.
- **The writer of a case never writes the check it tests** (10.5). **Builders never see `corpus/acceptance/`.** If M2 creates an acceptance set, a separate agent writes it and only you run it.
- **Expected results are not edited to make a gate pass.** A change needs a written reason citing the official text, and the orchestrator's sign-off logged on the bridge (10.5; Fable's sign-off in the spec, the orchestrator's under Q39 if Opus orchestrates).
- **No request beyond the sample's pages and what they load** (8.1). Evaluation runs offline.
- **Never type a credential, never load a saved session.** M2 examines public pages only.

## Roles (spec 14.2)

| Role | Model | In M2 |
|---|---|---|
| Orchestrator | Choice 3 | Briefs, diff review, gate, logs, cost. |
| Core builder | Opus 5.5, medium to high | Engine, run-file writer, sanitiser, wiring of derivation and reduction, custom checks. |
| Module builder | Sonnet 5.5, low to medium | Axe adapter, CLI wiring, corpus cases from labelled sources. |
| Reviewer | Codex | Reviews the gate: engine, run file, checks against their records, working-set labels. Edits nothing in this repo. |

## Working with Codex

- Codex reads bridge messages only at its next prompt. Send the request, then ask Fabien to prompt Codex.
- Use the `rgaa-assist` channel: `bridge -P rgaa-assist …`. Keep secrets off the bridge, including anything a run captures from a page.
- Log each decision you take with `bridge decision`, and set `bridge status` while agents are working.

## Budget and stops (Q51, spec 14.3)

- **Ceiling: 40 points of the weekly all-models limit, counted from the baseline of step 1.**
- **Check-in at 20 points.** Pause the builders, then report to Fabien: what is merged, what remains, the usage so far by role, and whether the rest fits. If it does not, say so; do not cut scope to make it fit.
- At the ceiling, stop. M2 continues after the next weekly reset (Saturday 2026-11-21 16:00 UTC), unless Fabien decides otherwise.
- One line per role in `docs/cost-log.md` at the check-in and at the gate: model, effort, tokens, share of plan used.

## Hard stops (spec 14.4)

Stop and ask Fabien when:

1. Something would change a decision in `docs/decisions.md`, including Q50's approved map and check records.
2. There is any ambiguity about the claim boundary (spec 2).
3. A ceiling is reached.
4. The gate has failed twice.
5. A source differs from what the spec assumed: RGAA text, criteria data, a licence, a tool's behaviour, including Playwright, Chromium or axe-core behaving differently from what a check record assumes.

Everything else you decide, and log on the bridge.

## The gate (no approval by Fabien, spec 14.1)

M2 is done when all of this is true:

- Tests, typecheck and coverage validation are green.
- The PremiumShot run file validates against the run-file schema, with its manifest complete.
- First working-set numbers are reported, as counts with their population ("x of n cases on corpus X", 10.3), per link and per check. Never as a rate, a score or a verdict.
- Every implemented check matches its registry record, and every mismatch is reported to Fabien.
- Codex has reviewed the gate. Its findings are answered or listed as open.
- You have reviewed every diff, and `docs/m2-status.md` says where things stand.

You report the gate to Fabien, with the cost log and a proposed ceiling for M3.

## What you must not do

- Declare or imply conformance, or compute any rate, anywhere, including in logs and summaries.
- Enable an entry.
- Change an entry or a check record, beyond setting `exists` on a merged check.
- Start M3 work: steps, states, saved sessions, reports.
- Change the spec. If it is wrong, say so and stop.

## Confirmed with Fabien

Nothing yet. This section is filled in from his answers below.

## Choices for Fabien

1. **Which PremiumShot page.** One public address that loads without signing in. Its regime in the sample stays `to_confirm` unless you say otherwise (Q20 follow-up).
2. **Downloads.** Your M1 yes covered the three official files and axe-core 4.14.0 only. M2 needs:
   - Playwright and the Chromium build it ships with, at a stable release at least two weeks old, pinned and recorded;
   - `@axe-core/playwright`, at the release matching axe-core 4.14.0.
   - Optional: the W3C ACT rule test cases (`w3c/wcag-act-rules`, at a pinned commit), as a source for working-set cases (10.1). Licence checked per asset. Without them, the working set is planted cases only.
3. **Who orchestrates.** Spec 14.2 names Fable 5.2; Q39 replaced it with Opus 5.5 at high effort for M1 only. Recommended: Opus 5.5, high effort, in a fresh session started from this brief and `docs/m2-status.md`, as in M1 after Q42.
4. **Commits and pushes.** For M1: builders commit on their own branches, the orchestrator merges to main, no push. The repository is now on GitHub (private). Recommended: the same, plus the orchestrator may push `main` after a merge whose tests pass; never a builder branch, never a force push.
5. **How far M2 goes with custom checks.** All failure links of the minimum useful set are custom checks.
   - **(a) The spec's letter:** engine, axe adapter, wiring and the PremiumShot run. Working-set numbers cover axe links only, and say nothing yet about the ten tests of the set. Cheapest.
   - **(b) Recommended: (a) plus the ten custom checks behind the minimum useful set** (`custom/8-5-page-title-present`, `custom/10-1-presentation-elements`, `custom/10-1-presentation-attributes`, `custom/11-8-optgroup-label-attribute`, `custom/8-3-default-lang-present`, `custom/8-4-default-lang-code-valid`, `custom/2-1-frame-title-attribute`, `custom/6-2-link-content-name`, `custom/11-1-field-label-mechanism`, `custom/8-2-id-duplicate`), each with working-set cases for its branches. The first numbers then concern the set, and no entry is enabled. This is M5 work started alongside M2, as 14.1 allows. It may not fit in 40 points; the check-in at 20 would say so.
   - **(c)** (a) plus a few of the ten, chosen by the orchestrator for the cheapest coverage.
