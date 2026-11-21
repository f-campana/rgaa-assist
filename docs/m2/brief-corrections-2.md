# M2 brief: corrections from Codex's full pass (Q57)

You are a builder on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You apply two corrections Fabien approved on 2026-11-21 (Q57 in `docs/decisions.md`) from Codex's working record `/Users/fabiencampana/Documents/Codex/2026-11-11/che/outputs/rgaa-m2-full-pass-2026-11-21.md` (27 lines; read it first).

## You own

- `src/checks/custom/family-c/` and the versions of the four family C checks; `tests/checks/custom/{2-1-frame-title-attribute,6-2-link-content-name,11-1-field-label-mechanism,11-8-optgroup-label-attribute}/`.
- `src/checks/custom/10-1-presentation-attributes/` (`lists.json`, the check's version) and `tests/checks/custom/10-1-presentation-attributes/`.

Touch nothing else: no coverage entry, no `checks.json` record, no `corpus/` file (another agent writes the working-set case), no docs.

## 1. Clipping in the family C visibility helper (gate blocker)

`src/checks/custom/family-c/scan.js` (`visibleArea`, around lines 219 to 229) measures `clip-path: inset()` and ignores every other `clip-path`. So with `<form><div style="clip-path:circle(0px)"><select><optgroup><option>Choice</option></optgroup></select></div></form>`, the 11.8.2 check faults an unlabelled optgroup in a list that is fully clipped; the record requires `cannot_tell` when no part at least 4 pixels square lies inside every clipping ancestor. The same with `polygon(0 0,0 0,0 0)`, on an ancestor or on the element itself.

The fix (Q57): any `clip-path` on the element or an ancestor (in the same chain the helper already walks, hosting frame elements included) whose value is neither `none` nor a parsed `inset()` makes visibility **unknown**. Unknown visibility must lead each check to the record's abstention (`cannot_tell`), never to a fault and never to `no_fault`. That covers `circle`, `ellipse`, `polygon`, `path`, `rect`, `xywh`, `url(...)`, a shape followed or preceded by a box keyword, a box keyword alone, and anything unparsed.

It applies to every family C check that uses the helper: 2.1.1, 6.2.1, 11.1.1, 11.8.2. Check, for each, where the helper's answer enters the decision, and make "unknown" abstain there.

Tests, through `observe` from `src/engine/testing/`: Codex's fixtures (`circle(0px)` and `polygon(0 0,0 0,0 0)`, each on an ancestor and on the element) for 11.8.2, plus one per other check that uses the helper; and a control that `inset()` still measures as before.

Then look for **other hiding the helper ignores** that could produce the same false fault: `mask`/`mask-image`, `-webkit-mask`, `transform: scale(0)`, `filter: opacity(0)`, `content-visibility: hidden`, `clip` on a non-positioned element, zero-size `overflow: hidden` ancestors, anything else you find. **Report them; do not widen the fix to them.** For each, say whether it can turn a hidden element into a fault, with a fixture result.

Bump each family C check version to `1.0.1`.

## 2. 10.1.2 defined pairs

In `src/checks/custom/10-1-presentation-attributes/lists.json` add to `definedPairs`: `border` on `input`; `height` on `thead`, `tbody`, `tfoot` (the HTML standard lists them among obsolete features). Do not add `height` on `table`: it keeps its abstention (Q50). Update the `about` text. Bump `lists.json` `version` and the check's version to `1.0.2`. Tests: each new pair faults; `height` on `table` still abstains.

## Rules

- `pnpm install --offline --frozen-lockfile`; first check your branch contains main's latest commit (`git merge --ff-only main` if behind). Add no dependency, download nothing, load no real site.
- `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass. Run `pnpm evaluate` and report its counts, but do not commit a results file (the orchestrator does, after the case writer's work is merged).
- Commit on your branch, messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Branch and last commit; the fix, where "unknown" enters each of the four checks, and the tests; the list of other hiding the helper ignores, each with a fixture result; the new pairs and tests; `pnpm evaluate` counts; token use if known.
