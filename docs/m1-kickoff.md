# M1 kickoff brief

For the orchestrator (Fable 5.2, high effort). Written 2026-11-15, after Fabien approved the spec.

You are starting milestone M1 of rgaa-assist. You split the work, brief the builders, review every diff and run the gate. You write no feature code and no coverage entries.

## Read first, in this order

1. `docs/decisions.md`. It wins over everything else.
2. `docs/spec.md`, whole. Sections 2, 6, 8.3, 8.4, 10 and 14 govern M1.
3. This brief. Where it disagrees with the spec, the spec wins and you tell Fabien.

## What M1 delivers (spec 14.1)

- **The candidate coverage map:** 258 entries for RGAA 4.1.2, each with requirements, routes, links, `candidate`, `applicability`, `needs` and a rationale that cites the official wording.
- **The minimum useful set** (6.4): a short list of tests v1 must decide correctly, proposed for Fabien.
- **All schemas and types:** sample file, run file, coverage map, corpus case, evaluation summary, including target execution, processes and `expect`.
- **The ruleset plug-in contract** (5.2) with contract tests.
- **Nothing enabled.** Every entry has `enabled: none`.

No engine, no browser, no reports, no corpus cases. Those are M2 and later.

## Confirmed with Fabien on 2026-11-16

M1 started that day. `docs/m1-status.md` says where it stands now: read it before anything else if you are taking over.

1. **Start and baseline.** He used a limit reset and started M1. Baseline in `docs/cost-log.md`: weekly all-models 45%, weekly Fable 2%. The ceilings are counted from that baseline (Q38, below).
2. **Commits.** Authorised for the whole of M1: builders commit on their own branches in their own worktrees, and the orchestrator merges to main after reviewing the diff. No remote, no push.
3. **Official data.** Authorised and fetched: `criteres.json`, `glossaire.json` and `methodologies.json` from `DISIC/accessibilite.numerique.gouv.fr` at commit `ca4019f95073b6cbd2482a16e9f12b52d8de678d`. axe-core 4.14.0 from npm is authorised too. Anything else to download needs a new yes.
4. **If Fable 5.2 becomes unavailable (Q39),** Opus 5.5 at high effort takes over as orchestrator, under this same brief.

## Order of work

1. **Vendor the official data** with its source commit and attribution. Verify the counts: 13 themes, 106 criteria, 258 tests. A different count is a hard stop.
2. **Schemas and the ruleset contract first.** One builder. Then freeze them. No entry is written before the freeze.
3. **Contract tests** (list below). They must pass before entries start.
4. **A pilot of about 12 entries** across at least three themes. Measure usage per entry and project the total. If the projection exceeds the ceiling, stop and ask.
5. **Entries in batches by theme.** One writer per theme directory at a time.
6. **The 20% check-in** (below).
7. **Codex's cross-check** of all entries, then corrections.
8. **The minimum useful set**, chosen from entries whose candidate level is argued most firmly.
9. **The gate package** for Fabien.

## Contract tests that must exist

From the spec:

- Every row of the case table in 8.3.
- The approval case in 6.3: removing `keyboard` from `needs` on an approved `full` entry makes it run as `none`.
- The process cases in 8.4: failed plus missing gives `failed`, incomplete; passed plus missing gives `not_tested`.
- An empty set reduces to an error (8.4).
- `enabled` never exceeds `candidate`.

From Codex's re-check of 0.4, which are not in the spec text:

- **Inputs are validated before derivation.** An entry with no requirement, or a malformed observation, is rejected. It is never derived.
- **Raising after a manual demotion needs the approver again.** Cover `full` to `fail_only` to `full`, and `full` to `none` to `full`. An old record with the same hash and level never restores the level.
- **A check-version suspension is different.** It restores only the level already authorised, once the corpus cases pass on the new version. It never undoes a manual demotion and never authorises edited content.

M1 also fixes the exact meaning of the `state`, `keyboard` and `media` prerequisites (17.1). Write them into the contract and tell Fabien what you chose.

## Rules for writing entries (spec 6)

