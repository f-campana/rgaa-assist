# M1 gate package

**Draft, 2026-11-18.** Prepared by the M1 orchestrator for Fabien. Codex has confirmed the last corrections. One correction remains before the gate: 10.1.1 (builder S, `docs/m1/brief-corrections-5.md`), then Codex's focused re-check of it. The sections marked *pending* depend on that.

Approving M1 approves the candidate map, the minimum useful set and the schemas. It enables nothing: every entry has `enabled: none`. No figure here is a conformance rate.

## Where it stands

- Main at `0c26254`. All 258 entries validate and cite the official text (DINUM RGAA 4.1.2, pin `ca4019f`). 414 tests pass, including the contract tests of 8.3, 6.3 and 8.4. The type check is clean. There are 125 check records, all `exists: false`.
- Codex has cross-checked all 258 entries (131 in depth, 127 on inventory and validation), re-checked the corrections and confirmed the last round at `cc2955b`: no other capability blocker. *Pending: the 10.1.1 correction and its re-check.*
- The orchestrator reviewed every diff before merging it.

## Counts by candidate level

| Theme | none | fail_only | full |
|---|---:|---:|---:|
| 1 Images | 59 | | |
| 2 Frames | | 2 | |
| 3 Colours | 15 | | |
| 4 Multimedia | 25 | | |
| 5 Tables | 15 | | |
| 6 Links | 5 | 1 | |
| 7 Scripts | 11 | | |
| 8 Mandatory elements | 7 | 5 | 1 |
| 9 Structure | 8 | 1 | |
| 10 Presentation | 25 | 2 | 2 |
| 11 Forms | 29 | 4 | 1 |
| 12 Navigation | 19 | | |
| 13 Consultation | 20 | 1 | |
| **Total** | **238** | **16** | **4** |

- **`fail_only`:** 2.1.1, 2.2.1, 6.2.1, 8.2.1, 8.3.1, 8.4.1, 8.10.1, 8.10.2, 9.1.2, 10.5.1, 10.5.2, 11.1.1, 11.2.1, 11.8.3, 11.9.1, 13.2.1.
- **`full`:** 8.5.1, 10.1.1, 10.1.2, 11.8.2.

## Proposed minimum useful set

Taken from the claims argued most firmly: each one has a definite fault that Codex confirmed at its cross-check, and none rests on a contested reading. A test on this list must be enabled at the level shown before v1 can be accepted (spec 6.4, 10.4 point 5).

| Test | Level | Why |
|---|---|---|
| 8.5.1 Page has a title | full | Codex named it as a coherent `full`. A title element with a letter or digit passes, none at all fails, and frames abstain. Every page is in scope (`always`). |
| 10.1.1 No presentation elements | full | Codex named it as a coherent `full`. The methodology gives a closed list of elements. *Condition: the case-matching point under "Unsure" is fixed first.* |
| 11.8.2 Option groups have a label | full | Codex named it as a coherent `full`. It is the only `full` entry with `structural` applicability, so the gate exercises the "not applicable" branch. |
| 8.3.1 Default language present | fail_only | Went through three Codex re-checks in the pilot. `always` applicability. |
| 8.4.1 Default language code valid | fail_only | Confirmed. The fault is narrow: an invalid primary code checked against a pinned ISO list. |
| 2.1.1 Frames have a title | fail_only | Confirmed. The fault is a rendered, exposed frame with no `title` attribute at all, decided per element. An empty `title` gives "can't tell"; that case belongs to 2.2.1. |
| 6.2.1 Links have a name | fail_only | Confirmed. The fault is a link with empty content. Anchors and uncertain script links are excluded. |
| 11.1.1 Fields have a label | fail_only | Confirmed after a pilot correction. The fault is an exposed native field with no labelling mechanism at all. |
| 8.2.1 Unique ids | fail_only | Confirmed. The fault is duplicate `id` values in the top document. |

**Left out, and why:**
- **10.1.2** was corrected twice: once for the order of its decisions, once for upper- and lower-case attribute names. It can join the set after Codex confirms R2.
- **11.9.1, 10.5.2, 8.10.1 and 8.10.2** rest on a ruling or a disputed reading: Q45, Q46, « chaque texte » against WCAG H56, and `dir="auto"`.
- **13.2.1** needs evidence of the page lifecycle before it is enabled, as Codex noted.
- **2.2.1, 9.1.2, 10.5.1, 11.2.1 and 11.8.3** are sound but add little: each covers a narrow case or a rare element.

