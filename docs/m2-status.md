# M2 status

Kept current by the orchestrator. If you are taking over, read `docs/decisions.md` (Q50 to Q53 are the latest), then `docs/m2-kickoff.md`, then this file, then the M2 part of `docs/cost-log.md`.

**Orchestrator:** a fresh Opus 5.5 session at high effort (Q52), started 2026-11-18 from the M1 orchestrator's session after Fabien said "Push and start M2". Q39 carries over: the orchestrator does what the spec gives Fable.
**Ceiling (Q51):** 40 points of the weekly all-models limit from the baseline of 40% (2026-11-18 14:56 UTC). **Check-in at 60%, stop at 80%.** The weekly window resets 2026-11-21 16:00 UTC.

## Steps

| # | Step (brief, "Order of work") | State |
|---|---|---|
| 1 | Baseline in the cost log | Done 2026-11-18 14:56 UTC: weekly all-models 40%, 5-hour 21%. |
| 2 | Pin and install Playwright, Chromium, `@axe-core/playwright` | Done 2026-11-18. `playwright` 1.64.1 (2026-10-14), its Chromium 156.0.8078.4 (build 1248) and headless shell; `@axe-core/playwright` 4.14.0 (2026-10-15), resolving the one `axe-core` 4.14.0. Smoke run: Chromium launches, axe 4.14.0 analyses a page. |
| 2b | Check interface | Written by the orchestrator: `src/checks/types.ts` (types only). See "Decisions taken by the orchestrator". |
| 3 | Engine skeleton, run-file writer | Done 2026-11-18, merged as `1e7bf67`. `runAudit`, fresh context per target, frames with CDP sessions (`--site-per-process`), providers, run file validated before writing, two-origin fixtures in `src/engine/testing/`. 509 tests pass. Axe checked through the engine path with a cross-site frame. |
| 4 | Minimal sanitiser | Done with step 3 (`src/engine/sanitise.ts`): URL, form-value and token masking, snippets capped at 1000 characters, redactions counted. |
| 5 | Axe adapter | Done 2026-11-18, merged as `83df023`. 67 rules, all reported; `frame-tested` runs as a scope probe only; frames where scripts are blocked are detected and count as a scope gap. 435 tests pass. |
| 6 | Ten custom checks | Family B (10.1.1, 10.1.2) merged as `46746ee`; family C (2.1.1, 6.2.1, 11.1.1, 11.8.2) merged as `d609681`, fixed by `ec90905`; 685 tests pass. Family A running. |
| 7 | Working set | Cases merged 2026-11-18 (92 planted cases, ten tests, `tests/corpus/working.test.ts`); 521 tests pass. Numbers wait for the checks and the harness. |
| 8 | Wiring and CLI (`audit`, `coverage`) | Done 2026-11-18: `audit`, `coverage`, `check-sample`, `report` (placeholder, exit 2); `allProviders()`; harness `pnpm evaluate`. 549 tests pass. |
| 9 | Two runs, Aubay comparison | Not started. |
| 10 | Check-in at 20 points (60%) | Not reached. |
| 11 | Codex's review, corrections, gate | Not started. |

## Builders

| Builder | Model, effort | Owns | Brief | State |
|---|---|---|---|---|
| Engine | Opus 5.5, high | `src/engine/`, `check-sample.ts`, `tests/engine/` | `docs/m2/brief-engine.md` | Merged `1e7bf67` (about 273k tokens) |
| Axe adapter | Sonnet 5.5, medium | `src/checks/axe/`, `tests/checks/axe/`, axe `exists` flags | `docs/m2/brief-axe.md` | Merged `83df023` (about 155k tokens) |
| Working set | Opus 5.5, medium | `corpus/working/`, `tests/corpus/` | `docs/m2/brief-working-set.md` | Merged (about 315k tokens) |
| Checks A, B, C | Opus 5.5, high | `src/checks/custom/<name>/` (A reads the vendored `source/` of 8.4, never edits it), family helpers, their tests | `docs/m2/brief-custom-checks.md` | Launched 19:25 UTC (three builders) |
| CLI and harness | Sonnet 5.5, medium | `src/cli/`, `src/checks/index.ts`, `src/evaluation/`, `corpus/results/` | `docs/m2/brief-cli-harness.md` | Merged (about 210k tokens) |

