# Brief: schemas and the ruleset contract

For the core builder (Opus 5.5). Written by the orchestrator on 2026-11-16.

You define the data shapes and the ruleset plug-in contract of rgaa-assist. Everything later in the build depends on them, and they are frozen when you finish. You do not implement the logic behind the contract: another agent does, and a third writes the contract tests. Your work has to let both start without talking to you.

## Read first

1. `docs/spec.md`, whole. Sections 2, 3, 5, 6, 7, 8, 10.2, 10.3 and 13 are the ones you encode.
2. `docs/decisions.md` for anything that looks ambiguous. It wins over the spec.
3. `docs/m1-kickoff.md`, sections "Contract tests that must exist" and "Rules for writing entries".
4. `src/rulesets/rgaa-4.1.2/official/`: look at the structure of the three JSON files. Do not edit them.

If the spec is wrong or contradicts itself, do not fix it and do not work around it silently. Stop and report the exact passage.

## What you deliver

All under `src/schema/` and `src/rulesets/`, plus one notes file. Zod 4 is installed. Define each schema once, export the inferred TypeScript type from it, and make a JSON Schema obtainable from it (spec 13).

### 1. Schemas (`src/schema/`)

- **Sample file** (spec 7): every field of 7.1 to 7.3, the five step actions and no others, `expect`. Encode the rules the spec calls invalid: no pages; `authenticated: true` without `session.storageState`; a state other than `initial` without `expect`; an authenticated page without `expect`. Things that 7.5 calls warnings are not schema errors.
- **Run file** (spec 8.2, 8.5, 8.8): statuses, reasons, `TargetExecution`, `Observation`, `Evidence`, `Finding`, `ModelSuggestion`, the reduced results at the four levels of 8.4 with `complete` and what did not run, the manifest, the three statements of section 2 as data, sample warnings. Keep the field names of 8.5.
- **Coverage entry** (spec 6.1, 6.2), described below.
- **Check registry**: one record per check id, with its kind (`axe`, `custom`, `model`), what it must examine, and whether it exists yet. Links refer to ids in this registry. Most custom checks do not exist yet, so the registry is how an entry can name a check that is still to be built. Do not add fields to the link for this.
- **Approval records** (spec 6.3), described below.
- **Evaluation summary** (spec 8.6, 10.3): per link and per enabled entry, the expected-against-actual table over the five statuses plus crashes and missing observations, the corpus hash, the scope covered, and the version of each linked check that was measured.
- **Corpus case** (spec 10.1, 10.2): source, licence, adaptation, test, branch, exact expected status, and the engine cases.

### 2. The coverage entry in detail

Keep the eight fields of the table in 6.1. Inside them:

- **Requirements, routes and exceptions each carry the official words they come from.** Give each an id that is stable inside the entry, a short statement in English, and one or more citations.
- **A citation** names its source and quotes it: the test's own lines in `criteres.json`, the criterion's `particularCases` or `technicalNote`, a glossary entry, or the test's methodology. The quote must be a verbatim excerpt, so a script can check it against the vendored files. Define exactly what "verbatim" means for that script (for instance, whitespace-normalised substring) and say so in the notes.
- **`rationale`** holds the argument in prose plus its citations. An entry with no citation is invalid.
- **Structural rules the schema or a validation function must enforce** (schema refinement or a separate exported `validateEntry`, your choice, but one place):
  - `enabled` is never above `candidate`.
  - Every link names a requirement that exists, and its `routes` are ids of that requirement's routes or exceptions.
  - `faultMeans: failure` only when the link's `routes` list every route and every exception of the requirement (spec 6.2).
  - "Resolving" is derived, never stored: all routes and exceptions, with `scope: whole`. Export the function that computes it.
  - `candidate: full` only when every requirement has a resolving link. `candidate: fail_only` only when at least one link has `faultMeans: failure`.
  - An entry has at least one requirement.
  - Every link's check id exists in the registry (this one needs the registry, so it belongs to the validation function).
- **Files.** One JSON file per test: `src/rulesets/rgaa-4.1.2/coverage/<theme>/<test id>.json`, for example `coverage/01/1.1.6.json`. The registry is one JSON file beside the `coverage/` folder. Create no entry file: writing entries is a later step and not yours. You may put small fixture entries under `tests/fixtures/` if you need them to check your schemas.

### 3. The entry hash and approvals (spec 6.3, decision Q36)

