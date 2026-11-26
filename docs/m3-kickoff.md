# M3 kickoff brief

**2026-11-25, choices answered 2026-11-26.** Written by the M1 orchestration session after Fabien accepted M2 (Q65). Fabien took every recommendation (Q66, "Take recommendations"); see "Confirmed with Fabien" at the end. M3 started on 2026-11-26 on Fabien's word (Q67), before the 2026-11-28 16:00 UTC reset, with 10 points of the weekly limit; it then pauses until the reset or until Fabien allows more. Record the baseline first.

You are starting milestone M3 of rgaa-assist. You split the work, brief the builders, review every diff and run the gate. You write no feature code, no check and no test fixture.

## Read first, in this order

1. `docs/decisions.md`. It wins over everything else. Q65 and Q66 are the latest.
2. `docs/spec.md`. Sections 2, 7, 8.1 to 8.5, 8.7, 8.8, 10.2, 11 and 14 govern M3.
3. `docs/m2-status.md` and `docs/m2/gate-report.md`, for what M2 left. Section 4 of the report lists the open items.
4. `docs/m2-kickoff.md`, for the rules that carry over.
5. This brief. Where it disagrees with the spec, the spec wins and you tell Fabien.

## What M3 delivers (spec 14.1)

- **Steps (7.2).** The five actions, replayed for each declared state. `fill` refuses a field of type `password`.
- **`expect` (7.3).** On states and on authenticated pages. For a state with steps it is evaluated before the steps too: already met gives `expect_already_met`; not met in time gives `target_not_established`.
- **A fresh context per target (7.4).** It exists for the initial state. M3 extends it to states: no viewport, storage or change is inherited, in any declared order.
- **Saved sessions (7.1, 7.4).** The storage-state file is loaded only for pages marked `authenticated`. It is read and never copied, logged or written back.
- **The capture policy (8.7).** Every channel of the table, screenshots included, through the one sanitiser.
- **The sample check (7.5).** `checkSample` and the `check-sample` command already exist. M3 checks them against 7.5 and makes sure the "cannot check" list is in the output.
- **The engine cases of 10.2.** Each returns its exact expected result.

Not in M3: reports, `grid.csv` and the evidence folder's layout (M4), the model (M6), keyboard and timed passes (so `keyboard` and `media` stay unmet), new checks, and the record changes of gate-report items 1 to 5 and 11.

**Nothing is enabled in M3.** `state` becomes a prerequisite that can be met. No finding can become `passed`, `failed` or `not_applicable` on a real run because of it.

## What M2 hands over

- **The engine on initial states**, the axe adapter (67 rules, adapter version 3) and ten custom checks. At `ee99ba0`: 939 of 939 tests, and 97 of 97 cases matched on corpus working@c08d0a84f819.
- **Schemas for M3 already exist** (frozen in M1): steps, `expect`, `session`, `capture`, `TargetExecution` with `sessionLoaded`, the steps and both `expect` results. The engine refuses these inputs today (`src/engine/sample.ts`, "supported from M3"). Each refusal is removed only with its feature and its tests.
- **A known weakness in the privacy path.** Editable-box text reached saved evidence by several routes, corrected in Q56 and Q60 to Q63. Codex found them one at a time. The guards live in several places: family A, family C, the axe adapter and the sanitiser. They share the role list, not the code.
- **Codex's last full pass was at `1c58636`.** Later passes covered one correction each.

## Order of work

1. **Record the baseline** in `docs/cost-log.md`: weekly all-models usage just before the first step.
2. **Design the privacy sweep, before any feature.** One document, `docs/m3/privacy-design.md`, written by a core builder and reviewed by you:
   - **An inventory** of every place where text from a page, a URL, an error or the sample can enter the run folder: each provider, each evidence field (`snippet`, `note`, `locator`), target records, step errors, sample copy, logs, file names, screenshots.
   - **The contexts** text can come from: form fields; editable boxes by attribute, role and `designMode`; open and closed shadow trees; slots; same-origin, cross-origin and nested frames; combinations of these.
   - **A decision on where the guard lives.** Compare the present guards with one guard in the engine that resolves the context of every evidence item itself and masks what it cannot resolve. If that changes `src/checks/types.ts`, the change is yours to make and log; if it changes a frozen schema, stop and ask.
   - **A harness** that plants a distinct marker in every context and channel, runs the real `runAudit`, and searches every byte of the run folder, not only the observations. Each marker states in advance where it may and may not appear. Include controls that must keep their text, so that masking everything does not pass.
   - **Codex reviews this design** before it is built.
