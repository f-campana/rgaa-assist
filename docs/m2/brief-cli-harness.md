# M2 brief: CLI and working-set harness (module builder)

You are a module builder on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You wire the CLI and build the harness that gives the first working-set numbers.

## Read first

1. `docs/decisions.md` (it wins), then `docs/spec.md` sections 2, 6.3, 8.6, 10.2 to 10.5, 11.1.
2. `src/engine/` (above all `runAudit` and `src/engine/testing/`), `src/checks/types.ts`, `src/checks/axe/`, `src/checks/custom/index.ts`.
3. `src/schema/corpus.ts`, `src/schema/evaluation.ts` (`caseMatches`, `tabulate`, `EvaluationSummarySchema`), `src/rulesets/shared/`, `src/rulesets/rgaa-4.1.2/index.ts`.
4. `corpus/working/` (the cases; read them, never edit them).

## You own

`src/cli/` (new), `src/checks/index.ts` (new), `src/evaluation/` (new), `tests/cli/` and `tests/evaluation/` (new), `corpus/results/` (new), and the `scripts` and `bin` fields of `package.json`. Touch nothing else.

## What to build

### 1. Providers (`src/checks/index.ts`)

`allProviders(): CheckProvider[]`: the custom providers from `src/checks/custom/index.ts` first, then `axeProvider` last (the engine runs them in this order).

### 2. CLI (`src/cli/`, spec 11.1)

Entry `src/cli/main.ts`, run as `node src/cli/main.ts <command>` (Node 24 runs TypeScript directly), exposed as the `bin` `rgaa-assist` and the script `pnpm rgaa-assist`.
- `audit <sample.json> --out <dir>`: `runAudit` with `allProviders()`. Exit codes of 11.1: 0 completed, 2 invalid input, 3 one or more targets not established. `--fail-on failed` exits 1 when any criterion on the sample is `failed` (off by default). Print where the run file is and a short summary of statuses by count. No rate, no verdict, no "x of 106".
- `coverage [--ruleset rgaa-4.1.2]`: the coverage map summary: entries by candidate level and by enabled level, per theme, as counts; checks in the registry by kind and by `exists`. Same no-rate rule.
- `check-sample <sample.json>`: validate and print the warnings of `checkSample`. Exit 2 when invalid.
- `report`: prints that reports arrive in M4 and exits 2.
- Every output that is not a bare count table ends with the "what this is not" sentence (`WHAT_THIS_IS_NOT` in `src/schema/statements.ts`).

### 3. Harness (`src/evaluation/`, script `pnpm evaluate`)

- For each case under `corpus/working/` (validate it first with `CorpusCaseSchema`): serve its folder with the engine's two-origin fixture server, establish the target and run `allProviders()` exactly as the engine does (use `src/engine/testing/`; do not reimplement establishment), then derive the case's test.
- **Measure at the candidate level.** Nothing is enabled, and `deriveFindings` refuses a level above `enabled`. For measurement only, derive with an in-memory copy of the entry whose `enabled` equals its `candidate` (`enabled` is outside the entry hash), at that level. Never write that copy anywhere. Compare with `expected[candidate]` through `caseMatches`.
- A link to a check that is not built (`exists: false`, no provider) gives a missing observation; report it as such, do not hide it.
- Output, written to `corpus/results/working-<UTC date and time>.json` and printed:
  - per case: expected, actual (status, reason, complete), match or not, the observations' outcomes per linked check;
  - per test and per link, the table of 10.3 (expected against actual over the five statuses, crashes, missing observations) and the four counts of 10.3, **each as "x of n cases on corpus working@<hash>"**;
  - per check: outcomes over the cases that link it;
  - the corpus hash (canonical hash of the cases and their files) and the check versions.
  - If you can fill an `EvaluationSummary` that validates, write it too; if the schema needs things the harness cannot know yet, say so in your report instead of inventing them.
- **Never a rate, a percentage, a score or a verdict**, in output, file names or logs. "0 of 12" is a count; "100%" is forbidden.

## Tests

`tests/cli/` (exit codes, refusals, the coverage summary, `--fail-on`; audits only on local fixture sites through the engine's fixture server) and `tests/evaluation/` (a tiny fake corpus in the test folder: a case that matches, one that does not, one with a missing observation). **No network.** `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass.

## Rules

- Set up with `pnpm install --offline --frozen-lockfile`. Add no dependency, download nothing, load no real site. Do not run `audit` on a real address.
- Commit on your branch, messages ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Reply with: branch and last commit; what you built; test counts; the output of `pnpm evaluate` on the working set as it is in your checkout; anything in the schemas that did not fit; your token use if you know it.
