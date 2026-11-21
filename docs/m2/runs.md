# M2 runs: PremiumShot home page, and Aubay's careers page compared with the dry run

**2026-11-20, rerun 2026-11-21.** Written by the M2 orchestrator. Both runs were first made with `rgaa-assist audit` at main `e2b4ae7` (a `.dirty` tool version: the sample files were not yet committed). After the Q56 corrections (`custom/10-1-presentation-attributes` 1.0.1, editable boxes dropped from snippets), both were run again at `3d80b49`, tool version `0.0.0+git.3d80b49…` with no `.dirty`, once more after the Q57 fixes at `49a0987` (11.8.2 abstains on an unmeasured `clip-path`; four 10.1.2 pairs added), and after the Q59 fixes at `a7e7851` (11.8.2 needs positive evidence of visibility; `height` on `table` is a 10.1.2 fault), and after the Q60 fixes at `6e53a70` (rounded inset unmeasured; editable text never a witness or in a snippet). Every rerun file validates; every observation outcome, every finding count and every redaction count below is unchanged by the rerun. Each page was loaded once, as a visitor, in a fresh Chromium context: no steps, no cookie choice, no form submitted, no saved session.

Nothing is enabled (every entry `enabled: none`), so every finding of both runs is `needs_review` or `not_tested`. That is the expected result, not a defect. Nothing here says anything about the conformance of either site. Status letters are not used.

The run folders are kept out of git, under `work/m2/runs/` (gitignored). For Aubay this is required by Q53; for PremiumShot it keeps one rule for both. This note quotes no more of either page than locators and short snippets.

## What both runs show about the engine

