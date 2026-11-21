# M2 brief: working-set cases for the 10.1.2 pairs added by Q57 (case writer)

You are a case writer on rgaa-assist. You work in your own git worktree. You write cases, never checks: do not read or write anything under `src/checks/custom/`.

## Read first

`docs/decisions.md` (Q49, Q50, Q57), `docs/m2/brief-working-set.md` (the rules every working-set case follows; they apply here unchanged), the entry `src/rulesets/rgaa-4.1.2/coverage/10/10.1.2.json`, the record of `custom/10-1-presentation-attributes` in `src/rulesets/rgaa-4.1.2/checks.json`, the existing cases in `corpus/working/10.1.2/`, and `tests/corpus/working.test.ts`.

## You own

New folders under `corpus/working/10.1.2/` only.

## What to write

Q57 makes four more pairs faults under 10.1.2, as the record defines a pair by HTML 4.01 or the current HTML standard including obsolete features: `border` on `input`; `height` on `thead`, `tbody`, `tfoot`. Write:
- one case `invalid_fault_proves_failure` with `border` on an `input` (expected `failed` at both levels);
- one case `invalid_fault_proves_failure` with `height` on a `thead`, a `tbody` or a `tfoot` (expected `failed` at both levels); you may cover all three in one page.

Each case cites the official wording (test 10.1.2 and its methodology) in the rationale, in the citation form the existing cases use, and says that the pair is defined by the HTML standard's list of obsolete features. Keep the page free of any other listed attribute, so the expected result follows from the new pair alone. Planted, self-contained, no request outside the case folder.

## Rules

- `pnpm install --offline --frozen-lockfile`; first check your branch contains main's latest commit (`git merge --ff-only main` if behind). Download nothing, visit no site.
- `pnpm test` (above all `tests/corpus/working.test.ts`), `pnpm typecheck`, `pnpm validate-coverage` must pass.
- Commit on your branch, messages ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Branch and last commit; the case ids, branches and expected results; token use if known.
