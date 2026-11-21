# M2 brief: working-set case for `height` on `table` (Q59) (case writer)

You are a case writer on rgaa-assist. You work in your own git worktree. You write cases, never checks: do not read or write anything under `src/checks/custom/`.

## Read first

`docs/decisions.md` (Q49, Q50, Q57, Q59), `docs/m2/brief-working-set.md` (its rules for cases apply unchanged), the entry `src/rulesets/rgaa-4.1.2/coverage/10/10.1.2.json`, the existing cases in `corpus/working/10.1.2/` (above all `10.1.2-invalid-height-on-table-sections`), and `tests/corpus/working.test.ts`.

## You own

New folders under `corpus/working/10.1.2/` only. If an existing case encodes the old abstention on `height` on `table` (expected `needs_review` because of it), do not edit it: name it in your report; the orchestrator decides.

## What to write

Q59 makes `height` on `table` a fault under 10.1.2 (the HTML standard lists it among obsolete features). Write one case `invalid_fault_proves_failure`: a table carrying `height`, with no other listed attribute on the page (no `width` on the table, no `border`, no `cellpadding`), expected `failed` at both levels. The rationale cites test 10.1.2 and its methodology in the form the existing cases use, and says the pair is defined by the HTML standard's obsolete features (Q59). Planted, self-contained, no request outside the case folder.

## Rules

- `pnpm install --offline --frozen-lockfile`; first check your branch contains main's latest commit (`git merge --ff-only main` if behind). Download nothing, visit no site.
- `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass.
- Commit on your branch, messages ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Branch and last commit; the case id and expected results; any existing case that encodes the old abstention; token use if known.