| | PremiumShot | Aubay |
|---|---|---|
| Sample | `samples/premiumshot-m2.json` (committed) | `work/m2/samples/aubay-m2.json` (gitignored) |
| Exit code | 0 | 0 |
| Run file against `RunFileSchema` | valid (checked again outside the engine) | valid (checked again outside the engine) |
| Target | `home/initial`, established, requested and effective URL equal | `careers/initial`, established, requested and effective URL equal |
| Viewport requested and applied | 1280×800, 1280×800 | 1280×800, 1280×800 |
| Observations | 77 (67 axe, 10 custom), none `error` | 77 (67 axe, 10 custom), none `error` |
| Outcomes | inapplicable 41, no_fault 30, cannot_tell 5, fault 1 | inapplicable 29, no_fault 34, cannot_tell 4, fault 10 |
| Findings (258 tests) | needs_review 214 (no_check 164, not_enabled 34, assistive_tech_required 16), not_tested 44 (missing_observation) | the same counts |
| Redactions counted | 1 | 57 (mostly query values of the reCAPTCHA frame's address) |
| Sample warnings | 7 (six fixed page kinds missing, too few random pages: expected for a one-page sample) | 7 (the same kinds) |
| Time | about 3 s | about 4 s |

- **Manifest, both runs:** tool version, ruleset `rgaa-4.1.2` 4.1.2 at source commit `ca4019f`, coverage-map hash `e686fe984b66…`, approval-log hash `ee4bf8d62f17…`, evaluation-summary hash `null` (no summary is published yet), axe-core 4.14.0, Playwright 1.64.1, Chromium 156.0.8078.4, Darwin 25.6.0 arm64, locale `fr-FR`, timeouts (navigation 30000, settle 5000, frame probe 2000, provider 60000 ms), options for all 77 checks, sample-file hash, start and end time, `model: null`.
- **`not_tested` / `missing_observation` (44 tests):** these tests link a check that is not built yet (48 of the 58 custom checks). That is what spec 8.3 step 2 says for a missing observation.
- **No test was decided** (`testsDecided: 0` in the statements): nothing is enabled.

## PremiumShot home page (`https://premiumshot.app/`)

The ten custom checks of the minimum useful set:

| Check | Outcome | What it saw |
|---|---|---|
| `custom/8-5-page-title-present` | no_fault | a `title` child of `head` with qualifying text |
| `custom/10-1-presentation-elements` | no_fault | no listed element anywhere read |
| `custom/10-1-presentation-attributes` | cannot_tell | `width` and `height` on four `picture > source` elements: the record's abstention on `width`/`height` on `source` (step 2) |
| `custom/11-8-optgroup-label-attribute` | inapplicable | no `optgroup` in a `select` |
| `custom/8-3-default-lang-present` | no_fault | `lang="en"` on `html` |
| `custom/8-4-default-lang-code-valid` | no_fault | `en` is in the pinned ISO 639 list |
| `custom/2-1-frame-title-attribute` | inapplicable | no frame element |
| `custom/6-2-link-content-name` | no_fault | 16 links, each with a name from content |
| `custom/11-1-field-label-mechanism` | cannot_tell | one field, `input#compare-range`, labelled by `aria-label` (step 3: the check does not judge whether a present mechanism is sufficient) |
| `custom/8-2-id-duplicate` | cannot_tell | 19 ids, no duplicate; the check never answers no_fault (step 4) |

- The one fault of the run is axe's `label-content-name-mismatch` on `#theme-toggle`. Its links are evidence only, so it changes no finding.
- **For Fabien:** 10.1.2's abstention on `width`/`height` on `source` is exactly the record. It means a responsive-image page like this one gets "needs review" on 10.1.2 even with no presentation attribute in the sense of the methodology. The methodology's exception list names img, object, embed, canvas and svg, not source.

## Aubay careers page, compared with the dry run

The dry run (`docs/m1/dry-run-aubay.md`, 2026-11-18) applied the ten check records by hand to the same page. Here the code's observation outcomes are compared with the outcomes the dry run reached, check by check. Findings are not compared, since nothing is enabled.

| Check (test) | Dry run, by hand | Code, 2026-11-20 | Same outcome? | Detail |
|---|---|---|---|---|
| `custom/8-5-page-title-present` (8.5.1) | no_fault, if the engine reads the reCAPTCHA frame | no_fault | yes | The engine read the frame (see below); its title qualifies. |
| `custom/10-1-presentation-elements` (10.1.1) | no_fault, if the frame is read | no_fault | yes | Nothing listed in the four documents read. |
| `custom/10-1-presentation-attributes` (10.1.2) | fault: `frameborder="0"` on the reCAPTCHA `iframe` | fault: `frameborder` on `html > body > div:nth-of-type(4) > div > div:nth-of-type(1) > iframe`; since Q59 (run at `a7e7851`), also `height` on a `table` | yes | Same element. The fault wins over the abstentions also present (`width`/`height` on that `iframe`), as Q49 and the record say. The `height` on `table` the dry run noted (it then expected an abstention, per the gate package) is a fault since Q59; the outcome is the same. |
| `custom/11-8-optgroup-label-attribute` (11.8.2) | inapplicable, if the frame is read | inapplicable | yes | No `optgroup` in a `select` in the four documents. |
| `custom/8-3-default-lang-present` (8.3.1) | no_fault (`lang="fr-FR"` on `html`) | no_fault | yes | Step 1; the one rendered frame was read and did not change it. |
| `custom/8-4-default-lang-code-valid` (8.4.1) | no_fault (`fr` in ISO 639-1) | no_fault | yes | |
| `custom/2-1-frame-title-attribute` (2.1.1) | cannot_tell: one titled `iframe`, one untitled `iframe` not rendered (step 4) | cannot_tell: one titled, **two** untitled not rendered (step 4) | yes | The second untitled `iframe` is inside the reCAPTCHA frame (`… iframe >>> html > body > iframe`, `about:blank`, `display: none`). The dry run did not look inside the cross-origin frame for frames. Explained by the engine reading more of the page than the dry run did, not by a departure from the record. |
| `custom/6-2-link-content-name` (6.2.1) | cannot_tell: five social links named only by `aria-label` and `title` | cannot_tell: the five social links at **step (3)**, and 16 links of closed submenus at step (2) | yes | **Different step.** The social links (`…ul > li > a.icon`, `title="Lien vers notre Twitter"` and four more) draw their icon with CSS generated content. The record's step (3) (generated content) comes before step (4) (a name from `aria-label` or `title`), so the code stops at (3). The dry run applied (4) and did not check `::before`: the dry run misapplied the record's order. The 16 submenu links are inside closed menus (`ul#submenu-0`, `ul#submenu-3`, …), not rendered, so their content is skipped and step (2) abstains; the dry run did not list them. Neither changes the outcome. |
| `custom/11-1-field-label-mechanism` (11.1.1) | fault: three `input.awsm-selectric-input` fields | fault: the same three fields (`<input class="awsm-selectric-input" tabindex="0">`) | yes | 60 fields and related elements examined in four documents. |
| `custom/8-2-id-duplicate` (8.2.1) | fault: two `div` with `id="formulaire"` | fault: the same pair, footer section first, then `#nf-field-96-wrap > div:nth-of-type(2) > div` | yes | |

**Counts, out of ten checks:**
- Same outcome as the dry run: 10 of 10.
- Same outcome and the same elements: 7 of 10 (8.5.1, 10.1.1, 11.8.2, 8.3.1, 8.4.1, 11.1.1, 8.2.1; the frame-dependent three hold because the frame was read).
- Same outcome, more elements or another step: 3 of 10 (2.1.1: a frame inside the cross-origin frame; 6.2.1: step (3) instead of (4), plus closed-menu links; 10.1.2: since Q59 it also faults `height` on a `table`, which the dry run saw and classed as an abstention) (Q60).
- Departures of the code from a record: none found.
- Changes in the page since 2026-11-18 that changed an outcome: none found.

**Dry-run finding 6 (does the engine read the reCAPTCHA frame?):** yes. The checks that read frames examined four documents: the main document, the reCAPTCHA anchor frame (`https://www.google.com/recaptcha/api2/anchor?…`, query values masked), an `about:blank` frame inside it, and the page's own `about:blank` frame. No frame was unreadable. So the three results that depended on it (8.5.1, 10.1.1, 11.8.2) stand without the "if".

**What this comparison shows and does not show.** On one page, the code gives the outcomes that a person applying the same records by hand reached two days earlier, and the one place where they differ in reasoning (6.2.1) is the hand application skipping a step. It does not show that the records are right, that the auditor was wrong, or anything about other pages.

## Axe on Aubay (evidence only)

Faults reported by axe on the Aubay page: `aria-allowed-attr`, `color-contrast`, `label`, `label-content-name-mismatch`, `meta-viewport`, `p-as-heading`, `region`. Their links to the ten tests are all `evidence_only`, so they change no finding. `axe/label` faulting beside `custom/11-1-field-label-mechanism` is consistent with the three unlabelled fields.
