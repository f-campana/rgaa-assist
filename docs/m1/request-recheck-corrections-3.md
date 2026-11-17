# Request: Codex's focused re-check of the corrections after the cross-check

From the M1 orchestrator, 2026-11-17. Read-only, as before: edit nothing in the repo. Write your report to your outputs folder and message the orchestrator on the bridge channel when it is there.

## Where

`~/Documents/rgaa-assist`, main at `8260d67`. Diff to review: `git diff ae6a208..8260d67 -- src/rulesets/rgaa-4.1.2 docs/decisions.md`. Your cross-check was at `ae6a208` (coverage `ff4d6c2`). Levels are now none 238, fail_only 16, full 4; every `enabled` is `none`. 414 tests pass; 258 of 258 entries are valid.

Fabien ruled on four readings: Q45 to Q48, at the end of `docs/decisions.md`. The orchestrator accepted every confirmed finding. Two builders applied the corrections from `docs/m1/brief-corrections-3.md`.

## What changed

- **Lowered to `none`, links kept as evidence only:** 10.13.2 (F01), 10.12.1 (F02), 10.11.1 (F03), 10.6.1 (F04), 9.2.1 (F05, F06), 6.1.5 (F20), 1.9.1 to 1.9.5 (F07, Q47), 11.2.2 and 11.2.3 (F08, Q48). Also 1.1.3 (F18): browsers give an image button with no author source a default name, so the safeguard you proposed would leave nearly every case unclaimed, and the writer lowered the entry instead.
- **Narrowed and kept:**
  - 11.9.1 `fail_only` (F09, Q45). Only buttons proven to be in a form, including through a `form` attribute. Any non-empty name the browser exposes, a default one included, gives `cannot_tell`. Two fault branches are written apart: no labelling source at all (rests on Q45), and a present but blank source. A form-associated custom element gives `cannot_tell`.
  - 10.5.2 `fail_only` (F10, Q46). The winning author background must be a literal colour, recorded in the witness. It abstains on CSS-wide keywords, `currentcolor`, system colours, `light-dark()`, and any `color`, `-webkit-text-fill-color` or `all` declaration in the chain. It also abstains on `::first-line` and `::first-letter` colours and on user-agent colour rules.
  - 8.10.2 `fail_only` (F11). It faults only `dir="auto"` that demonstrably sets an RTL passage inside an LTR parent, with no author `direction` or `unicode-bidi` in between. Invalid tokens, empty values, and `auto` that resolves LTR give `cannot_tell`.
  - 10.1.2 `full` (F12). The order of decision is now stated: a fault wins, then `cannot_tell` for the abstained pairs (width or height on iframe, video, input or source; `color` on link; listed names set with a namespace), then `no_fault`.
- **`none` entries rewritten** (F13 to F17, F19, and the same patterns elsewhere):
  - 3.1.1 to 3.1.6: the other means must be usable by people who don't see colours.
  - 4.11.2, 4.11.3, 4.12.1, 4.12.2 and 7.3.1: the shortcut route covers the keyboard side only.
  - 4.3.2: the check never answers `no_fault`.
  - 10.5.3: one route, with legibility as separate evidence.
  - 11.9.2: one requirement, with the other reading in prose.
  - 7.1.3: name relevance and containment are separate requirements.

## What to check

1. Does each narrowed check now give faults only under any reading, given Q45 and Q46 where they apply? Does 10.1.2's order leave a coherent pass, fault and abstention for each branch?
2. Is each lowering complete? No link left as `failure`, and no record still claiming what the finding disproved.
3. Are the `none` write-ups faithful to the official text, with no reading silently chosen?
4. Open points the writers left, for your view:
   - 11.9.1 still holds the effective-name reading and the every-present-source reading as two requirements. Only the name-relevant one is linked.
   - In 11.9.2 and 10.5.3 the methodology's reading is the structured requirement and the wording's reading is in prose, as in 11.2.5. No decision covers that choice.
   - 10.6.1, 11.2.2 and 11.2.3 keep links with whole scope covering every route, so they still meet the definition of a resolving link. None of their checks answers `no_fault`.

After your answer, the orchestrator proposes the minimum useful set and builds the gate package for Fabien.
