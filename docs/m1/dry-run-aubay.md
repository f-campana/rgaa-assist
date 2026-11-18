# Dry run: the proposed set against a published audit

**2026-11-18.** Prepared by the M1 orchestrator as an annex to the [gate package](gate-package.md), at Fabien's request. Nothing here runs code from this repository. All 125 checks are still `exists: false`. The ten entries of the proposed minimum useful set were applied **by hand**: what each check record says it would answer, reproduced with scripts typed into a Chromium page. This tests our readings against an auditor's, not our code.

## Sources

- **Audit:** a full RGAA 4.1.2 audit made in ARA, created on 2026-06-04 and published on 2026-08-06. Report: https://ara.numerique.gouv.fr/rapport/6j4x9rUQikBzyJ3a1NI76/. Its data comes from ARA's public API (`/api/reports/<id>`).
- **Page:** https://aubay.com/carriere-accueil/, the audit's only page. The sample also lists "éléments transverses".
- **Page examined:** the live page on 2026-11-18, rendered in the built-in browser (Chromium) with scripts on.
- **Drift check:** the source of the Wayback snapshots from 2026-06-17 and 2026-08-12, compared as source only. The snapshots were not rendered.

## Results

C, NC and NA are the auditor's results by criterion. The tool's statuses are local results for one test (spec 2, point 8).

| Test | Level | Expected tool result | Audit | Agreement |
|---|---|---|---|---|
| 8.5.1 | full | **passed** if the engine reads the reCAPTCHA frame, **needs review** if it can't (finding 6). One `title` in `head`, "Rejoindre Aubay - Aubay"; the frame's own title is "reCAPTCHA". | 8.5 C | Agrees |
| 10.1.1 | full | **passed** if the engine reads the frame, **needs review** if it can't (finding 6). No listed element in the page or in the frame; no `noscript`, `template` or shadow tree. | 10.1 C | Agrees |
| 10.1.2 | full | **failed**: `frameborder="0"` on an `iframe` (the reCAPTCHA badge) | 10.1 C | **Disagrees** (finding 2) |
| 11.8.2 | full | **not applicable** if the engine reads the frame, **needs review** if it can't (finding 6). No `optgroup` in the page or in the frame. | 11.8 NC | Not a disagreement (finding 4) |
| 8.3.1 | fail_only | needs review: `lang="fr-FR"` on `html`, no fault | 8.3 C | Agrees |
| 8.4.1 | fail_only | needs review: `fr` is in ISO 639-1, no fault | 8.4 C | Agrees |
| 2.1.1 | fail_only | needs review: one `iframe` titled "reCAPTCHA"; one untitled `iframe` that isn't rendered (step 4) | 2.1 C | Agrees |
| 6.2.1 | fail_only | needs review: five social links named only by `aria-label` and `title` (step 2 of the check) | 6.2 C | Agrees (finding 5) |
| 11.1.1 | fail_only | **failed**: three `input.awsm-selectric-input` fields, focusable, with no labelling mechanism | 11.1 NC, blocking | **Agrees on the fault** (finding 1) |
| 8.2.1 | fail_only | **failed**: two `div` elements with `id="formulaire"` | 8.2 NC | Same status, different fault (finding 3) |

**Counts over the ten tests:**
- 7 agree with the audit's result for their criterion.
- 1 agrees on the same fault the auditor describes (11.1.1).
- 1 has the same status for a different fault (8.2.1).
- 1 disagrees, on a `full` entry (10.1.2).
- 1 has no comparable result (11.8.2).
- There is no case of possible false assurance: no "passed" where the auditor found NC.

## Findings

1. **11.1.1: the tool would find the auditor's blocking fault.**
   - **What the auditor reports:** the fields of the job filters have no label, and a screen reader announces "vide" ("blank").
   - **What the page shows:** the plugin's script replaces each `select` with its own widget. Each widget holds an `<input>` with no `type`, `tabindex="0"`, visually hidden with `clip: rect(0,0,0,0)`. It has no `aria-label`, `aria-labelledby`, `title`, associated `label` or `label` ancestor. Under step 2 of the check, that is a fault.
   - **At audit time:** the August snapshot loads the same widget script.
   - **Why it matters:** only a check that reads the page as rendered sees this field. It isn't in the page's source.

2. **10.1.2 (`full`): the tool says "failed" where the auditor says C.**
   - **What the page shows:** the reCAPTCHA badge `iframe` carries `frameborder="0"`. "frameborder on iframe" is a defined pair in the check record, so step 1 faults it. Google's script inserts this `iframe`, not the site's own code.
   - **At audit time:** the June and August snapshots load the reCAPTCHA script, so the `iframe` was very likely present. This isn't proven. Codex tried to render the snapshots: the August one stayed partly loaded, with no reCAPTCHA `iframe`, and the June one was offline. Codex calls that a failed reconstruction, not evidence that the `iframe` was absent.
   - **Codex's reading:** keep the fault. The `iframe` element and its attributes belong to the page that embeds it, whoever inserted it. What's inside a cross-origin frame is a separate question of scope, where abstaining makes sense.
   - **By the letter:** the fault is defensible. The attribute is on the RGAA list, the test is about the generated source, and the audit declares no content out of scope.
   - **In practice:** the auditor didn't count it. Either they treated third-party markup as outside the test, or they didn't inspect inserted `iframe`s.
   - **For your decision:** should 10.1.2 abstain on markup that a third-party script inserts? Code can't reliably tell who inserted an element. One rule code can apply is to abstain on attributes of `iframe` elements whose document is cross-origin. Lowering the entry to `fail_only` wouldn't help, because the disagreement is about a fault.
   - **A second, smaller point:** `height="29"` on a `table` isn't among the check record's examples. The record defers to "HTML 4.01 or the current HTML standard". HTML 4.01 doesn't define `height` on `table`; the HTML standard's rendering section maps it as a presentational hint. The builder needs a stated rule here. It doesn't change the result on this page, because the `frameborder` fault already decides it.

