# Contract notes: schemas and the ruleset contract

Written by the core builder (Opus 5.5) on 2026-11-16. For the agents who implement and test the contract, and for the person who approves it. The code is the reference; this page says why.

## Where things are

- `src/schema/`: every schema, defined once in Zod 4, with its type. `jsonSchema(name)` gives the JSON Schema. A JSON Schema holds the shapes only; the cross-field rules run when parsing with Zod.
- `src/rulesets/contract.ts`: the plug-in interface, the typed official data, and the input, output and error types of `deriveFindings` and `reduce`.
- `src/rulesets/shared/`: ruleset-neutral functions. `deriveFindings`, `reduceSet`, `reduce`, `effectiveLevel` and `checkSample` are stubs that throw `NotImplementedError`. Their doc comments are the specification to build and test from.
- `src/rulesets/rgaa-4.1.2/`: the official-data loader, the citation checker, the coverage-map loader, `checks.json` (the registry, empty) and `approvals.json` (the log, empty). No entry file exists.

## Choices the spec did not dictate

- **Strict objects everywhere.** An unknown field is an error, so nothing (a score, a confidence) can slip into a file unseen.
- **Check ids carry their kind:** `axe/…`, `custom/…`, `model/…`. The registry checks that the kind matches.
- **No link may name a `model/` check.** Derivation is deterministic and model output never changes a status (2.7, 8.3, 9). How model checks attach to tests is left to M6.
- **Ids inside an entry** (requirements, routes, exceptions) are unique across the whole entry. One link per (check, requirement) pair.
- **Citations** have five sources: a test's lines (optionally one line, 1-based), a criterion's `particularCases` or `technicalNote`, a glossary entry by exact title, a test's methodology. The criterion title is not a source, because the brief did not list it.
- **"Verbatim"** means: after Unicode NFC and collapsing every whitespace run (no-break spaces included) to one space, the quote is a substring of the source. Nothing else is folded: ’ and ' differ, case differs. Each source is accepted in two forms: as stored, and as plain text (Markdown links reduced to their label; glossary HTML with tags removed and five entities decoded). Implemented in `shared/quote.ts` and `rgaa-4.1.2/citations.ts`, and run by the coverage-map loader.
- **Entry hash.** sha256 of the canonical JSON of the entry without `enabled`: keys sorted by UTF-16 code unit, arrays in stored order, strings exactly as stored (no normalisation), no whitespace. Reordering an array is an edit. `coverageMapHash` hashes all entries, `enabled` included, sorted by test.
- **Approval log.** One append-only file per ruleset. Events are `approval` (test, hash, level, approver roles, corpus cases, summary hash) and `demotion` (test, lower level, reason). `seq` must be 1, 2, 3… so a removed or moved event fails validation. The *last* approval for a test fixes the authorised hash and level; later demotions cap it. Nothing before that approval counts, so after a demotion only a new approval raises the level, whatever old records say. I chose an ordered log because "raising needs the approver again" can only be decided from the order of events.
- **`enabled` must equal the authorised level.** Otherwise the entry runs as `none` (`enabled_mismatch`). This catches a raise without approval, and also an unlogged lowering: that is the only way to stop a lowered-then-raised entry from silently regaining its level.
- **Approver roles.** `full` needs `fabien`. `fail_only` needs `orchestrator` and `codex`. An entry with any `failure` link needs `orchestrator` and `codex` at `full` too, since it lets the tool say "failed" (`requiredApprovers`).
- **Check-version suspension.** The evaluation summary holds one measurement per entry: its hash, the level measured, the version of each linked check, and the per-case results. The entry runs at its authorised level only when that measurement has the current hash, a level at or above the authorised one, the current version of every linked check, and every case matched. This needs no approval and can never exceed the authorised level.
- **Corpus cases state their expected result for both enabled levels** (`fail_only`, `full`), because 10.2 makes the expected status depend on the level. A demotion then never forces a relabel. The branch-to-status table of 10.2 is not enforced by the schema.
- **Case results** are stored per case with a `matched` flag; the 10.3 table is derived from them and checked to agree. The four measures are read from the table, never stored.
- **Observation gets one added field, `error`,** present exactly when the outcome is `error`, with kind `check_error` or `scope_unreadable`. Without it, derivation could never give the `scope_unreadable` reason. Also: `no_fault` and `inapplicable` must carry `scope_examined` evidence; a `fault` must carry some evidence.
- **Run file additions:** `approvalLogHash` in the manifest, the effective level of each test (`effectiveLevels`), and `modelDisclosures` (spec 9). The statements state a count of decided tests, never against a total.
- **Sample file:** a declared state needs at least one step, and `initial` cannot be declared. A state without steps is the page as loaded, and would let a `state` prerequisite be met by it. `fill` and `press` take `{ locator, value }` and `{ key, locator? }`. URLs must be http or https. A page's `service` is not checked against `services`: 7.5 surfaces typos as a warning.
- **Derivation and reduction return typed results, not thrown errors,** and are all-or-nothing: one bad input rejects the whole call. Rejection and error codes are listed in `contract.ts`.

