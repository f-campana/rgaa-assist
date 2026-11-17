# M1 status

Kept current by the orchestrator. If you are taking over, read this after `docs/m1-kickoff.md`.

**Orchestrator:** from 2026-11-17, a fresh Opus 5.5 session at high effort (decisions Q39 and Q42). Until then Fable 5.2 in Fabien's planning thread, which stops orchestrating at this handover.
**Ceilings:** the 85% stop of Q38 is lifted by Q44: work runs until the plan's weekly limit, and Fabien holds a limit reset. The 65% check-in is done. The Fable stop no longer applies.

## Steps

| # | Step | State |
|---|---|---|
| 1 | Vendor the official data, verify counts | Done 2026-11-16. 13, 106, 258. In `src/rulesets/rgaa-4.1.2/official/`. |
| 2 | Package scaffold (pnpm, TypeScript, Vitest, axe-core 4.14.0 pinned) | Done 2026-11-16, merged as `0868bb4`. zod 4.6.7, typescript 7.0.2, vitest 5.1.0. |
| 3 | Schemas and the ruleset contract, then freeze | Done and frozen 2026-11-16, `ca5c92b`. 144 tests pass. Design notes and the orchestrator's review: `docs/m1/contract-notes.md`. |
| 4 | Implementation of derivation, reduction and effective level by one agent, contract tests by another, both after the freeze | Done 2026-11-16. Implementation and 185 contract tests merged; all 386 tests pass. |
| 5 | Table of axe rules per RGAA test, and theme packets for entry writers | Done 2026-11-16, merged as `aa4cdd9`. 67 rules, 40 tests, as the spec says. `pnpm packets` writes 13 packets, 595 KB in all; theme 1 is 121 KB, so split it between writers by criterion. |
| 6 | Pilot of 14 entries, usage projection | Done 2026-11-16, merged as `51880bb`. Projection in the cost log. |
| 7 | Entries by theme | Not started |
| 8 | Check-in at 65%, with Codex's cross-check | Not started |
| 9 | Minimum useful set | Not started |
| 10 | Gate package for Fabien | Not started |

## In flight

- Batch 1 merged: builder A (`ad72cdb`, 1.1 and 1.5) and builder B (`2123b43`, 8.1, 8.2, 8.5 to 8.10). Entries: 35 of 258 (none 24, fail_only 10, full 1: 8.5.1). 414 tests pass.
- Batch 2 merged: builder D (`a6fe2a4`, theme 9) and builder C (`16bac2a`, 11.2 to 11.5). Entries: 56 of 258 (none 40, fail_only 15, full 1). 94 check records, sorted, no duplicates.
- Batch 3 merged: builder E (`c17318a`, theme 3) and builder F (`6497c3e`, theme 5), all 30 at `none`. Entries: 86 of 258 (none 70, fail_only 15, full 1).
- Batch 4 merged: builder G (`307da9a`, 4.2 to 4.13) and builder H (`7fd2308`, theme 13). Entries: 129 of 258 (none 112, fail_only 16, full 1). 414 tests pass; 96 check records, sorted, no duplicates.
- Paused 2026-11-17 15:00 UTC at 97% weekly. Fabien used his limit reset at 15:20 UTC: weekly all-models back to 1%, still ending 2026-11-21 16:00 UTC.
- Batches 5 and 6 launched together at 15:20 UTC: builders I, J, K, L.
- Remaining 129 tests, proposed batches once usage allows, two builders at a time:
  - batch 5: I, 1.2 to 1.4 (22); J, 6.1, 7.1, 7.2, 7.4, 7.5 (14);
  - batch 6: K, 1.6 to 1.9 (27); L, 10.1 to 10.6, 10.8 (14);
  - batch 7: M, 10.9 to 10.14 (16); N, 11.6 to 11.13 (19);
  - batch 8: O, theme 12 (19).

## Where M1 stands, 2026-11-17

- **Built:** official data, schemas, the frozen contract, its implementation, 185 contract tests, the validator, the packets, the entry guide.
- **Entries:** 14 of 258 (the pilot). Codex cross-checked them: 4 findings in 3 entries, 2 of them unsupported claims (8.3.1 `full`, 10.7.1 `fail_only`). Report: `~/Documents/Codex/2026-11-12/rgaa-independent-spec-review/outputs/rgaa-m1-pilot-51880bb-independent-review.md`. The orchestrator verified and accepted all four. The guide has a "Lessons from the pilot" section from them.
- **Usage:** all-models 68%, so 17 points remain before the 85% stop. The pilot cost about a quarter point per entry.
- **Fabien's decisions of 2026-11-17:** `applicability` gains `always` (Q40). The remaining entries are written by Opus at high effort, once the corrections pass Codex's re-check (Q41). A fresh Opus session orchestrates (Q42).

