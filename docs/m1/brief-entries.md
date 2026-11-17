# Brief: coverage entries, by batch

For core builders (Opus 5.5, high effort). Written by the orchestrator on 2026-11-17, after the pilot and its corrections (decision Q41).

You write coverage entries of rgaa-assist for the RGAA criteria assigned to you below. The 14 pilot entries are written and were cross-checked by an independent reviewer. Its lessons are in the guide. Write your entries the same way. Another builder is writing other criteria at the same time, in its own worktree.

## Read first

1. `docs/m1/entry-guide.md`, whole. It is the method, including "Judge each test on its own" and "Lessons from the pilot".
2. Two corrected pilot entries, as examples of the level of care expected: `src/rulesets/rgaa-4.1.2/coverage/08/8.3.1.json` (a `full` entry whose check decides one route and abstains on the other) and `src/rulesets/rgaa-4.1.2/coverage/02/2.2.1.json` (a bounded failure check under a judgment test).

Do not read the other entries for answers. Each test is judged from its own official text.

## Your tests

Run `pnpm install`, then `pnpm packets`. Then write one entry for every test of the criteria in your row, from `work/packets/by-criterion/<criterion>.md`. The theme packet `work/packets/theme-NN.md` has the theme's glossary and axe material if you need it.

The orchestrator's prompt tells you which builder you are.

| Batch | Builder | Criteria | Tests | Theme folder |
|---|---|---|---|---|
| 1 (merged) | A | 1.1, 1.5 | 10 | `01/` |
| 1 (merged) | B | 8.1, 8.2, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10 | 11 | `08/` |
| 2 | C | 11.2, 11.3, 11.4, 11.5 | 12 | `11/` |
| 2 | D | 9.1, 9.2, 9.3, 9.4 | 9 | `09/` |

Test 1.1.6 is the spec's reference case (spec 6.1 and 6.2). An entry that contradicts it is wrong.

## Rules

- You own the coverage files of your criteria only, in `src/rulesets/rgaa-4.1.2/coverage/<theme>/`. You may add records to `src/rulesets/rgaa-4.1.2/checks.json`: keep the file sorted by id, add records, and never edit or remove another record. If a check you need already exists, link to it only if its `examines` text covers what your link claims; otherwise add your own. Touch nothing else.
- **Lower any claim you doubt.** If you would put a `failure` link or a resolving link on your "least sure" list, lower it before you finish, and say what would raise it.
- `pnpm validate-coverage` must report no invalid file. `pnpm test` and `pnpm typecheck` must pass.
- The plan's usage limit may interrupt you and resume you later. Commit after each criterion. If you are resumed, check `git log` and `git status` first.
- Commit on your worktree's branch. Do not merge, switch branches or push. End each commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Report back

What the guide asks: one line per test (candidate level, hardest call), then the entries you are least sure of, with the reason. Then anything the guide or schema could not express. Then your branch, commits, and the result of the three commands.
