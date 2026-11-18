# Proposal: a developer view of the same run

**2026-11-18, revised the same day after Codex's review.** Written by the M1 orchestrator at Fabien's request. **Status: proposal, not a decision.** Nothing here changes the spec, the schemas or the coverage map. It asks for decisions at the end.

**What Codex's review changed.** The first draft said the run file already holds everything the view needs and that no schema change is required. That was too strong (see "What the run file guarantees"). It also listed every non-`failed` fault as a hint, ordered hints by how many elements share a cause, promised "N tests still need a person" in the empty state, and asked the M2 builders to run every check. Each of these is corrected below.

## The problem

The tool is built, first, as an assistant to an auditor (Q1, Q13). Of the 258 tests, only 20 candidate claims sit above `none`, and ten of those are the proposed minimum set. On the other 238 the tool may not state a verdict, and says `needs_review`. That is right for the claim boundary (spec 2) and is not up for discussion here.

It leaves a second reader badly served: a developer with no accessibility expertise who wants to know what to look at. For that reader "238 tests need review" says little, although the tool may have seen something. For example, axe sees an input with no accessible name, but the entry links it only as evidence.

The aim is to make what the tool saw useful to a developer without making it a verdict.

## What the run file guarantees, and what it doesn't

Read from spec 8.3, 8.5 and `src/schema/run.ts`:

- **Guaranteed.** An observation of outcome `fault` has a `fingerprint` and at least one evidence item. A finding lists the ids of the observations of its linked checks, and keeps advisory faults as evidence (8.3, step 3).
- **Not guaranteed.**
  - `locator` and `snippet` on an evidence item are optional.
  - There is at most one observation per check per target, and it may carry several evidence items.
  - Nothing guarantees that evidence contains axe's description or help text.
  - A fingerprint is asserted by the check that wrote it. It does not prove that two faults share one cause.
- **The mapping exists, in the ruleset.** The coverage map says which check is linked to which requirement of which test, and with what meaning. The view must read that mapping, and must say so when it is missing.

So the view can be built from the run file and the coverage map, but only if three things are defined, and **whether a schema change is needed is to be checked in M2, not assumed**: how an evidence item points to a specific element, what the view shows when `locator`, `snippet` or a description is absent, and how a group lists every target and every original observation.

## The proposal

Add a **developer view** to `report.html`, after the three statements that must open the file (spec 2, point 3) and before the per-criterion grid. It reorders and rephrases what the run file holds. It adds no claim.

### 1. What it shows

1. **Proven faults.** Findings with status `failed`. Each is stated as a fault under one named test, with its evidence and its targets.
2. **Hints.** Observations of outcome `fault` that did not produce `failed`, **after these exclusions**:
   - A fault that conflicts with an authoritative `no_fault` or `inapplicable` on the same requirement. These go to a separate group, **"The tool's checks disagree"**, with both sides shown.
   - A duplicate: the same check, target and evidence.
   - A fault from a check that errored. It belongs under "not tested".
   - An element whose evidence was redacted. It is listed as "redacted" with the reason, without its snippet.
3. **What was not looked at.** Shown as separate lists, each with its reasons (see section 3).

### 2. How it is worded

- Every item is an **observation reported by a tool**, in these words. It is not proof and it is not a violation. Example: "axe reports no accessible name on this field. Whether RGAA test 11.1.1 is failed here needs a person to decide."
- Grouping by fingerprint is shown as "the tool reports the same pattern on N elements", never as one cause. Each group opens to every target and every original observation id.
- No letters (C, NC, NA, NT) in this section. They stay in the grid with their legend (spec 2, point 8).
- Criterion titles stay in French as published; the prose follows `reportLanguage` (spec 12).
- All text from the page or from a tool (snippets, locators, rationales) is treated as untrusted. It is escaped when written into the HTML, never inserted as markup, and passes the sanitiser before it is stored or exported (spec 8.7). The report's own audit gets a test with hostile page text.