- **Cite or abstain.** The rationale quotes the official test, glossary or methodology text. An interpretation that cannot be derived from them is not made: the entry stays `none` (6.5).
- **Be conservative.** `candidate` argues what the tool could conclude, and Fabien approves the argument. Over-claiming is the main route to false assurance. Under-claiming costs little.
- **List every route and exception** of each requirement. A missed alternative is the most serious error an entry can contain.
- **An axe RGAA tag justifies a link and nothing more.** `faultMeans`, `routes` and `scope` are argued from the official text and the rule's actual behaviour.
- **`failure` only when the check examines every route and exception.** Otherwise `evidence_only`.
- **Resolving is a strong claim.** Declare it only for a check that examines every route and exception for every applicable element.
- **Test 1.1.6 is the reference case.** The spec gives its answer in 6.1 and 6.2. An entry that contradicts it is wrong.

One point the spec leaves open: most custom checks do not exist yet. Keep a registry of checks (id, kind, what it must examine, whether it exists) as an M1 schema, and let links refer to ids in it. Do not add fields to the link schema for this. If that does not work, stop and ask.

## Roles (spec 14.2, decision Q37)

| Role | Model | In M1 |
|---|---|---|
| Orchestrator | Fable 5.2, high. Opus 5.5, high, if Fable is unavailable (Q39). | You. Briefs, diff review, gate, logs. |
| Core builder | Opus 5.5, medium to high | Schemas, contract, contract tests, coverage entries. |
| Module builder | Sonnet 5.5, low to medium | Vendoring the official data, the table of axe rules per RGAA test, the script that validates entries against the schema. |
| Reviewer | Codex | Cross-checks entries. Reviews the gate. Edits nothing in this repo. |

- Each builder works in its own git worktree and is told which directories it owns.
- A builder's own report is not evidence. Read the diff and run the tests.
- The agent that writes a contract test is not the agent that writes the code it tests.
- Changing who writes entries is Fabien's decision. Do not write entries yourself, even to fix one.

## Working with Codex

- Codex reads bridge messages only at its next prompt. To get a review, send the message, then ask Fabien to prompt Codex.
- Use the `rgaa-assist` channel: `bridge -P rgaa-assist …`. Keep secrets off the bridge.
- Log each decision you take with `bridge decision`, and set `bridge status` while agents are writing.

## Budget and stops (spec 14.3)

- The figures below are counted from the 45% all-models baseline (Q38).
- **Stop when the weekly all-models limit reaches 85%.**
- **Stop if the Fable weekly limit passes 50%.** This no longer applies if Opus orchestrates (Q39).
- **Check-in when all-models reaches 65%.** Pause the builders, then report to Fabien:
  - how many of the 258 entries are done (under half means stop and re-split the work);
  - the result of Codex's cross-check of the entries written so far, with errors counted by kind of entry: axe-linked, several routes, needs state or keyboard or media, structural applicability, other;
  - the usage so far, by role.
- If the errors suggest the entries are not good enough, stop and ask Fabien. Do not switch models yourself.
- If M1 does not fit, it continues after the next reset. Do not cut scope to make it fit.
- Add one line per role to `docs/cost-log.md` at the check-in and at the gate: model, effort, tokens, share of plan used, API-equivalent cost.

## Hard stops (spec 14.4)

Stop and ask Fabien when:

1. Something would change a decision in `docs/decisions.md`.
2. There is any ambiguity about the claim boundary (spec 2).
3. A ceiling above is reached.
4. The gate has failed twice.
5. A source differs from what the spec assumed: RGAA text, criteria data, a licence, a tool's behaviour.

Everything else you decide, and log on the bridge.

## The gate package for Fabien

M1 is done when all of this is true, and you have shown it to him:

- Tests are green, including every contract test above.
- All 258 entries validate against the schema, cite the official text, and have `enabled: none`.
- Codex has cross-checked the entries and reviewed the gate. Its findings are answered or listed as open.
- You have reviewed every diff.

Give Fabien one page:

- Counts of entries by `candidate` level and by theme.
- The proposed minimum useful set, with one line of reasoning per test.
- A spot-check list: the 10 entries where a wrong reading would matter most, with their rationale.
- What Codex found and what was done about it.
- The meanings chosen for `state`, `keyboard` and `media`.
- The cost log, and a proposed ceiling for M2.
- Anything you are unsure of.

His approval of M1 approves the candidate map and the schemas. It enables nothing.

## What you must not do

- Declare or imply conformance, or compute any rate, anywhere, including in logs and summaries.
- Enable an entry.
- Start M2 work.
- Change the spec. If it is wrong, say so and stop.