3. **Build the sweep and fix what it finds**, on the M2 engine. Include gate-report items 13, 15 and 16: the masked reCAPTCHA snippets, over-masking of generated names, and the untested frame cases.
4. **Steps, `expect` and states.** One core builder, owning `src/engine/`. Errors go through the sanitiser: Playwright's messages can carry addresses, locators and values.
5. **Saved sessions.** After step 4, same owner. A missing, unreadable or invalid storage-state file is handled without printing its content.
6. **Capture policy and screenshots.** After step 5, since it depends on `sessionLoaded`. Screenshots black out form fields and editable boxes as well as `capture.mask`, and none is taken when that region cannot be determined (Q66). Nothing is captured on a target that was not established.
7. **Sample check** against 7.5. One module builder, in parallel with step 4.
8. **Engine cases of 10.2**, written by an agent that builds none of the features they test. List first which cases M1's contract tests already hold, so that none is written twice and none is assumed.
9. **The check-in** (below).
10. **Extend the sweep** to the channels that steps 4 to 6 added, and run it whole.
11. **Regression:** the working set, and the runs of choice 6.
12. **Codex's review**, then corrections, then the gate.

### The engine cases

| Group | Cases (10.2) |
|---|---|
| Target | A delayed state; an expired session; states declared in reverse order; a failing step; an expectation already true before the steps |
| Session | A public page examined with the saved session; a state that navigates to an account page |
| Derivation | A missing observation; an unreadable frame; two checks that disagree; a disagreement together with a crashed check; an unmet prerequisite |
| Approval | An enabled entry edited without a new approval; a linked check changed since it was measured |
| Reduction | A process with one failed step and one missing step |

For several of these the expected result is `not_tested`. Returning it is the case passing. Cases that need an enabled entry use an in-memory copy; the coverage map is never edited.

## Rules

- **One writer per directory at a time.** Each builder works in its own worktree and is told which directories it owns. Steps 4 to 6 share `src/engine/`, so they run one after the other.
- **Results are checked, not trusted.** Read every diff and run the tests yourself, with `set -o pipefail`, and read the result before pushing.
- **The writer of a case or a planted fixture never writes the code it tests** (10.5). Builders never see `corpus/acceptance/`.
- **Expected results are not edited to make a gate pass.** A change needs a written reason and your sign-off, logged on the bridge.
- **Synthetic data only.** Sessions, accounts and markers are invented, and served from local test servers. No builder, test or run reads a real storage-state file. No credential is typed.
- **No request beyond the sample's pages and what they load** (8.1). Tests and evaluation run offline.
- **Checks and records do not change**, except where a guard moves under step 2 or 3. A behaviour change is a finding to report.
- **Downloads:** none is expected. Anything to download needs a new yes from Fabien.
- **Content of audited sites stays out of git and off the bridge** (Q53).

## Roles

| Role | Model | In M3 |
|---|---|---|
| Orchestrator | Opus 5.5, high effort | Briefs, diff review, gate, logs, cost. |
| Core builder | Opus 5.5, medium to high | Privacy design and guard, steps, `expect`, sessions, capture. At most two at once. |
| Module builder | Sonnet 5.5, medium | Sample check, CLI wiring, engine cases, planted fixtures, small corrections. |
| Reviewer | Codex | The privacy design, then the gate. Edits nothing in this repo. |

## Working with Codex

- Codex reads bridge messages only at its next prompt. Send the request, then ask Fabien to prompt Codex.
- Ask for two reviews: the privacy design (step 2), and one full pass on the final commit. The full pass covers the code changed since `1c58636`, not only M3's, and reruns the whole test suite and corpus if Codex can.
- Keep secrets and captured content off the bridge. Log each decision you take with `bridge decision`.

## Budget and stops

- **Permission: 10 points of the weekly all-models limit from the baseline (Q67).** Then pause and wait for the reset or for Fabien to allow more. With less than about 2 points left, start nothing new.
- **Estimate: 45 points for the milestone**, with up to 25 for the build and 20 kept for correction rounds (Q66). It is an estimate, not permission: M2 took about 45, and may have taken more or less.
- **Check-in at 22 points.** Pause the builders, then report what is merged, what remains, usage so far, and whether the rest fits. Do not cut scope to make it fit.
- **Count each step** from a reading just before and one just after it, and say when other work ran in between. Ask the M1 session and Fabien for nothing that can be read from the repo: relays cost points too.
- **Log tokens per role** at the check-in and the gate. Spec 14.3 also asks for an API-equivalent cost; M2 did not record the split needed. Record it if the tooling gives it, otherwise say so.