## Ten entries to spot-check

These are the entries where a wrong reading would matter most: the four that can say "passed", and the claims that rest on a reading. Each file holds its rationale and quotes.

1. [8.5.1](../../src/rulesets/rgaa-4.1.2/coverage/08/8.5.1.json) `full`: whether a title is relevant is left to 8.6.1. Here, a letter or digit counts as present.
2. [10.1.1](../../src/rulesets/rgaa-4.1.2/coverage/10/10.1.1.json) `full`: hidden elements count, because the test is about the source and not the rendering. `u` is allowed under the HTML 5 doctype.
3. [10.1.2](../../src/rulesets/rgaa-4.1.2/coverage/10/10.1.2.json) `full`: a closed list of attributes. In order of decision: a fault wins, then the pairs it abstains on (for example `width` on `iframe`), then "no fault".
4. [11.8.2](../../src/rulesets/rgaa-4.1.2/coverage/11/11.8.2.json) `full`: an empty `label` attribute counts as present, and its emptiness is left to 11.8.3. A `select` outside a form answers "can't tell".
5. [11.9.1](../../src/rulesets/rgaa-4.1.2/coverage/11/11.9.1.json) `fail_only`: a button in a form with an empty accessible name fails, by Q45, despite « S'il est présent ».
6. [10.5.2](../../src/rulesets/rgaa-4.1.2/coverage/10/10.5.2.json) `fail_only`: the test follows its wording and not the methodology step copied from 10.5.1 (Q46). It abstains on any animated colour.
7. [8.10.1](../../src/rulesets/rgaa-4.1.2/coverage/08/8.10.1.json) `fail_only`: following « chaque texte », a single Arabic name inside French text needs `dir`. An auditor following WCAG H56 might not ask for it.
8. [8.10.2](../../src/rulesets/rgaa-4.1.2/coverage/08/8.10.2.json) `fail_only`: `dir="auto"` that actually makes a passage right-to-left is not « conforme (rtl ou ltr) ».
9. [11.1.1](../../src/rulesets/rgaa-4.1.2/coverage/11/11.1.1.json) `fail_only`: it faults only a field with no labelling mechanism. Whether a label is relevant is left to other tests.
10. [13.2.1](../../src/rulesets/rgaa-4.1.2/coverage/13/13.2.1.json) `fail_only`: a window opened during load, before the engine has done anything, counts as opened without a user action.

## What Codex found and what was done

- **Cross-check of all 258 entries:** hold.
  - It found seven failure-inference defects across six entries, three of them shown in a browser (F01 to F06, F20).
  - Ten claims depended on unresolved readings (F07 to F11, F18).
  - It found one conflict in a `full` entry (F12) and seven write-up defects in `none` entries (F13 to F17, F19).
  - Errors by kind of entry, among the 34 claims above `none`: 7 confirmed and 11 unresolved, and 16 with no finding. Its table by kind (axe-linked, several routes, needs, structural, other) is in its report.
- **What was done:**
  - You ruled on Q45 to Q48.
  - 14 claims were lowered to `none`, with their links kept as evidence: 10.13.2, 10.12.1, 10.11.1, 10.6.1, 9.2.1, 6.1.5, 1.9.1 to 1.9.5, 11.2.2, 11.2.3 and 1.1.3.
  - Four checks were narrowed and kept: 11.9.1, 10.5.2, 8.10.2 and 10.1.2.
  - 15 `none` entries were rewritten.
- **Re-check:** the lowerings are contained, and 11.9.1, 8.10.2 and the rewrites hold. Two narrowed checks still needed a fix:
  - R1: 10.5.2 missed a colour supplied by a CSS animation.
  - R2: 10.1.2 ignored case where XHTML doesn't.

  Both were fixed at `cc2955b`, along with the wording it asked for.
- **Confirmation of the last round (2026-11-18):** R1 and R2 are closed, with browser fixtures for each. The wording follow-through is in place. It holds the decision on one point: 10.1.1 matches element names ignoring case (the orchestrator had found the same in its draft). Being corrected by builder S. It also corrected this draft's 2.1.1 line: an empty frame `title` gives "can't tell" there, and belongs to 2.2.1.
- **Errors in the orchestrator's own work:**
  - It summarised 10.5.3 and 11.2.5 wrongly in the status file. Codex caught it, and it is corrected.
  - It kept builder M's 10.13.2 after one fix, and Codex's browser probe then defeated that fix.

