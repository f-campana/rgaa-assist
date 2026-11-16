# M1 status

Kept current by the orchestrator. If you are taking over, read this after `docs/m1-kickoff.md`.

**Orchestrator:** Fable 5.2, in Fabien's planning thread. Started 2026-11-16.
**Ceilings (Q38):** check-in at 65% weekly all-models, stop at 85%. Fable stop at 50%.

## Steps

| # | Step | State |
|---|---|---|
| 1 | Vendor the official data, verify counts | Done 2026-11-16. 13, 106, 258. In `src/rulesets/rgaa-4.1.2/official/`. |
| 2 | Package scaffold (pnpm, TypeScript, Vitest, axe-core 4.14.0 pinned) | Not started |
| 3 | Schemas and the ruleset contract, then freeze | Not started |
| 4 | Contract tests, written by a different agent than step 3 | Not started |
| 5 | Table of axe rules per RGAA test | Not started |
| 6 | Pilot of about 12 entries, usage projection | Not started |
| 7 | Entries by theme | Not started |
| 8 | Check-in at 65%, with Codex's cross-check | Not started |
| 9 | Minimum useful set | Not started |
| 10 | Gate package for Fabien | Not started |

## In flight

Nothing.

## Decisions taken by the orchestrator

Also logged on the bridge, channel `rgaa-assist`.

- The orchestrator fetched the three official files itself, since Fabien's yes for the download was given to it and the files are data, not code.
- Schema library: Zod 4, which defines a schema once and gives both the TypeScript type and a JSON Schema (spec 13).

## Open points for Fabien

None.