## In flight

- Phase 1 done: axe adapter, engine and working set merged.
- Phase 2 launched 19:25 UTC after the 5-hour reset: checks families A, B, C (Opus high) and CLI/harness (Sonnet medium), in parallel.
- **Check-in at 60% weekly:** likely to be crossed while phase 2 runs. Builders already running finish their task (stopping them mid-way would waste what they spent); no new builder is launched past 60% until the check-in report goes to Fabien.
- ISO 639 sources for 8.4.1: Fabien said "Yes, both" (Q54). Vendored 2026-11-18 15:09 UTC in `src/checks/custom/8-4-default-lang-code-valid/source/` (see its `SOURCE.md`). Family A derives the pinned list from them.

## Decisions taken by the orchestrator

Also logged on the bridge, channel `rgaa-assist`.

- **Versions.** Playwright 1.64.1 is the newest release at least two weeks old on 2026-11-18 (1.65.0 is from 2026-11-05). `@axe-core/playwright` 4.14.0 matches axe-core 4.14.0. Both pinned exactly in `package.json`.
- **The check interface is written by the orchestrator** (`src/checks/types.ts`), as a types-only file, so that the engine, the axe adapter and three custom-check builders can work against one shape at the same time. It is not feature code. Changing it goes through the orchestrator.
  - A check returns raw evidence; the engine numbers it, sanitises it, records options and validates the observation. Checks never sanitise and never write.
  - A provider runs once per target and returns one result per declared check. The axe adapter is one provider.
  - The engine gives each provider the page, the list of frames with whether each could be read, and a CDP session per frame target (for the accessibility tree).
- **`@axe-core/playwright` needs a page from `browser.newContext()`**: it opens a blank page in the same context to finish a run. The engine creates a fresh context per target anyway (7.4).

- **Harness counts (logged on the bridge):** false assurance is a `passed` or `not_applicable` over the cases that expected neither; a swap between the two is a mismatch and shows in the table. Per-link tables reuse the test's findings (a finding is per test); only missing observations are per link. `corpus/results/working-20261118T193148Z.json` was produced before any custom check existed (every case `not_tested`); it is superseded by the run after the checks merge.

## Findings to report at the gate

- **Axe records.** The 67 `axe/` records now have `exists: true`, but their `examines` text still ends "The adapter that runs it is not built yet." Builders may change only `exists`, so the text is stale; correcting it is Fabien's call.
- **Axe adapter, as built:** it runs `frame-tested` as a 68th rule, only to learn which frames axe could not analyse (it never becomes an observation). Frames whose scripts are blocked (sandbox without `allow-scripts`, CSP `sandbox`) made axe hang; the adapter probes each frame for a timer first and makes the blocked ones fail fast, which axe then reports as untested. A frame not analysed turns `no_fault` or `inapplicable` into `cannot_tell`. axe skips `display: none` frames entirely, without reporting them. `window.axe` stays as a global in each frame axe enters.
- **Engine, as built:** Chromium is launched with `--site-per-process` (otherwise headless Chromium keeps cross-site frames in-process and they have no CDP session of their own). Default viewport 1280×800 (the sample schema has no default). It also refuses `model.enabled: true` (M6) and rulesets other than `rgaa-4.1.2`. The run file has no field for: why a target was not established, timezone, reduced motion, launch arguments, the snippet cap, whether network idle was reached. They are in the engine's messages only.
- **Sanitiser risk:** the base64 token pattern (32+ characters mixing upper case, lower case and digits) may mask long generated class names or ids in locators on real pages. To watch in the two runs.
- **From the working-set writer (cases not written, for Fabien):**
  1. 8.5.1: a page whose only title element is an SVG `<title>`. The record faults it (no HTML title element); the test says only « balise `<title>` ». Does an SVG title count?
  2. 10.1.2: `height` on `table`. The gate package (approved with Q50) says "can't tell", and the family B brief applies that; the record's own text does not name it.
  3. A definite fault beside an unreadable frame, and no `optgroup` beside one (2.1.1, 6.2.1, 11.1.1, 11.8.2). The records say both "a nested document cannot be read: cannot_tell for the page" and "fault if any". The gate package's order (a fault wins; an unread frame comes before inapplicable) is applied in the family C brief, not written in the records. No local case can make a frame unreadable yet.