- **`entryHash(entry)`**: sha256 over a canonical serialisation of every field except `enabled`. Define the canonical form precisely (key order, array order, string normalisation) in the notes.
- **Approval records** must make all of the following decidable from data alone. Design the record shape and the storage file so they are:
  - An approval authorises one level for one entry hash, by named approvers. `full` needs Fabien. `fail_only`, or a link moving to `failure`, needs the orchestrator and Codex together, with corpus cases.
  - Lowering `enabled` is free and keeps the approval valid at the lower level, with a logged reason.
  - Any other edit changes the hash, and the entry runs as `none` until approved again.
  - **Raising after a manual demotion needs the approver again.** `full` to `fail_only` to `full`, and `full` to `none` to `full`, both need a new approval. An old record with the same hash and level never restores the level by itself. This probably means demotions are records too, in an ordered log: decide and justify.
  - **A check-version suspension is different.** When a linked check's version differs from the one measured in the evaluation summary, the entry runs as `none` until its corpus cases pass on the new version. That needs no new approval. It restores only the level already authorised. It never undoes a manual demotion and never authorises edited content.
- Export the signature of the function that answers "at what level does this entry run now", given the entry, the approval log, the evaluation summary and the current check versions. Stub its body.

### 4. The ruleset plug-in contract (spec 5.2)

`src/rulesets/contract.ts`: the TypeScript interface a plug-in provides. `id`, `version`, the official data in typed form (themes, criteria, tests with their wording lines, particular cases, technical notes, glossary, methodologies, the source commit), the coverage map, `deriveFindings`, `reduce`, `checkSample`.

- **`deriveFindings`** implements spec 8.3: one target, its `TargetExecution`, the observations, the entries with their effective levels, giving one `Finding` per test with `requirementFacts`.
- **Inputs are validated before derivation.** An entry with no requirement, or a malformed observation, is rejected and never derived. Make the rejection a typed result or a typed error, and say which.
- **`reduce`** implements spec 8.4: the one ordered rule, the four levels, the process rule with a missing step, and an empty set as an error.
- **`checkSample`** (spec 7.5): signature only.
- Put the functions that are not specific to RGAA 4.1.2 in a shared place under `src/rulesets/` so a second ruleset could reuse them, and export them as named functions. **Stub every body** with a thrown "not implemented" error. Signatures, parameter types, return types and doc comments are yours. Bodies are not.
- Add the typed loader for the official RGAA 4.1.2 data (this one you do implement and test: it only reads and types the vendored files).

### 5. Prerequisites (spec 8.3, open point 17.1)

The orchestrator has fixed their meaning. Encode it in the contract as doc comments and types:

- **`state`**: met on a target only when it is an established declared state other than `initial`. So a test that needs `state` is `needs_review` with `prerequisite_unmet` on every `initial` target, and a page can never be reduced to `passed` or `not_applicable` for that test on the strength of a declared state alone.
- **`keyboard`**: met on a target only when the engine completed its keyboard pass on it: focus moved through the tab sequence and the sequence was recorded. No such pass exists yet, so it is unmet until one is built.
- **`media`**: met on a target only when the engine completed a timed observation pass on it, with media allowed to play. No such pass exists yet, so it is unmet until one is built.
- **`model`**: met only to produce suggestions. For deriving a status it is never met.
- **`assistive_tech`**: never met in v1.

If one of these cannot be encoded cleanly, say why in the notes. Do not change it.

### 6. Notes (`docs/m1/contract-notes.md`)

Two pages at most, plain English, short sentences. For the two agents who build on your work and for the person who approves it:

- Each design choice you made that the spec did not dictate, in one or two sentences, with the reason.
- Each place where the spec was unclear and how you read it.
- Anything you think is wrong or risky.

## Rules

- You own `src/schema/`, `src/rulesets/` except `src/rulesets/rgaa-4.1.2/official/` and `src/rulesets/rgaa-4.1.2/axe-rules.json`, and `docs/m1/contract-notes.md`. Another agent is working in `scripts/` at the same time. Touch nothing else. Add no dependency.
- Test your schemas with small unit tests beside them (`*.test.ts`): valid and invalid examples for each structural rule above. Do not write tests for `deriveFindings`, `reduce` or the effective-level function: that is the test writer's job, and it must stay independent of you.
- The claim boundary (spec 2) is a hard rule. No type, field or comment may hold or imply a conformance rate, score or verdict.
- `pnpm typecheck` and `pnpm test` must pass.
- Run `pnpm install` first: your worktree has no `node_modules`.
- Commit on your worktree's branch. Do not merge, switch branches or push. End the commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Report back

Short. The branch and commit, the files created, the test and typecheck output tails, the list of choices from your notes in one line each, and anything you stopped on.
