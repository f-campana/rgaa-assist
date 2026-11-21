# M2 brief: Q60 corrections (11.8.2 rounded inset, 8.3.1 editable witness, unexpected-error count, 6.2.1 record)

You are a builder on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You apply items 1 to 4 of Fabien's ruling Q60 (end of `docs/decisions.md`; read Q57, Q59 and Q60 first). Codex's findings are in `~/Documents/Codex/2026-11-11/che/outputs/rgaa-m2-full-pass-2026-11-21.md` and `~/Documents/Codex/2026-11-19/th/outputs/rgaa-m2-review-interim-2026-11-21.md` (read both; they are short). The budget is tight: work directly, avoid broad exploration, run the full suite only when you think you are done.

## You own

- `src/checks/custom/family-c/` and `src/checks/custom/11-8-optgroup-label-attribute/`, with their tests;
- `src/checks/custom/family-a/` and `src/checks/custom/8-3-default-lang-present/`, with their tests;
- the snippet code of the other custom checks, only as item 2's sweep requires, with their tests;
- `src/evaluation/evaluate.ts` and its tests;
- in `src/rulesets/rgaa-4.1.2/checks.json`, **only** the sentence of the `examines` text of `custom/6-2-link-content-name` quoted in item 4.

Touch nothing else: no coverage entry, no other record, no `corpus/` file (a separate case writer writes the cases), no docs, no dependency.

## 1. 11.8.2: an `inset()` with `round` is unmeasured

`src/checks/custom/family-c/scan.js` `parseInset` (around line 191) drops the `round` part and measures the rectangle, so `measuredClipPath` counts it as measured. Make an `inset()` with a `round` part unmeasured, so visibility is unknown and 11.8.2 answers `cannot_tell` (Q59). Test through `observe` with Codex's fixture: `<form><div style="position:relative;width:200px;height:200px;clip-path:inset(0 round 100px)"><select style="position:absolute;left:0;top:0;width:10px;height:10px;padding:0;border:0"><optgroup><option>A</option></optgroup></select></div></form>` gives `cannot_tell`, never `fault`; a labelled optgroup there never gives `no_fault`. The existing test using `inset(1px round 2px)` (around line 147 of the 11.8.2 tests) must follow the new rule; a plain `inset()` keeps measuring as before (keep that control).

`parseInset` / `measuredClipPath` may be shared with 2.1.1, 6.2.1 and 11.1.1. If so, the rounded inset joins the shapes Q57 already treats as unmeasured for them: same effect as `circle()` today. Add one test per affected check pinning it, and report which checks changed. Do not otherwise change their behaviour (Q59 item 2). Bump `custom/11-8-optgroup-label-attribute` to `1.0.3`, and any other family C check whose behaviour changes to its next patch version.

## 2. 8.3.1: editable text is never a witness, and never reaches a snippet

`src/checks/custom/family-a/page/witness.js` (snippet around lines 311 to 316) accepts a text node under `<div contenteditable="true"><span>…</span></div>` as the ordinary-text witness, and its snippet (the parent's open tag plus the text) reaches the run file unmasked: the sanitiser only sees the fragment. Fix: a text node is never a witness when it has an editable ancestor (a `contenteditable` attribute whose value is not `false`, in any case, walking the flat tree across shadow boundaries; `document.designMode` "on"; framed documents included, each in its own document) or is inside a field (`input`, `textarea`, `select`, and the textbox-like roles the sanitiser already treats as editable). Under the record that text is a field's value, so it can never ground a fault.

Tests through `observe` / the engine: a page with no `lang` whose only text is `<div contenteditable="true"><span>Synthetic private visitor words</span></div>` gives no fault from that text (state the outcome you get and why under the record), and the marker string appears nowhere in the saved run output (run file and evidence). Also: `contenteditable="false"` inside an editable box, nested shadow host inside an editable box, `designMode`.

**Sweep:** look at every snippet builder of the other nine custom checks for the same pattern: a snippet that carries text from a node inside an editable box without the editable ancestor's start tag (so the sanitiser cannot see it). For each one found, keep the check's outcome logic unchanged and make the snippet drop that text, counted as a redaction the way the sanitiser counts one (`[redacted]`). List every snippet builder you looked at and what you found, fixed or not, with a test for each fix. Bump each check whose snippets or behaviour change to its next patch version.

## 3. Unexpected-error count

`src/evaluation/evaluate.ts` (around lines 161 to 163) skips a missing observation whenever the expected status is `not_tested`, even when the expected reason is `check_error` and the actual reason is `missing_observation`. Spec 10.3 counts a missing observation the case did not expect: count it as unexpected when the expected status differs **or** the expected reason is given and differs from the actual one. Add Codex's probe as a test: expected `{status:'not_tested', reason:'check_error'}`, actual finding `{status:'not_tested', reason:'missing_observation', complete:false}`, `missingObservations: ['custom/example']`: unexpected error 1 of 1, and the case does not match. Keep a control where the expected reason is `missing_observation` (0 of 1).

## 4. 6.2.1 record: hidden subtrees

In the `examines` text of `custom/6-2-link-content-name`, replace "skip every subtree that is hidden from assistive technologies (aria-hidden=\"true\", computed display none, computed visibility hidden or collapse, the hidden attribute)" with wording to this effect: skip, with its whole subtree, every element that has aria-hidden="true", a computed display of none or the hidden attribute; and skip every node whose own computed visibility is hidden or collapse, while a descendant whose computed visibility is visible still counts. Change nothing else in that record or any other. Check that the code already does exactly this (Codex's probe: a link with a `visibility:hidden` span containing a `visibility:visible` span with text gives `no_fault`); add that test if missing. The check's behaviour must not change; if it does, stop and report.

## Rules

- `pnpm install --offline --frozen-lockfile`; first check your branch contains main's latest commit (`git merge --ff-only main` if behind). Add no dependency, download nothing, load no real site.
- `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass. Run `pnpm evaluate` and report its counts (the two new cases arrive separately; commit no results file).
- Commit on your branch, messages ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Branch and last commit; item 1: the change, which checks it reaches, tests, versions; item 2: the witness fix, its tests, the sweep list (each snippet builder, finding, fix, test); item 3: the change and tests; item 4: the exact record sentence before and after, and whether the code needed a change; `pnpm evaluate` counts; token use if known.
