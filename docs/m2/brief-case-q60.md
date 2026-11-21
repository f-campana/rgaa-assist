# M2 brief: working-set cases for Q60 items 1 and 2 (case writer)

You are a case writer on rgaa-assist. You work in your own git worktree. You write cases, never checks: do not read or write anything under `src/checks/custom/`.

## Read first

`docs/decisions.md` (Q59, Q60), `docs/m2/brief-working-set.md` (its rules for cases apply unchanged), the entries `src/rulesets/rgaa-4.1.2/coverage/11/11.8.2.json` and `coverage/08/8.3.1.json`, the records of `custom/11-8-optgroup-label-attribute` and `custom/8-3-default-lang-present` in `src/rulesets/rgaa-4.1.2/checks.json`, the existing cases in `corpus/working/11.8.2/` and `corpus/working/8.3.1/`, and `tests/corpus/working.test.ts`.

## You own

New folders under `corpus/working/11.8.2/` and `corpus/working/8.3.1/` only.

## What to write

1. **11.8.2, rounded clip.** A page with a `select` fully hidden by a rounded `inset()` corner: a 200×200 parent with `position:relative` and `clip-path:inset(0 round 100px)`, a 10×10 `select` at its top-left corner (`position:absolute;left:0;top:0;width:10px;height:10px;padding:0;border:0`), containing an `optgroup` without a `label`. No part of it at least 4 pixels square lies inside the clip, so the record gives `cannot_tell` at step (2). Write the expected result at the entry's levels from the record and the entry, as the existing 11.8.2 `cannot_tell` cases do.
2. **8.3.1, editable text.** A page with no `lang` anywhere whose only text is inside an editable box, for example `<div contenteditable="true"><span>Synthetic private visitor words</span></div>`. Under the record that text is a field's value, so it is not a witness and cannot ground a fault. Work out the expected outcome from the record's order and write the expected result at the entry's level, as the existing 8.3.1 cases do. Use only synthetic text.

Each rationale cites the official wording (the test and its methodology) in the form the existing cases use, says which record step gives the result, and names Q60. Planted, self-contained, no request outside the case folder.

## Rules

- `pnpm install --offline --frozen-lockfile`; first check your branch contains main's latest commit (`git merge --ff-only main` if behind). Download nothing, visit no site.
- `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass. Your cases may not match the current code until the builder's fix lands; say which.
- Commit on your branch, messages ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Branch and last commit; the case ids and expected results, with the record step for each; token use if known.