## Meanings of `state`, `keyboard` and `media`

From `PREREQUISITE_MEANING` in `src/rulesets/contract.ts`:
- **`state`** is met only on an established declared state other than `initial`. So a test that needs it is "needs review" on every page as loaded, and never "passed" or "not applicable" on the strength of a declared state alone.
- **`keyboard`** is met only when the engine has completed a keyboard pass on the target: focus moved through the tab sequence, and the sequence was recorded.
- **`media`** is met only when the engine has completed a timed observation pass with media allowed to play.
- Neither of those two passes exists yet, so both are unmet until they are built. `model` is never met for a status, and `assistive_tech` is never met in v1.

## Cost

Figures are shares of the Claude Pro weekly all-models limit (`docs/cost-log.md` has every step).

| Role | Model, effort | Tokens | Share of the weekly limit |
|---|---|---|---|
| Orchestrator, day 1 | Fable 5.2, high | not measured | The Fable limit rose 27 points (2% to 29%). It was the largest single cost on day 1. |
| Orchestrator, from 11-17 | Opus 5.5, high | not measured | Included in the total below. |
| Core builders (24 runs) | Opus 5.5, high | about 5.3M | Most of the total. |
| Core builder (1 run) | Opus 5.5, medium | about 0.1M | Small. |
| Module builders (5 runs) | Sonnet 5.5, medium | about 0.47M | Small. |
| Reviewer | Codex | Codex's own plan | Not counted. |

- **Total:** about 78 points of the weekly all-models limit: 52 before your limit reset on 11-17, 26 after it. That is an upper bound, because other work of yours fell in the same windows.
- **What the work cost:**
  - Foundations (schemas, contract, implementation, tests and tooling): about 18 points.
  - Entries: 0.1 to 0.29 point each, depending on whether a claim was made.
  - Each correction cycle after a Codex review: 5 to 11 points.
- **API-equivalent cost:** not computed. The builders report one token total, with no split between input, cached input and output, so any dollar figure would be a guess.
- **Proposed M2 ceiling:** 40 points of the weekly all-models limit, with a check-in at 20.
  - M2 builds code (the engine on one page, the axe adapter, and derivation wired to a real run), not 258 entries. It is closer to M1's foundations (18 points) plus two review cycles (10 to 20).
  - A fresh Opus orchestrator session, kept short, avoids paying again for a long context.

## Unsure, and open

- **10.1.1 compares element names ignoring case.**
  - In an XHTML page served as XML, `<CENTER>` is not the `center` element, yet the check faults it. This is the pattern R2 fixed for attributes in 10.1.2.
  - The orchestrator found it on 2026-11-18, after the last round was sent to Codex. The proposed fix is the same as R2: such a variant answers "can't tell".
  - It is a one-entry correction, to be made before the gate.
- **Gaps in the schema, recorded and not settled:**
  - A prerequisite that applies to one route only, not the whole test.
  - Evidence from another page: a link target, another page of the sample, or a downloaded file.
  - No structured place for divergent official readings: they are kept in prose.
  - The order of checks that change the page.
  - No prerequisite for hover, a viewport width, styles off, zoom, a second orientation or JavaScript off.
  - One check result serving several requirements.
- **Open readings on `none` entries:**
  - 10.5.3 (wording against legibility).
  - 11.9.2 and 11.2.5 (effective name against every present source).
  - 7.3.1 (one control or two).
  - Caption necessity for 1.9.x (Q47).
  - Whether a blank attribute brings a field into scope for 11.2.2 and 11.2.3 (Q48).
  - 3.1.x (not applicable, against validated).
  - None of these affects a claim today.
- **Source oddities:**
  - The methodologies of 12.4.2 and 12.4.3 are swapped against their wordings.
  - One glossary anchor (`#table-descriptions-techniques`) resolves to nothing.
  - 10.5.2 and 11.10.6 copy a methodology step from a neighbouring test.
  - Writers followed the wording each time.
- **The weakest point** is unchanged (spec 17.2): no trained RGAA auditor has read these entries. Your spot-check and Codex's review are the only checks.