- **Records that abstain where the official text reads as failing (no false "passed"; for Fabien):** 10.1.2 `width`/`height` on `iframe` (the methodology's exception names only img, object, embed, canvas, svg); 11.1.1 `aria-labelledby` to a missing id; 6.2.1 a link named only by `aria-label` and `title`; 8.3.1 XHTML 1.0 as text/html with `lang` only (test line « lang et/ou xml:lang » against methodology and glossary). The cases encode the records' answers as `outside_support`.
- **Three `fail_only` entries (11.1.1, 8.4.1, 8.2.1) cannot run at `full`:** their partial links fail the schema at `candidate: full`. Only their `fail_only` expectation is measurable.
- **Family B (10.1.1, 10.1.2), as built:** one provider reads each frame once, closed shadow roots through CDP (read, not abstained on). `RECORD:` points: (1) the 10.1.2 defined-pair table was completed from the builder's memory of HTML 4.01 and the HTML standard, no source downloaded; pairs beyond the record's examples, **for Codex to verify**: `align` on `fieldset` and `embed`, `background` on `thead`, `tbody`, `tfoot`, and the `applet` pairs (unknown element in Chromium anyway); `height` on `table` left out per the gate package; (2) earlier doctypes matched on exact W3C public identifiers; (3) a case variant "becomes" a listed or obsolete attribute; (4) location-free clauses of (2) applied in every place read; (5) an excepted pair (`img width`) inside a shadow tree or frame gives cannot_tell, as the record says "a listed attribute" there; (6) unparsable `noscript` text abstains; (7) CDP failure abstains as an unreadable shadow root; (8) fault evidence capped at 1000 elements with the total in a note.
- **Consequences of the 10.1.2 record on real pages (for Fabien):** Google Tag Manager's standard `<noscript><iframe height="0" width="0">` gives cannot_tell on most sites using it; inline SVG `rect`, `image`, `use` give cannot_tell (other namespace); an `svg` shown through `object` or `embed` gives cannot_tell; `size` on `input` faults (the record's own example). 10.1.2 will often be "needs review" on real pages.
- **Family C (2.1.1, 6.2.1, 11.1.1, 11.8.2), as built:** one provider, one scan per frame, closed shadow roots through CDP, the accessibility tree asked only where it can change the outcome. A fault wins over an unread document; an unread document comes before `no_fault` and `inapplicable` (gate package). Unreadable frames tested with a cross-site frame that busy-loops after load. All 39 working-set cases agree. `RECORD:` points, all of which can only remove faults or abstain: (1) 6.2.1 skips text only when its own element is not visible, where the record says to skip the subtree under `visibility: hidden` (a `visibility: visible` descendant is rendered and exposed); (2) "explicit role" read as the first token, ignoring ASCII case, in 6.2.1 and 11.1.1 (only 11.8.2's record says so); (3) 11.1.1 step (1) treats a hosting frame element as an ancestor; (4) 11.1.1 "a combobox" includes `<input list>`; (5) 11.8.2 clipping computed from overflow, paint containment, CSS `clip` and `clip-path: inset()` only; (6) 11.8.2 hosting frame elements count as ancestors for opacity and visibility.
- **Agent worktrees started from an old commit.** The axe builder's worktree started at `717420b`, before the M2 briefs; it fast-forwarded itself. Launch messages now tell builders to check that their branch contains the latest main.

## Errors in the orchestrator's own work

- **Conflict markers pushed to main (2026-11-18 19:55 UTC).** Resolving the family C merge, a file write failed and the merge commit `d609681` went in with conflict markers in `src/checks/custom/index.ts`. The checks ran in a pipeline that hid the type-check failure, and `main` was pushed. Fixed in `ec90905` a few minutes later and pushed. From now on the orchestrator runs the three checks with `set -o pipefail` and pushes only after reading their result.

## Open points for Fabien

None.
