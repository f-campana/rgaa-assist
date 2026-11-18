# Proposal: a developer view of the same run

**2026-11-18.** Written by the M1 orchestrator at Fabien's request. **Status: proposal, not a decision.** Nothing here changes the spec, the schemas or the coverage map. It asks for decisions at the end.

## The problem

The tool is built, first, as an assistant to an auditor (Q1, Q13). Of the 258 tests, only 20 candidate claims sit above `none`, and ten of those are the proposed minimum set. On the other 238 the tool may not state a verdict, and says `needs_review`. That is right for the claim boundary (spec 2), and it is not up for discussion here.

It leaves a second reader badly served: a developer with no accessibility expertise who wants to know what to look at. For that reader, "238 tests need review" tells almost nothing. Yet the tool already knows more than it is allowed to conclude. For example, axe sees an input with no accessible name, but links it to the test only as evidence.

The aim is to make that knowledge useful to a developer without making it a verdict.

## What already exists, and what it means

- **Advisory faults are kept.** A fault reported through an `evidence_only` link "is kept as evidence on the finding and changes nothing below" (spec 8.3, step 3). 105 of the 125 check links are of this kind.
- **The run file holds them.** Every observation is stored with its outcome, locator, sanitised snippet and a `fingerprint` that is the same for the same fault elsewhere (spec 8.5, `src/schema/run.ts`).
- **The report already shows evidence** for each failed or reviewed criterion (spec 12). It is organised by criterion, which is the auditor's order.

So the proposal needs no new statuses, no new derivation and no schema change. It is a different presentation of data the run file already has. Under spec 5, reporters read the run file only, so this is a reporter concern.

## The proposal

Add a **developer view**: a section at the top of `report.html`, ahead of the per-criterion grid. It reorders and rephrases; it adds no claim.

### 1. What it shows

1. **Proven faults.** Every finding with status `failed`. These are the only items the tool states as faults, and the text says that each one is a fault under one named test.
2. **Hints.** Every observation with outcome `fault` that did not produce `failed`, grouped by `fingerprint` so one root cause appears once with its list of elements. Each hint gives the element (locator and snippet), what the check saw, the check that saw it, and the RGAA tests it relates to, quoted by id and official title.
3. **What was not looked at.** The tests left for a person, grouped by reason (`judgment_required`, `assistive_tech_required`, `prerequisite_unmet`, and the rest), with the count in each group and the targets that could not be examined.

### 2. How it is worded

- A hint is called a **hint** or a **possible issue**. It is never called a failure, a non-conformity or a violation of RGAA.
- Its sentence says what the tool saw and what it could not decide, for example: "axe reports no accessible name on this field. Whether RGAA test 11.1.1 is failed here needs a person to decide."
- No letters (C, NC, NA, NT) in this section. They stay in the grid, with their legend (spec 2, point 8).
- Criterion titles stay in French as published; the prose follows `reportLanguage` (spec 12).

### 3. What it must never do

These follow from spec 2 and are written as acceptance tests for the view.

- **No score, grade, rate or traffic light**, and no total that works as one. Counts appear only inside a group's own list. There is no "12 issues on this page" in a headline, and no per-page ranking.
- **No empty-state reassurance.** When there are no hints, the view says: "The tool reported no hints. N tests still need a person (listed below)." It never says "no issues", "all good" or similar. The "not looked at" list has the same prominence as the hints.
- **The three statements** (what was covered, what was not covered, what this is not) open the section, as they open every output (spec 2, point 3).
- **A hint never feeds a status.** The view reads findings and observations and writes nothing back. A test that proves this belongs with the M4 gate.

### 4. Order

Proven faults first, then hints, then what was not looked at. Within hints, by number of elements sharing a fingerprint, then by page. This is a reading order, not a severity: the tool does not rank by impact, because no impact model exists.

## What it asks of M2 and M5

- **M2 brief, one line.** The axe adapter and the custom checks must run every linked check, including those linked as `evidence_only`, and keep their elements, locator, snippet and axe's own description text in `evidence`. A builder could otherwise skip evidence-only rules as unused. To confirm in the M2 brief: whether the adapter can keep axe's help text and help URL in `tool_output` evidence.
- **M5 measure, optional.** Hints carry no claim, so the v1 bar (spec 10.4) does not cover them. But a hint that is wrong most of the time makes the view noise. The corpus could record, for each hint, whether a human agrees, and report it as "x of n" like the four measures. Proposed as an addition, not a gate.
- **M4.** The view is built with the reporters. The report is audited by the tool and reviewed by hand against WCAG 2.2 AA (spec 12). The new section is part of that review.

## Why this does not weaken the claim boundary

- It cannot change a status, because it only reads.
- Its wording names what is established (the tool saw this) and what is not (whether the test is failed).
- It leaves the three statements, the legend and the no-score rule in place, and turns them into tests of the view.
- The risk it adds is of a different kind: a developer reads the hints and concludes the page is accessible when no hint appears. The empty-state rule and the equal weight of the "not looked at" list are there for that, and they are the part most worth reviewing.

## What it does not do

- **No remediation text.** A remediation list is after v1 (Q13). The view passes through what the checks recorded, and writes no fix advice of its own.
- **No verdict, rate or accessibility statement** (Q3, Q7, Q28).
- **No graphical interface.** It is a section of an HTML file. Q28 excludes a GUI, not a readable report.
- **No evidence it works for non-experts.** The v1 trial (spec 10.6) has Fabien as the only reviewer, and the spec says it shows nothing about usefulness for anyone else. The view only makes that test possible later.

## Options for where it lives

| Option | Change to the spec | Note |
|---|---|---|
| **A. Top section of `report.html`** (recommended) | Spec 12, the report's contents | One file, one source, one audit of the report. |
| B. A separate `developer.html` in the run folder | Spec 12, the list of outputs | Cleaner for two audiences, but a second page to audit and keep in step. |
| C. A text summary from the CLI | Spec 11.1 | Useful to read in a terminal and in CI; can follow A later. Needs the same wording rules. |

## Decisions asked of Fabien

1. **Adopt the principle**: that a developer view of hints is part of the report, with the rules of section 3. This amends Q13 and spec 12 and touches Q1 only by keeping the product door open (Q3b is unaffected).
2. **Choose the option** (A, B or C).
3. **Put the M2 line in the brief**: run and record `evidence_only` checks in full.
4. **Optionally add the M5 hint measure.**

If adopted, the orchestrator amends spec 12 and the M2 brief, logs the decision on the bridge, and Codex reviews the wording rules before M4, as it does for any text that touches the claim boundary.