## Next, in order

1. **Corrections.** Launch one Opus builder, high effort, `isolation: worktree`, with `docs/m1/brief-corrections.md` (the `always` value, and entries 8.3.1, 10.7.1, 2.2.1). Review its diff, run `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage`, merge.
2. **Contract tests for `always`.** A different agent than step 1 (Sonnet is enough) adds to `tests/contract/derive.test.ts`: every requirement inapplicable gives `not_applicable` for `structural`, `needs_review`/`judgment_required` for `judgment`, `needs_review`/`cannot_tell` for `always`. It reads the spec and the doc comment, not the body.
3. **Codex's re-check.** Bridge message on channel `rgaa-assist` asking Codex to re-check the three corrected entries, the `always` change and the guide's new section, then ask Fabien to prompt Codex. No new entry is written before its answer.
4. **Entries.** If the re-check is clean: write the remaining 244 entries with Opus at high effort, criterion by criterion from `work/packets/by-criterion/`, a few builders at a time, each owning different criteria. Model the brief on `docs/m1/brief-pilot.md`. `checks.json` is shared: keep it sorted by id and resolve merges by taking both sides. Stop at 85% all-models and continue after the reset of 2026-11-21 16:00 UTC. Log usage per batch in `docs/cost-log.md`.
5. **Codex's cross-check of all entries**, then corrections.
6. **The minimum useful set** and **the gate package** (kickoff brief, last sections).

Keep the orchestrator's own turns few: read reports, read diffs of what makes a claim (`failure` and resolving links, `full` entries), and leave the rest to Codex's cross-check.

## Decisions taken by the orchestrator

Also logged on the bridge, channel `rgaa-assist`.

- The orchestrator fetched the three official files itself, since Fabien's yes for the download was given to it and the files are data, not code.
- Schema library: Zod 4, which defines a schema once and gives both the TypeScript type and a JSON Schema (spec 13).
- M1 includes the pure functions behind the contract (derivation of 8.3, reduction of 8.4, effective level of 6.3), because the M1 gate needs the contract tests green. No browser and no engine. M2 wires them to real runs.
- The agent that defines the contract stubs the function bodies. A second agent implements them and a third writes the contract tests, from the spec and the types only.
- Entries are one JSON file per test, `src/rulesets/rgaa-4.1.2/coverage/<theme>/<test id>.json`. Citations are verbatim quotes that a script checks against the vendored files.
- Meaning of the prerequisites (spec 17.1), to report to Fabien at the gate: `state` is met only on an established declared state other than `initial`; `keyboard` only when the engine completed a keyboard pass on the target; `media` only when it completed a timed observation pass; neither pass exists yet. `model` is never met for deriving a status. `assistive_tech` is never met in v1.
- Entry writers work from generated theme packets (`pnpm packets`, into the gitignored `work/packets/`), not from the raw files.

## Findings to report at the gate

