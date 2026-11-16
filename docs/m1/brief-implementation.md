# Brief: implement the contract functions

For the core builder (Opus 5.5). Written by the orchestrator on 2026-11-16.

The schemas and the ruleset contract of rgaa-assist are frozen. Four functions in `src/rulesets/shared/` are stubs that throw `NotImplementedError`. You write their bodies. Another agent is writing the contract tests at the same time, from the spec and the doc comments, without seeing your code. Your work is judged by those tests.

## Read first

1. `docs/m1/contract-notes.md`, including the orchestrator's review at the end.
2. The doc comments of `deriveFindings` (`shared/derive.ts`), `reduceSet` and `reduce` (`shared/reduce.ts`), `effectiveLevel` (`shared/effective-level.ts`). They are your specification.
3. `src/rulesets/contract.ts` and the schemas those functions use in `src/schema/`.
4. `docs/spec.md` sections 6.3, 8.2, 8.3 and 8.4, to understand why. Read the rest only if you need it.

## Deliver

- The bodies of `deriveFindings`, `reduceSet`, `reduce` and `effectiveLevel`, doing exactly what their doc comments say: the validation, the facts, the order of rules, the reasons, the sort orders.
- `checkSample` stays a stub. It belongs to a later milestone.
- Your own unit tests beside your code (`src/rulesets/shared/*.test.ts`) for the helpers you write and for anything you want to pin down. These are yours. The contract tests in `tests/contract/` are not: do not create or edit that folder.

## Rules

- **Do not change a signature, a type, a schema or a doc comment.** If a doc comment is ambiguous, contradicts another, or contradicts the spec, do not choose silently: implement the reading you think is right, and list the passage and your reading in your report.
- Pure functions only. No file access, no clock, no randomness, no model. The same input always gives the same output, with arrays sorted as the doc comments say.
- The claim boundary (spec 2) is a hard rule: compute no rate, score, count against a total, or verdict.
- You own `src/rulesets/shared/derive.ts`, `reduce.ts`, `effective-level.ts`, and new helper files and tests in that folder. Other agents are working in `tests/contract/`, `scripts/`, `src/schema/coverage.ts` and `src/rulesets/rgaa-4.1.2/` at the same time. Touch nothing else. Add no dependency.
- `pnpm typecheck` and `pnpm test` must pass.
- Run `pnpm install` first: your worktree has no `node_modules`.
- Commit on your worktree's branch. Do not merge, switch branches or push. End the commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Report back

Short. The branch and commit, the files changed, the test and typecheck output tails, and every passage you found ambiguous or contradictory with the reading you implemented.
