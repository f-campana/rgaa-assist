# M1 status

Kept current by the orchestrator. If you are taking over, read this after `docs/m1-kickoff.md`.

**Orchestrator:** Fable 5.2, in Fabien's planning thread. Started 2026-11-16.
**Ceilings (Q38):** check-in at 65% weekly all-models, stop at 85%. Fable stop at 50%.

## Steps

| # | Step | State |
|---|---|---|
| 1 | Vendor the official data, verify counts | Done 2026-11-16. 13, 106, 258. In `src/rulesets/rgaa-4.1.2/official/`. |
| 2 | Package scaffold (pnpm, TypeScript, Vitest, axe-core 4.14.0 pinned) | Done 2026-11-16, merged as `0868bb4`. zod 4.6.7, typescript 7.0.2, vitest 5.1.0. |
| 3 | Schemas and the ruleset contract, then freeze | In flight: Opus, brief `docs/m1/brief-schemas.md` |
| 4 | Implementation of derivation, reduction and effective level by one agent, contract tests by another, both after the freeze | Not started |
| 5 | Table of axe rules per RGAA test, and theme packets for entry writers | Done 2026-11-16, merged as `aa4cdd9`. 67 rules, 40 tests, as the spec says. `pnpm packets` writes 13 packets, 595 KB in all; theme 1 is 121 KB, so split it between writers by criterion. |
| 6 | Pilot of about 12 entries, usage projection | Not started |
| 7 | Entries by theme | Not started |
| 8 | Check-in at 65%, with Codex's cross-check | Not started |
| 9 | Minimum useful set | Not started |
| 10 | Gate package for Fabien | Not started |

## In flight

One builder (schemas, Opus), launched 2026-11-16 16:16 UTC, in its own worktree under `.claude/worktrees/`. When it reports: read its diff, run `pnpm test` and `pnpm typecheck`, merge to main, remove the worktree.

After the schemas merge: review them hard, since they freeze. Then launch three agents in parallel: the implementer (Opus), the contract-test writer (Opus, must not read the implementation), and the entry validator script (Sonnet). Then write `docs/m1/entry-guide.md` and run the pilot of about 12 entries.

## Decisions taken by the orchestrator

Also logged on the bridge, channel `rgaa-assist`.

- The orchestrator fetched the three official files itself, since Fabien's yes for the download was given to it and the files are data, not code.
- Schema library: Zod 4, which defines a schema once and gives both the TypeScript type and a JSON Schema (spec 13).
- M1 includes the pure functions behind the contract (derivation of 8.3, reduction of 8.4, effective level of 6.3), because the M1 gate needs the contract tests green. No browser and no engine. M2 wires them to real runs.
- The agent that defines the contract stubs the function bodies. A second agent implements them and a third writes the contract tests, from the spec and the types only.
- Entries are one JSON file per test, `src/rulesets/rgaa-4.1.2/coverage/<theme>/<test id>.json`. Citations are verbatim quotes that a script checks against the vendored files.
- Meaning of the prerequisites (spec 17.1), to report to Fabien at the gate: `state` is met only on an established declared state other than `initial`; `keyboard` only when the engine completed a keyboard pass on the target; `media` only when it completed a timed observation pass; neither pass exists yet. `model` is never met for deriving a status. `assistive_tech` is never met in v1.
- Entry writers work from generated theme packets (`pnpm packets`, into the gitignored `work/packets/`), not from the raw files.

## Findings to report at the gate

- One glossary anchor in the official data resolves to nothing: `#table-descriptions-techniques`, in a technical note of criterion 5.1. The other 115 resolve. The packet for theme 5 lists it.

## Open points for Fabien

None.