## Hard stops (spec 14.4)

Stop and ask Fabien when:

1. Something would change a decision in `docs/decisions.md`, or a frozen schema beyond what choice 7 allows.
2. There is any ambiguity about the claim boundary (spec 2).
3. A ceiling is reached.
4. The gate has failed twice. A second hold from Codex on the same family of fault counts, even on a new route: stop and ask whether the design is wrong instead of fixing the route.
5. A source differs from what the spec assumed, including how Playwright or Chromium behaves.
6. Any real personal data or credential is found in a run, a fixture or a log.

Everything else you decide, and log on the bridge.

## The gate (no approval by Fabien, spec 14.1)

M3 is done when all of this is true:

- Tests, typecheck and coverage validation are green. The working set still matches exactly, or every change is explained.
- Each engine case of 10.2 returns its expected result, reported as "x of n cases".
- Each capture channel of 8.7 is tested with planted values on a saved run folder, with the limits of choice 3 (nothing is sent to a model). This includes a public page that shows personal content when logged in, and a state that navigates to an account page, both with the model switches off.
- The sweep's inventory has a test for every row, or a row that says why not. It does not claim that no secret can ever reach the run folder (8.7).
- The sample check matches 7.5, including what it cannot check.
- Codex has reviewed the design and the final commit. Its findings are answered or listed as open.
- You have reviewed every diff, and `docs/m3-status.md` says where things stand.

You report the gate to Fabien, with the cost log and a proposed ceiling for M4.

## What you must not do

- Declare or imply conformance, or compute any rate.
- Enable an entry, or change an entry or a check record.
- Load a real saved session.
- Start M4 or M6 work.
- Change the spec. If it is wrong, say so and stop.

## Open points to watch

- **Checks run one after another on the same page.** The contract does not order checks that change the page (gate package, M1). A state may also change by itself while checks run, such as a menu that closes. The spec does not ask for `expect` to be checked again afterwards. If a check or an engine case shows this matters, report it; do not add a rule.
- **`capture.screenshots` defaults to `false` in the schema today**, while 8.7 turns screenshots on for targets without the session, so a written `false` cannot be told from the default. Under Q66 the field becomes optional: left unset it follows the session, and `false` turns screenshots off on a public page.
- **Steps can change data.** A `click` on a real account page can submit something. Nothing in the spec prevents it; the sample's author is responsible. M3 uses local servers only, so it does not arise here. It does at the first real use.
- **Loading a saved session may rotate it on the server.** The file is never written back, so a site that rotates sessions could log the user out or refuse the next target. It would show as `target_not_established`.

## Confirmed with Fabien

On 2026-11-26 Fabien took the recommendation for each choice (Q66, "Take recommendations"):

1. **Ceiling and start.** 45 points of the weekly all-models limit from the baseline, check-in at 22, starting after the reset of 2026-11-28 16:00 UTC, on Fabien's word. Amended by Q67: M3 started on 2026-11-26 with 10 points of permission; 45 and 22 remain the estimate.
2. **Who orchestrates, and how.** A fresh Opus 5.5 session at high effort with spawned agents; Q39 carries over. Builders commit on their own branches; you merge and may push `main` after a merge whose checks pass. Never a builder branch, never a force push.
3. **The model-payload channel (amends spec 14.1 and 8.7).** M3 tests that nothing is sent and that `model.enabled: true` is still refused. The payload test stays with M6.
4. **What screenshots show (amends spec 7.1 and 8.7).** Every screenshot also blacks out form fields and editable boxes, using the snippets' definition. When that region cannot be determined, no screenshot is taken. On a target without the session, `capture.screenshots: false` turns screenshots off; left unset, they are on. The schema change this needs is authorised. Cost: a screenshot says less about a field.
5. **Ordinary text on pages examined with the session.** Spec 8.7 as written: the text stays in the local run folder. The gate's two session cases state exactly where it may appear, and the run file says the target was examined with the session.
6. **Live runs.** One logged-out run of `https://premiumshot.app/` with one extra state (a menu opened at a mobile width, if the page has one), as a regression. No run on Aubay. No real saved session anywhere in M3.
7. **Run-file additions** (gate report, item 12). Why a target was not established, timezone, reduced motion, launch arguments, the snippet cap, and whether network idle was reached: added once, with a schema version change. That change to the frozen schemas is authorised, and no other.
8. **The privacy sweep first,** with Codex reviewing its design before it is built, and the stop in hard stop 4.

Not covered: the record differences of Q65 stay open, nothing is enabled, and no download is authorised.
