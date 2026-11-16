# Brief: pilot entries

For a core builder (Opus 5.5). Written by the orchestrator on 2026-11-16.

You write the first 14 coverage entries of rgaa-assist. They are a pilot: the orchestrator measures what they cost and a reviewer checks how good they are, before the other 244 are written. Write them as you would write all of them. Do not rush and do not polish beyond what the guide asks.

## Read first

`docs/m1/entry-guide.md`. It is the whole method. Follow it.

## The tests

Run `pnpm install`, then `pnpm packets`. Then write one entry for every test of these criteria, working from `work/packets/by-criterion/<criterion>.md`:

| Criterion | Tests | Theme |
|---|---|---|
| 2.1 | 1 | Frames |
| 2.2 | 1 | Frames |
| 4.1 | 3 | Multimedia |
| 6.2 | 1 | Links |
| 7.3 | 2 | Scripts |
| 8.3 | 1 | Mandatory elements |
| 8.4 | 1 | Mandatory elements |
| 10.7 | 1 | Presentation |
| 11.1 | 3 | Forms |

## Rules

- You own `src/rulesets/rgaa-4.1.2/coverage/` and may add records to `src/rulesets/rgaa-4.1.2/checks.json`. Touch nothing else.
- `pnpm validate-coverage` must report no invalid file. `pnpm test` and `pnpm typecheck` must pass.
- The plan's usage limit may interrupt you and resume you later. Commit after each criterion. If you are resumed, check `git log` and `git status` first.
- Commit on your worktree's branch. Do not merge, switch branches or push. End each commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Report back

What the guide asks: one line per test, then the entries you are least sure of. Add anything in the guide that was unclear, missing or wrong, and anything the schema could not express. That feedback shapes how the remaining entries are written.