- Builder B's claims, for the cross-check: 8.5.1 `full` (fault only when no HTML title exists anywhere; passed only on a first title in head with a letter or digit; frames abstain); 8.2.1 `fail_only` on duplicate ids, hidden elements included; 8.10.1 `fail_only` faults right-to-left text with no `dir` ancestor, a single Arabic name in French text included, by the wording « chaque texte », where an auditor following WCAG H56 might not; 8.10.2 `fail_only` treats `dir="auto"` as not « conforme (rtl ou ltr) ». Builder B listed 8.10.1 among its least sure, against the guide's rule; the orchestrator kept it because the doubt is about auditors' practice, not the official text. Codex should rule.
- Builder D's claims, for the cross-check: 9.1.2 `fail_only` treats an empty, exposed `<hx>` as a heading whose content cannot be relevant; 9.2.1 `fail_only` through two checks, one of which (`custom/9-2-main-missing`) faults a page with no `<main>` by reading the glossary's « Cette zone est unique dans la page » as "every page has one". Builder D listed that check as its least sure; it offers `evidence_only` as the fallback, which would keep 9.2.1 at `fail_only` through `custom/9-2-main-multiple-shown`. Codex should rule.
- Builder C's claims, for the cross-check: 11.2.1, 11.2.2, 11.2.3 `fail_only`, each on an empty label mechanism (`<label>`, `title`, `aria-label`) that is the field's only one, read as failing 11.2.x because 11.1.1 asks only for presence. 11.2.4 stays `none`: the glossary does not say whether an empty referenced element is a « passage de texte ». Check that this reason is not "another test owns it".
- Schema limits reported by builder C: no prerequisite expresses a multi-page comparison (11.3.2); one check returns one page result, so it cannot serve two requirements over different elements.
- Builder E (theme 3, all `none`): the glossary says a doubled means makes criterion 3.1 « non applicable », the methodology says the test is « validé »; E followed the methodology (no effect at `none`). E linked axe `color-contrast` to the untagged 3.2.2 to 3.2.4 as evidence only, and added `media` to 3.2.1 to 3.2.4 (text in videos is in scope by the glossary).
- Builder F (theme 5, all `none`): data and layout tables are defined by purpose, so no table is surely in scope. F put `assistive_tech` in `needs` on tests where the glossary counts an ARIA table only « lorsqu'il est correctement restitué par les technologies d'assistance »; that need depends on the page, which `needs` cannot express. 5.1.1 keeps `aria-describedby` as a route (methodology) although the technical note says it lacks support.
- Builder G (4.2 to 4.13, all `none`): 4.3.2 has a resolving check (every `<track>` is `kind=captions`) but was lowered to `none`, because "passed" would also be given where the test does not apply (a live, video-only or decorative media). The contract cannot say "this requirement holds whether or not the test applies". No prerequisite covers examining another page, such as the target of an "alternative" link (4.8.1, 4.8.2). The 4.3.2 methodology spells `kind="caption"`, which HTML does not define; G followed the wording, `captions`.
- Builder H (theme 13): 13.2.1 `fail_only` through `custom/13-2-window-opened-without-action` (a window opened during load, before any engine action, verified by `navigator.userActivation.hasBeenActive`; scope partial). 13.1.2 stays `none`: its particular case makes even an immediate redirect « non applicable » by judgment. `needs` has no prerequisite for a second screen orientation (13.9.1), touch gestures (13.10), device motion (13.12) or downloaded files analysed with outside tools (13.3.1, 13.4.1).
- Builder D linked axe list rules to 9.3.2 though axe does not tag them for it (evidence only). The guide allows links on an argued basis; an axe tag justifies a link but is not required.
- Tests 8.1.1 to 8.1.3 turn on the served source, which v1 does not read (spec 15, Q9). They stay `none`.

- Builder A: `needs` applies to a whole test, but the glossary makes assistive technology a condition of one route (Note 6 of "Alternative textuelle (image)": a `title` alternative is confirmed with assistive technology). Writers put it in the rationale as a reason no 1.1 entry can be `full`. A guide rule on route-conditional needs would settle it.
- Builder A added to 1.1.1, 1.1.5 to 1.1.8 the exceptions for an image that is the only content of a link or a button (notes of "Image porteuse d'information"), and gave axe `object-alt` scope `partial` on 1.1.6. Both lower claims; neither contradicts spec 6.1 and 6.2.

- The pilot's cross-check: the two entries that over-claimed were the two the writer listed as least sure. The guide now tells writers to lower any claim they doubt.
- The orchestrator read 8.3.1 before Codex did and did not see the hole in its list of texts. Its own review is not a substitute for the cross-check.
- Spec 10.4 could not be met by a test that always applies. Fixed by decision Q40 (`always`).

- Spec 6.1 says a `none` entry is "always needs review", but 8.3 gives `not_tested` at any level when the target was not established or a check errored. The contract follows 8.3.
- The first row of the 8.3 case table ("an advisory fault, no resolving check") cannot occur on a `full` entry: 6.2 requires a resolving link for every requirement. It occurs only below `full`.

- Spec 8.5 says a reason is required "unless passed or failed", but 8.2 gives no reason list for `not_applicable`. The contract follows 8.2.
- The contract's first draft hid a failure in one corner of the process rule (a step whose page as loaded was not established but whose declared state failed). Found in the orchestrator's review and amended before the freeze.
- An unlogged lowering of `enabled` makes an entry run as `none`, not at the lower level. Stricter than the spec's wording, and safe.

- One glossary anchor in the official data resolves to nothing: `#table-descriptions-techniques`, in a technical note of criterion 5.1. The other 115 resolve. The packet for theme 5 lists it.

## Open points for Fabien

None.
