# Brief: contract tests for `applicability: always`

For a builder (Sonnet 5.5, medium effort). Written by the orchestrator on 2026-11-17.

rgaa-assist assists RGAA accessibility audits. A pure function, `deriveFindings` in `src/rulesets/shared/derive.ts`, turns a coverage entry and check observations into a status for one RGAA test. Fabien has just added a third value to a coverage entry's `applicability` field (decision Q40 in `docs/decisions.md`): `always`, for a test that applies to every page. Another agent implemented it. You write the contract tests that hold it to the spec. You never read the function's body: you work from the spec and the doc comment only.

## Read first

1. `docs/decisions.md`, the section "After Codex's cross-check of the M1 pilot", decision Q40. It wins over everything else.
2. `docs/spec.md` sections 6.1, 8.3 (step 4) and 10.4.
3. The doc comment of `deriveFindings` (step 4.4) and the `applicability` enum in `src/schema/coverage.ts`.
4. `tests/contract/derive.test.ts`, especially the `describe("structural against judgment applicability")` block, and `tests/contract/helpers.ts`. Follow their style and reuse their builders.

## The tests that must exist

In `tests/contract/derive.test.ts`, extend the applicability block so it covers all three values side by side.

- Every requirement inapplicable:
  - `structural` gives `not_applicable` (at `full`);
  - `judgment` gives `needs_review` with reason `judgment_required`;
  - `always` gives `needs_review` with reason `cannot_tell`.
- `always` never gives `not_applicable`, at any level (`none`, `fail_only`, `full`), whatever the outcomes of its checks.
- `always` does not change the other rules: a proven failure on an `always` entry is still `failed` at `fail_only` and `full`, and every requirement satisfied at `full` is still `passed`.
- Where earlier rules of step 4 apply (an error, a dispute, an unmet prerequisite, an unestablished target), they win over 4.4 for `always` as for the other two values. One test for each is enough.
- The schema accepts `always`, and rejects an unknown value.

## Rules

- Where the spec, Q40 and the doc comment agree, test it. Where they disagree, write the test that `docs/decisions.md` and the spec demand, mark it, and say so in your report. Do not pick silently.
- No skipped or todo tests. Build inputs through the schemas.
- You own `tests/contract/` only. Touch nothing else. Add no dependency.
- `pnpm test` and `pnpm typecheck` must pass. If a test you wrote from the spec fails against the implementation, do not weaken it: report it.
- Commit on your worktree's branch. Do not merge, switch branches or push. End the commit message with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

## Report back

The tests you added, by name. Any point where the doc comment fixes something the spec leaves open. Any test that fails, with the passage it rests on. The result of the two commands, your branch and commit.