## Places where the spec was unclear, and how I read them

- **Reason precedence for `needs_review`** (8.3 step 4.3 lists conditions, not an order). I fixed: `assistive_tech_required` (section 15 says those tests carry it), `no_check`, `not_enabled`, `prerequisite_unmet`, `checks_disagree`, then the unresolved reasons.
- **`cannot_tell` against `alternative_unresolved`.** The 8.3 case table gives `alternative_unresolved` when an advisory fault meets a resolving `cannot_tell`. So: `alternative_unresolved` when an unresolved requirement has any fault; else `cannot_tell` when a resolving link abstained; else `alternative_unresolved`.
- **"reports a fault through an `evidence_only` link"** (unresolved, 8.3) is read as a *resolving* link with `evidence_only`. Read as any link, it would contradict the case "advisory fault, resolving `no_fault` → passed".
- **`not_tested` reason precedence:** `missing_observation`, then `scope_unreadable`, then `check_error`.
- **`model_disabled`** has no production rule in 8.3. It is reserved for M6 and never produced by `deriveFindings`.
- **A page in two processes** is reduced over the steps of both. A process step whose `initial` target was not established counts as missing, like an absent page (8.4).
- **Reduced results carry `reasons`,** the distinct reasons of the inputs with the winning status, because the report grid shows a reason per criterion and page (12).
- **`testsDecided`** in the statements counts tests with `passed`, `failed` or `not_applicable` on at least one examined target.

## What I think is wrong or risky

- **Spec defect, not worked around silently.** 8.2 says reasons exist for `needs_review` and `not_tested` only. The 8.5 comment on `Finding.reason` says "required unless passed or failed", which would require a reason on `not_applicable`, yet no reason list exists for it. I encoded 8.2: no reason on `passed`, `failed` or `not_applicable` (`reasonFitsStatus`). This needs the orchestrator's confirmation.
- **The prerequisite rule of 6.2** ("a test that needs keyboard, state or AT work cannot be `full` on checks that do not do that work") is not checkable from data: the registry does not say what work a check does. It stays a review rule.
- **`enabled_mismatch` makes an unlogged lowering run as `none`,** not at the lower level. Safe, but a reviewer may find it strict.
- **The registry lives inside the RGAA 4.1.2 folder,** as the brief asked, while 5.1 says checks belong to no ruleset. A second ruleset would need its own copy or a move to a shared file.
- **Approval roles are names, not identities.** The log proves what was recorded, not who recorded it. Git history is the only audit trail.
- **Refinements run on partly invalid data** (Zod 4 continues after some errors), so one bad field can produce a second, derived message. Validation is still correct; messages may be redundant.