3. **8.2.1: the same status for a different fault.**
   - **The auditor:** NC, for a duplicated attribute on one element. The browser's parser drops a duplicate, so a check that reads the DOM never sees it. The entry's rationale already says so.
   - **The tool:** faults two `div` elements with `id="formulaire"`. The page's source holds only one; the second, an empty `div`, is inserted by a script.
   - **What we can't tell:** whether the auditor missed the duplicate `id` or the script added it after the audit.
   - **What it shows:** the comparison has to be made per fault, not per criterion.

4. **11.8.2: not applicable, against NC on 11.8.**
   - **The auditor's comment:** it asks for the options to be grouped in `optgroup` with a label, across the three lists.
   - **Which test that is:** grouping options is test 11.8.1. Whether these options need grouping at all is a reading we don't make. 11.8.2 only asks that an existing `optgroup` has a `label` attribute. Here there is none, so the test doesn't apply.
   - **Conclusion:** an NC on a criterion can't be compared with one of its tests.

5. **6.2.1: an observation about practice.** The five social links have no content. Their only name comes from `aria-label` and `title`. Our entry gives "needs review" here, because the wording asks for the content of the link. The auditor rated 6.2 C, so they accepted the attribute as a name. This is one data point on a reading the entry rationale left open. It doesn't call for a change.

6. **Results that depend on reading the frame, and an order the check records don't settle.**
   - **Correction after Codex's run:** this annex first gave 8.5.1 "passed", 10.1.1 "passed" and 11.8.2 "not applicable" without applying their frame clauses. Each of those three records abstains when the page holds a frame whose document it can't read. The reCAPTCHA `iframe` is cross-origin, and a script in the page can't read it. So those three results hold only if the engine reads the frame.
     - **What Playwright can do:** Codex's Playwright run read the frame's title and body.
     - **What the frame holds:** the orchestrator loaded the frame's address on its own. It has a `title` "reCAPTCHA" in `head`, no listed element, no `optgroup`, and no nested frame, shadow tree, `noscript` or `template`.
     - **Conclusion:** with an engine that reads the frame, the three results stand.
   - **The open order:** the records for 2.1.1, 6.2.1, 11.1.1 and 11.8.2 say both "if a nested document cannot be read, answer cannot_tell for the page" and "page result: fault if any element has a fault". They don't say which comes first. If "cannot be read" wins, the agreement in finding 1 becomes "needs review".
   - **Proposed rule, which Codex supports:**
     - A definite fault in a document that was read wins, as it already does in 10.1.1 and 10.1.2. The unread document is recorded as a limit.
     - An unread document comes before "not applicable": a frame that couldn't be read might hold the element the test is about.
   - **When:** state both before the M2 briefs.

## Drift between the audit and today

- **The videos:** the two embedded YouTube videos of June and August, titled `iframe`s, are now loaded on click. The auditor's comment on 4.13 concerns one of them.
- **The filters:** a fourth filter list ("Région", not rendered) has been added.
- **Plugin versions:** they changed between August and November.
- **None of this changes a result in the table above.** The facts behind findings 1 and 2 can be traced to the snapshots: the widget script and the reCAPTCHA script. The facts behind finding 3 can't.

## What this shows and what it doesn't

- **It shows:** on one page, our ten readings agree with a professional auditor's results, with one exception: a `full` entry that faults markup inserted by a third party (finding 2). It also shows the limits of comparing by criterion (findings 3 and 4).
- **It doesn't show:**
  - that the checks will be built as specified;
  - anything about pages unlike this one;
  - that the auditor is right.

  It's one page and one auditor, and the hand checks approximate the check records: for example, the computation of a link's name was simplified.

## Codex's independent run

Codex ran the dry run independently in Chrome, with the accessibility tree and Playwright, on 2026-11-18. It wrote its own table before reading this annex. Its report: `~/Documents/Codex/2026-11-18/rgaa-aubay-independent-dry-run/outputs/review.md`, with the table beside it.

- **Agrees with this annex on:**
  - the 10.1.2 fault;
  - the three unlabelled filter fields of 11.1.1, which the accessibility tree shows as three unnamed text fields;
  - the duplicate `id` of 8.2.1;
  - the "needs review" results of 8.3.1, 8.4.1, 2.1.1 and 6.2.1.
- **Differs on** 8.5.1, 10.1.1 and 11.8.2: "needs review", because the frame is unreadable. That's correct, and finding 6 now carries it.
- **Not established at audit time:** neither fact (the reCAPTCHA `iframe`, the second `id`).
- **On `height` on `table`:** HTML 4.01 doesn't define it. The check should abstain until the record cites a provision that does.
- **What not to conclude:** an "auditor error" from 10.1. The audit and the live page are months apart, and 10.1 aggregates two tests.

## Proposed follow-ups

- **Finding 2, decided (Q49, 2026-11-18):** Fabien kept the fault. 10.1.2 is unchanged.
- **Before the M2 briefs:**
  - State the two rules of finding 6.
  - Make `height` on `table` an abstention.
  - Require the engine to read cross-origin frames through the browser driver, and to record the frames it couldn't read.
- **At M2:** run the tool on the same page and compare with this record, test by test and fault by fault. Add test cases for:
  - an `iframe` with a presentation attribute inserted by a third party;
  - a definite fault beside an unreadable frame;
  - no `optgroup` beside an unreadable frame;
  - `height` on `table`.
