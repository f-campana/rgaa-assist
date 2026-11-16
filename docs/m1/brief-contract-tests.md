# Brief: write the contract tests

For a core builder (Opus 5.5). Written by the orchestrator on 2026-11-16.

rgaa-assist assists RGAA accessibility audits. Its central promise is that it never says "passed", "failed" or "not applicable" wrongly. Four pure functions carry that promise, and you write the tests that hold them to it. Another agent is writing their bodies at the same time. You never see its code: in your worktree the bodies are stubs that throw `NotImplementedError`, so your tests will fail when you run them. That is expected. What you deliver is a suite that typechecks, and that a correct implementation passes and a wrong one fails.

The spec was found wrong three times in review. These tests are the next place a remaining defect would show, so derive each expected result from the spec yourself. Do not copy the doc comments on trust.

## Read first

1. `docs/spec.md` sections 2, 6.1 to 6.3, 8.2 to 8.5 and 10.2. Section 8.3 has a case table: every row is a test.
2. `docs/m1/contract-notes.md`, including the orchestrator's review at the end.
3. The doc comments of `deriveFindings`, `reduceSet`, `reduce` and `effectiveLevel` in `src/rulesets/shared/`, with `src/rulesets/contract.ts` and the schemas in `src/schema/`.

## The tests that must exist

In `tests/contract/`, one file per function or theme, with small builders in `tests/contract/helpers.ts`. You may reuse `tests/fixtures/`.

**Derivation (spec 8.3)**
- Every row of the case table, one test per row, named after the row.
- Each rule of step 4 in its order, including the cases where two rules apply and the earlier one must win: a violation beside an error, an error beside a dispute, a dispute beside an unresolved requirement.
- Each level: the same observations at `none`, `fail_only` and `full`. A `fail_only` entry never gives `passed` or `not_applicable`.
- Several requirements: all must hold. One satisfied and one unresolved is not `passed`.
- Each reason of `needs_review` and `not_tested` that derivation can produce, and the precedence the doc comment fixes between them.
- Prerequisites: `state` on an `initial` target and on an established declared state, `keyboard`, `media`, `model`, `assistive_tech`.
- A target that was not established, with and without `expect` already met before the steps.
- `structural` against `judgment` applicability when every requirement is inapplicable.
- An advisory fault never changes a status, in either direction.
- `requirementFacts` keeps every true fact, including an error or a dispute that did not decide the status.
- **Inputs are validated before derivation.** An entry with no requirement, a malformed observation, and each other rejection code. A rejected call derives nothing.

**Effective level (spec 6.3, decision Q36)**
- The approval case of 6.3: a `full` entry approved with `needs: ["keyboard"]`; removing `keyboard` makes it run as `none`.
- Any other edit to an approved entry: a requirement's wording, a link demoted, the rationale. Each runs as `none`.
- Lowering with a logged demotion keeps the entry running at the lower level.
- **Raising after a demotion needs the approver again.** `full` to `fail_only` to `full`, and `full` to `none` to `full`. An old approval record with the same hash and level never restores the level. A new approval does.
- The approver roles each level requires, including an entry with a `failure` link approved at `full`.
- **A check-version suspension.** A linked check changes version: the entry runs as `none`. A new measurement passes on the new version: it runs at its authorised level again, with no new approval. It never rises above the authorised level, never undoes a demotion, and never applies to edited content.
- Each `blockedBy` code, and their order when two apply.

**Reduction (spec 8.4)**
- The ordered rule over a set: each status winning in its turn, and an empty set as an error.
- The four levels on a small sample: a page that passes as loaded and fails in a declared state is failed.
- The process cases: step 1 failed and step 2 missing gives `failed`, incomplete, with the missing step named. Step 1 passed and step 2 missing gives `not_tested`.
- The amended rule: a step whose `initial` target was not established but whose declared state failed contributes `failed`.
- A page in two processes. A page in none.
- Each validation error code.
- Determinism: the same input twice gives deeply equal output, and shuffling the input arrays does not change it.

**Schema rule**
- `enabled` never exceeds `candidate`. It exists in `src/schema/coverage.test.ts`; check that it is there and do not duplicate it.

## Rules

- **Where the spec and a doc comment agree,** test it.
- **Where a doc comment fixes something the spec leaves open** (a precedence, a sort order), test the doc comment and list the point in your report.
- **Where they contradict,** do not pick. Write the test the spec demands, mark it clearly, and report the passage. The one known case is already settled: see the orchestrator's review in the notes.
- No skipped or todo tests. No test that passes against the stubs.
- Build inputs through the schemas, so an invalid fixture fails loudly.
- You own `tests/contract/` only. Touch nothing else. Add no dependency.
- `pnpm typecheck` must pass. `pnpm test` will fail in `tests/contract/` with `NotImplementedError` and nowhere else: check that this is the only kind of failure.
- Run `pnpm install` first: your worktree has no `node_modules`.
- Commit on your worktree's branch. Do not merge, switch branches or push. End the commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Report back

Short. The branch and commit, the number of tests per file, the points where you tested a doc comment beyond the spec, any contradiction you found, and anything in the spec you believe is wrong.
