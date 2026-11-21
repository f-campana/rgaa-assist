# M2 brief: Q59 corrections (11.8.2 visibility, 10.1.2 table height)

You are a builder on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You apply items 1 and 4 of Fabien's ruling Q59 (end of `docs/decisions.md`; read Q57, Q58 and Q59 first).

## You own

- `src/checks/custom/family-c/` (the visibility helper) and `src/checks/custom/11-8-optgroup-label-attribute/`, with `tests/checks/custom/11-8-optgroup-label-attribute/`;
- `src/checks/custom/10-1-presentation-attributes/` (`lists.json`, `index.ts`, version) and `tests/checks/custom/10-1-presentation-attributes/`;
- in `src/rulesets/rgaa-4.1.2/checks.json`, **only** the `examines` text of `custom/10-1-presentation-attributes`, as item 4 below says (Fabien's ruling authorises this one record change).

Touch nothing else: no coverage entry, no other record, no `corpus/` file (a separate case writer writes the case), no other check, no docs. The behaviour of 2.1.1, 6.2.1 and 11.1.1 must not change (Q59 item 2).

## 1. 11.8.2: visibility needs positive evidence

Read `docs/m2-status.md` ("Q57, as built" and "Hiding the 11.8.2 helper still ignores") for the routes the previous builder found. Change the helper's approach for 11.8.2: **visible only on positive evidence.** Any style that can hide the list and that the helper cannot measure makes visibility unknown (`null`), so step (2) answers `cannot_tell`. At least:
- masks: `mask`, `mask-image`, `-webkit-mask`, `-webkit-mask-image` (any value other than `none`), and `mask-size`/`mask-*` making a mask present;
- `filter` and `backdrop-filter`, any value other than `none` (`opacity(0)` included);
- `opacity` below 1 on the select or any ancestor or hosting frame element (opacity 0 already gives "not visible", keep that);
- transforms the helper does not resolve (anything that the bounding rectangle does not already reflect, such as `backface-visibility: hidden` with a 3D transform), on the select or an ancestor;
- `clip-path: inset()` on an ancestor outside the containing-block chain (an absolute or fixed select): treat as unknown unless measured correctly;
- a list outside the visible part of a frame that cannot scroll (`overflow: hidden` on the frame's root or body, or any frame whose scrollable area the helper cannot establish): unknown.

Work on the select, every flat-tree ancestor and every hosting frame element, as the helper already walks them. Keep the existing measured cases (`inset()` on the chain, `display`, `visibility`, sizes) as they are. A definite fault elsewhere on the page still wins (the page result rules do not change). Test each route above, and each route the previous builder found, through `observe`: each gives `cannot_tell`, never a fault, and a labelled optgroup under it never gives `no_fault`. Keep controls proving that a plainly visible select still faults or passes as before. Bump `custom/11-8-optgroup-label-attribute` to `1.0.2`. Do not bump the other family C checks unless their behaviour changes (it must not).

## 2. 10.1.2: `height` on `table` becomes a fault

- `lists.json`: add `table` to the `height` defined pairs. Rewrite the `about` text: the HTML standard lists `height` on `table`, `thead`, `tbody`, `tfoot` among obsolete features, so they are defined pairs; Q50's abstention was based on a false premise and Q59 makes it a fault. Remove the stale mention of `align` on `fieldset` in the check's `index.ts` comment (removed in 1.0.1).
- The record's `examines` text: in the list of examples of a defined pair, change "height on td, th and tr" to "height on table, thead, tbody, tfoot, td, th and tr", and add "border on input" to the border examples ("border on table, img, object or input"). Change nothing else in the record.
- Bump `lists.json` and the check to `1.0.3`. Tests: `height` on `table` faults (replace the test that asserted the abstention); the other new pairs still fault; `width` or `height` on `picture > source` still gives `cannot_tell` (Q59 item 3).

## Rules

- `pnpm install --offline --frozen-lockfile`; first check your branch contains main's latest commit (`git merge --ff-only main` if behind). Add no dependency, download nothing, load no real site.
- `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass. Run `pnpm evaluate` and report its counts; commit no results file.
- Commit on your branch, messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Branch and last commit; for 11.8.2, each route and its test, and any route you found but could not make unknown; the 10.1.2 changes and tests; the exact record text before and after; `pnpm evaluate` counts (one existing working-set case may now mismatch if it encoded the old table-height abstention: name it, do not edit it); token use if known.
