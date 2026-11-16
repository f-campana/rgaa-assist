# Brief: the entry validator, a citation source, packets by criterion

For the module builder (Sonnet 5.5). Written by the orchestrator on 2026-11-16.

rgaa-assist maps each of the 258 RGAA 4.1.2 tests to a coverage entry, one JSON file per test. Agents are about to write those entries. You give them and their reviewer three small tools.

## Read first

- `docs/m1/contract-notes.md`.
- `src/schema/coverage.ts`, `src/rulesets/rgaa-4.1.2/citations.ts`, `src/rulesets/rgaa-4.1.2/coverage-map.ts` and their tests. The loader already validates entries, the registry and citations. Reuse it. Do not write a second validator.
- `scripts/build-packets.ts` and `tests/packets.test.ts`.

## Deliver

### 1. A sixth citation source: the criterion title

Entries cite the official text with verbatim quotes. Five sources exist. Add `criterion_title`: `{ source: "criterion_title", criterion, quote }`, checked against the criterion's title in `criteres.json` by the same verbatim rule as the others.

- The schema in `src/schema/coverage.ts`, the resolver in `citations.ts`, tests for both, and one line in `docs/m1/contract-notes.md` under "Citations". This is an additive change to a frozen contract, approved by the orchestrator. Change nothing else in the schema.

### 2. `pnpm validate-coverage`

`scripts/validate-coverage.ts`. It loads the registry and every entry file under `src/rulesets/rgaa-4.1.2/coverage/`, and reports:

- for each invalid file: its path, and each issue with the field path and message, one per line;
- a file whose name or folder does not match its `test`, a test id that does not exist, a file that is not valid JSON;
- then a summary: how many entry files exist, how many are valid, and the number of valid entries per theme and per `candidate` level;
- with `--missing`: the test ids that have no entry file yet;
- with paths as arguments: only those files or folders.

Exit code 1 when any file is invalid, 0 otherwise. Missing entries are not an error. The summary is counts of entries only. Print no percentage and nothing that reads as a result about a website.

Tests in `tests/validate-coverage.test.ts`, on temporary directories: a valid entry, a broken citation, a wrong folder, an unknown check id, invalid JSON, `--missing`. Structure the script so the tests call a function and do not spawn a process.

### 3. Packets by criterion

The largest theme packet is 121 KB, too much for one writer. Make `pnpm packets` also write one packet per criterion, `work/packets/by-criterion/<criterion id>.md` (for example `1.1.md`), with the same content rules as the theme packets and only the glossary entries that criterion links to. Keep the theme packets. Extend `tests/packets.test.ts`: every test id appears in exactly one criterion packet.

## Rules

- You own `scripts/`, `tests/validate-coverage.test.ts`, `tests/packets.test.ts`, the `scripts` block of `package.json`, and the citation change in `src/schema/coverage.ts`, `src/rulesets/rgaa-4.1.2/citations.ts` and their tests. Other agents are working in `src/rulesets/shared/` and `tests/contract/` at the same time. Touch nothing else. Add no dependency.
- `pnpm test` and `pnpm typecheck` must pass.
- Run `pnpm install` first: your worktree has no `node_modules`.
- Commit on your worktree's branch. Do not merge, switch branches or push. End the commit message with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

## Report back

Short. The branch and commit, the files changed, a sample of the validator's output on one valid and one invalid entry, and the test and typecheck output tails.