### 3. What it must never do

Written as acceptance tests of the view:

- **No score, grade, rate or traffic light**, and no total that works as one.
- **No implied priority.** Hints are ordered by page, then by test id, then by check id: the document's order, not an importance. They are not ordered by how many elements share a fingerprint, because that order reads as a ranking.
- **No empty-state reassurance, and no false count.** With no hints, the view says that the tool reported none **on the targets examined**, and lists those targets and the scope. It then lists, separately and each with its reasons:
  - tests that need a person (`needs_review`, by reason);
  - tests not tested, and results marked incomplete (`not_tested`, with reason);
  - what was excluded or never examined: states and pages not in the sample, shared elements, listed documents.

  It never says "N tests still need a person" as if that covered everything else, and it never implies that the other tests were assessed. It counts unique tests and targets separately and says which it is counting.
- **A hint never feeds a status.** The view reads and writes nothing back, and a test proves it.
- **The three statements stay at the very top of the file**, above this section (spec 2, point 3).

## What it asks of M2 and M5

- **M2 brief.** Decide which `evidence_only` checks run, as a scoped choice. They run only where they are explicitly scoped, safe for the page, and permitted by the project's privacy settings (spec 8.7). A check that fails or is unavailable is recorded as such. This is not an unconditional "run every check". And M1 captures nothing: all 125 check records are `exists: false`.
- **M2 brief, evidence.** For checks that feed the view, say what the adapter must keep (element locator, snippet, a description if axe provides one) and what the view does when it is absent. Settle there whether the existing optional fields suffice.
- **M5, optional.** Hints carry no claim, so the v1 bar (spec 10.4) does not cover them. The corpus could record, for each hint, whether a human agrees, as "x of n". Proposed as an addition, not a gate.
- **M4.** The view is built with the reporters. The report is audited by the tool and reviewed by hand against WCAG 2.2 AA (spec 12). The new section is part of that review.

## Why this does not weaken the claim boundary

- It cannot change a status, because it only reads.
- Its wording names what is established (a tool reported this) and what is not (whether the test is failed).
- The three statements, the legend and the no-score rule stay, and become tests of the view.
- The risk it adds is of a different kind. A reader may take "no hints" for "accessible", or may read a grouped list as a ranked set of causes. The empty-state rule, the separate "not looked at" lists and the document ordering are there for those, and are the parts most worth review.

## What it does not do

- **No remediation text.** A remediation list is after v1 (Q13). The view passes through what the checks recorded.
- **No verdict, rate or accessibility statement** (Q3, Q7, Q28).
- **No graphical interface.** It is a section of an HTML file. Q28 excludes a GUI, not a readable report.
- **No evidence that it helps anyone.** No user research supports its usefulness. The v1 trial (spec 10.6) has Fabien as its only reviewer and says nothing about use by others. A later test with a developer who is not an auditor would be a separate decision, outside the spec.

## Options for where it lives

| Option | Change to the spec | Note |
|---|---|---|
| **A. A section of `report.html`, after the three statements** (recommended) | Spec 12, the report's contents | One file, one source, one audit of the report. |
| B. A separate `developer.html` in the run folder | Spec 12, the list of outputs | Cleaner for two audiences, but a second page to audit and keep in step. |
| C. A text summary from the CLI | Spec 11.1 | Useful in a terminal and in CI; can follow A later, under the same wording rules. |

## Decisions asked of Fabien

1. **Adopt the principle**: a developer view of tool observations, under the rules of section 3. It amends Q13 and spec 12, and touches Q1 only by keeping the product door open (Q3b is unaffected).
2. **Choose the option** (A, B or C).
3. **Put the M2 lines in the brief**: the scoped choice of which evidence-only checks run, and what the adapter keeps.
4. **Optionally add the M5 hint measure.**

If adopted, the orchestrator amends spec 12 and the M2 brief, logs the decision on the bridge, and Codex reviews the wording rules before M4.
