# Brief: the axe table and the theme packets

For the module builder (Sonnet 5.5). Written by the orchestrator on 2026-11-16.

You build two generated artefacts that the people writing coverage entries will work from. Both are derived mechanically from vendored data. You interpret nothing.

## Context you need

- rgaa-assist will map each of the 258 RGAA 4.1.2 tests to checks. An entry writer needs, for each test, the official wording, its methodology, the glossary entries it refers to, and the axe-core rules tagged for it. Reading the raw files for that is slow and error-prone, so you prepare it.
- Official data: `src/rulesets/rgaa-4.1.2/official/` (`criteres.json`, `glossaire.json`, `methodologies.json`). Never edit it.
  - `criteres.json`: `topics[]` with `number`, `topic`, `criteria[].criterium` holding `number`, `title`, `tests` (object keyed by test number, each value a list of lines: the question, then its conditions), `references`, and sometimes `particularCases` and `technicalNote`.
  - `methodologies.json`: one string per test id such as `1.1.6`.
  - `glossaire.json`: `glossary[]` of `{ title, body }`, the body in HTML. The wording refers to glossary entries with Markdown links such as `[image objet](#image-objet)`.
- `axe-core` 4.14.0 is installed. Its rules carry tags; RGAA ones name a test.
- You do not need the spec. One fact from it: an axe tag only says a rule is relevant to a test. It never says the rule decides the test. Do not write anything that suggests otherwise.

## Deliver

### 1. The axe table

- `scripts/build-axe-table.ts`, run with `pnpm axe-table` (Node 24 runs `.ts` directly; add the script to `package.json`).
- It writes `src/rulesets/rgaa-4.1.2/axe-rules.json`, committed, with deterministic ordering:
  - the axe-core version;
  - for each rule that has at least one RGAA test tag: its id, the RGAA test ids, all its tags, whether it is best-practice, whether it is experimental, whether it is enabled by default, and its `description`, `help` and `helpUrl`;
  - an index from RGAA test id to rule ids.
- `tests/axe-table.test.ts`:
  - the committed file equals what the script generates now;
  - every RGAA test id in it exists in `criteres.json`;
  - it has 67 rules covering 40 distinct tests. These two figures come from the spec. **If you get different numbers, do not adjust anything.** Leave the assertion failing, and report the numbers you found and how you counted. That is a finding the orchestrator must take to the project owner.
- Find out how the tags are spelled by looking at the package. Say in your report how you read the rule metadata and the enabled-by-default flag.

### 2. The theme packets

- `scripts/build-packets.ts`, run with `pnpm packets`. It writes one Markdown file per theme into `work/packets/` (`theme-01.md` to `theme-13.md`). `work/` is gitignored: the packets are regenerated, never committed.
- Each packet holds, in order:
  1. The theme number and name, and counts of its criteria and tests.
  2. For each criterion: its number and title, its `particularCases` and `technicalNote` when present, its `references`.
  3. Under it, for each test: the id, every line of its wording, its methodology, and the axe rules tagged for it (id, help text, and the best-practice, experimental and enabled-by-default flags).
  4. At the end, each glossary entry that the theme's wording, particular cases or technical notes link to, once each, with its title and body.
- **Everything official is reproduced exactly**, character for character, in fenced or quoted blocks, each labelled with where it comes from (for example `criteres.json 1.1.6 line 2`, `glossaire.json "Image objet"`). Entry writers will copy quotes from the packet, and a script will check them against the vendored files. Do not fix typography, do not translate, do not convert the glossary HTML.
- Work out how a link anchor such as `#image-objet` maps to a glossary title. If any anchor used in `criteres.json` cannot be resolved, do not guess: list the unresolved anchors at the top of the packet and in your report.
- `tests/packets.test.ts`: generating twice gives identical output; every test id appears in exactly one packet; every anchor is either resolved or listed as unresolved. Have the test generate into a temporary directory, not into `work/`.

## Rules

- You own `scripts/`, `tests/axe-table.test.ts`, `tests/packets.test.ts`, `src/rulesets/rgaa-4.1.2/axe-rules.json`, and the `scripts` block of `package.json`. Another agent is working in `src/schema/` and the rest of `src/rulesets/` at the same time. Touch nothing else. Add no dependency.
- `pnpm test` and `pnpm typecheck` must pass, except for the one deliberate failure described above if the counts differ.
- Run `pnpm install` first: your worktree has no `node_modules`.
- Commit on your worktree's branch. Do not merge, switch branches or push. End the commit message with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

## Report back

Short. The branch and commit, the two counts you found, how the tags and flags are read, the unresolved anchors if any, the size of the largest packet, and the test and typecheck output tails.
