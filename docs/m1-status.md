# M1 status

Kept current by the orchestrator. If you are taking over, read this after `docs/m1-kickoff.md`.

**Orchestrator:** Fable 5.2, in Fabien's planning thread. Started 2026-11-16.
**Ceilings (Q38):** check-in at 65% weekly all-models, stop at 85%. Fable stop at 50%.

## Steps

| # | Step | State |
|---|---|---|
| 1 | Vendor the official data, verify counts | Done 2026-11-16. 13, 106, 258. In `src/rulesets/rgaa-4.1.2/official/`. |
| 2 | Package scaffold (pnpm, TypeScript, Vitest, axe-core 4.14.0 pinned) | Done 2026-11-16, merged as `0868bb4`. zod 4.6.7, typescript 7.0.2, vitest 5.1.0. |
| 3 | Schemas and the ruleset contract, then freeze | Done and frozen 2026-11-16, `ca5c92b`. 144 tests pass. Design notes and the orchestrator's review: `docs/m1/contract-notes.md`. |
| 4 | Implementation of derivation, reduction and effective level by one agent, contract tests by another, both after the freeze | Done 2026-11-16. Implementation and 185 contract tests merged; all 386 tests pass. |
| 5 | Table of axe rules per RGAA test, and theme packets for entry writers | Done 2026-11-16, merged as `aa4cdd9`. 67 rules, 40 tests, as the spec says. `pnpm packets` writes 13 packets, 595 KB in all; theme 1 is 121 KB, so split it between writers by criterion. |
| 6 | Pilot of 14 entries, usage projection | Guide and brief written. Not launched: after step 4. |
| 7 | Entries by theme | Not started |
| 8 | Check-in at 65%, with Codex's cross-check | Not started |
| 9 | Minimum useful set | Not started |
| 10 | Gate package for Fabien | Not started |

## In flight

Nothing. The fixture fix was merged on 2026-11-16 at 21:25 UTC: 386 tests pass, typecheck is clean, and no expected result was changed. Step 4 is done.

## Stopped for Fabien, 2026-11-16 21:17 UTC

All-models is at 63%, two points under the check-in at 65%, and no entry is written. The pilot is **not launched**. Waiting for his decision on how to continue (see the cost log).

## Next, in order

1. Done: the fixture fix is merged and `pnpm test` is fully green.
2. Launch the pilot when Fabien says so: one Opus builder, high effort, `isolation: worktree`, brief `docs/m1/brief-pilot.md` (14 entries). The guide it follows is `docs/m1/entry-guide.md`.
3. Review the 14 entries against the packets. Project the pilot's usage to 258 entries in `docs/cost-log.md`.
4. Ask Codex to cross-check the pilot entries (bridge, channel `rgaa-assist`, then Fabien prompts Codex).
5. Fix the guide from the pilot's feedback, then write the remaining entries criterion by criterion. `checks.json` is shared: keep it sorted by id and resolve merges by taking both sides.

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

- Spec 6.1 says a `none` entry is "always needs review", but 8.3 gives `not_tested` at any level when the target was not established or a check errored. The contract follows 8.3.
- The first row of the 8.3 case table ("an advisory fault, no resolving check") cannot occur on a `full` entry: 6.2 requires a resolving link for every requirement. It occurs only below `full`.

- Spec 8.5 says a reason is required "unless passed or failed", but 8.2 gives no reason list for `not_applicable`. The contract follows 8.2.
- The contract's first draft hid a failure in one corner of the process rule (a step whose page as loaded was not established but whose declared state failed). Found in the orchestrator's review and amended before the freeze.
- An unlogged lowering of `enabled` makes an entry run as `none`, not at the lower level. Stricter than the spec's wording, and safe.

- One glossary anchor in the official data resolves to nothing: `#table-descriptions-techniques`, in a technical note of criterion 5.1. The other 115 resolve. The packet for theme 5 lists it.

## Open points for Fabien

None.
