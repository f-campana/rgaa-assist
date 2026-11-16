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
| 6 | Pilot of 14 entries, usage projection | Done 2026-11-16, merged as `51880bb`. Projection in the cost log. |
| 7 | Entries by theme | Not started |
| 8 | Check-in at 65%, with Codex's cross-check | Not started |
| 9 | Minimum useful set | Not started |
| 10 | Gate package for Fabien | Not started |

## In flight

Nothing on the Claude side. **Codex has been asked to cross-check the 14 pilot entries** (bridge message of 2026-11-16, channel `rgaa-assist`). Fabien has to prompt Codex. Its report will be in `~/Documents/Codex/2026-11-12/rgaa-independent-spec-review/outputs/` or on the bridge.

## Check-in, 2026-11-16 22:35 UTC

All-models at 67%, past the 65% check-in. 14 of 258 entries are written: 8 `none`, 5 `fail_only`, 1 `full` (8.3.1). All validate; 386 tests pass. Under half the entries, so the rule says stop and re-split. Reported to Fabien with the projection in `docs/cost-log.md`. **No more entries until he decides.**

## Rulings the pilot asked for

Taken by the orchestrator, to confirm with Codex's cross-check before the guide is changed:

1. **`full` with a check that abstains.** Spec 6.2 allows it: a resolving check answers `cannot_tell` where it cannot resolve. So a test may be `full` when its check decides the mechanical cases and abstains on exactly the judgment cases, provided the boundary between the two is itself mechanical. The guide's sentence "nothing in the test needs judgment" is stricter than the spec and will be corrected. The pilot applied the strict reading to 2.1.1 and 6.2.1, which is safe: they can be raised later.
2. **One defect that fits two tests** (empty `title` under 2.1 or 2.2, empty `lang` under 8.3 or 8.4, and so on). No official text assigns it, so the entries abstain in both and keep the fault as evidence. Stays that way: cite or abstain.
3. **Hidden elements.** No official text says whether elements that are not rendered or are `aria-hidden` count. Checks abstain on them. Stays that way.
4. **Open, for Codex and then Fabien:** `scope: whole` for a check that looks at every element but abstains on some; a tagged axe rule that examines no route (left out, explained in the rationale); what `applicability` means for a test that always applies.

## Next, in order

1. Read Codex's cross-check. Count its findings by kind of entry: axe-linked, several routes, needs state or keyboard or media, structural applicability, other. Send corrections to an Opus builder.
2. Correct `docs/m1/entry-guide.md` from the pilot's feedback and Codex's findings (the rulings above, the no-break space in one glossary title, how to record an axe rule that examines no route).
3. Write the remaining 244 entries as Fabien decides, criterion by criterion. Brief pattern: `docs/m1/brief-pilot.md`. `checks.json` is shared: keep it sorted by id and resolve merges by taking both sides.

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
