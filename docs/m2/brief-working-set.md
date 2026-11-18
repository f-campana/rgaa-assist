# M2 brief: working-set cases for the minimum useful set (core builder)

You are a case writer on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You write the first labelled cases of the working set: planted pages for the ten tests of the minimum useful set. **You write cases, never checks.** The checks are being written by other agents who will never write cases for them (spec 10.5). Do not read or write anything under `src/checks/custom/`.

## Read first

1. `docs/decisions.md` (it wins; note Q40, Q43, Q45 to Q50), then `docs/spec.md` sections 2, 6, 8.2, 8.3, 10.
2. `src/schema/corpus.ts` (the case shape you must follow exactly), `src/schema/coverage.ts` (rationale and citations), `src/rulesets/shared/derive.ts` (how a status follows from observations), `src/rulesets/rgaa-4.1.2/citations.ts` (how citations are verified).
3. For each test: its entry in `src/rulesets/rgaa-4.1.2/coverage/<theme>/<test>.json`, the records in `src/rulesets/rgaa-4.1.2/checks.json` of every check it links, and the official text (criterion, test lines, methodology, glossary). `pnpm packets` writes theme packets with the official text into `work/packets/`; read the ones you need.
4. `docs/m1/gate-package.md` and `docs/m1/dry-run-aubay.md` (for the kind of pages real sites have).

## The ten tests

| Test | Candidate level | Applicability | Custom check |
|---|---|---|---|
| 8.5.1 | full | always | `custom/8-5-page-title-present` |
| 10.1.1 | full | read the entry | `custom/10-1-presentation-elements` |
| 10.1.2 | full | read the entry | `custom/10-1-presentation-attributes` |
| 11.8.2 | full | structural | `custom/11-8-optgroup-label-attribute` |
| 8.3.1 | fail_only | always | `custom/8-3-default-lang-present` |
| 8.4.1 | fail_only | read the entry | `custom/8-4-default-lang-code-valid` |
| 2.1.1 | fail_only | read the entry | `custom/2-1-frame-title-attribute` |
| 6.2.1 | fail_only | read the entry | `custom/6-2-link-content-name` |
| 11.1.1 | fail_only | read the entry | `custom/11-1-field-label-mechanism` |
| 8.2.1 | fail_only | read the entry | `custom/8-2-id-duplicate` |

## You own

`corpus/working/` (new) and `tests/corpus/` (new). Touch nothing else.

## What to write

- One folder per case: `corpus/working/<test>/<case-id>/` holding `case.json` (a `TestCaseSchema` case, `kind: "test"`) and the page files, `index.html` first in `files`. Case ids are unique across the corpus, for example `8.5.1-valid-title-in-head`.
- **Expected results, exactly (10.2).** For each case give `expected.fail_only` and `expected.full`: the status, and the reason whenever the derivation rules fix it, for an entry running at that level with every linked check implemented exactly as its record says. Work it out from spec 8.3 and `derive.ts`, including the links that are `evidence_only` (an axe fault through such a link changes nothing) and the `always` rules (Q40, Q43). The harness measures each entry at its candidate level; both expectations must still be right.
- **Branches (10.2, 10.4 point 4).** For each `full` entry: at least one `valid`, one `invalid_fault_proves_failure`, one `inapplicable` where applicability is `structural`, one valid case per route, one case invalid by one route and valid by another where the entry has several routes, and the **mixed pair** of 10.4 (two elements valid by different routes: expected `passed`; one valid element beside one with no valid route: never `passed`). For each `fail_only` entry: every fault its failure link promises, valid cases, and the main `cannot_tell` branches of the check record (`outside_support`). Aim for 5 to 10 cases per test; cover the branches before adding variants.
- **Cases that matter for real pages:** Q49 (a third-party-style `iframe` inserted by a script, carrying `frameborder`, under 10.1.2); a field inserted by script with no label (11.1.1, as in the dry run); a duplicate `id` added by script (8.2.1); a cross-site frame for the tests whose records read frames. For a second, cross-site origin, write URLs as `__CROSS_ORIGIN__/path`: the harness serves the case folder on two origins and replaces that placeholder with the second one. XHTML cases are files ending `.xhtml` (served as `application/xhtml+xml`).
- **Labels come from the official text** (6.5, Q30). The rationale states why the expected status is what it is and cites the official wording (test lines, methodology, glossary) in the same citation form the coverage entries use, so the citation checker can verify it. Where only the check record supports a branch (an abstention, for example), say so. Where the official text does not settle the label, do not write the case: list it in your report.
- `source: { kind: "planted", author: "<your model name>" }`, `licence`: "Planted for rgaa-assist; no third-party material.", `adaptation: null`. Do not copy third-party markup (no real reCAPTCHA code: imitate its shape).
- Pages are self-contained: no request to anything but the case folder and `__CROSS_ORIGIN__`. Scripts inline or local.

## Tests

`tests/corpus/working.test.ts`: every `case.json` under `corpus/working/` validates against `CorpusCaseSchema`; every listed file exists and the first is the page; ids are unique; every citation verifies against the vendored official text; the folder's test matches `test`; no file references a host other than `__CROSS_ORIGIN__`. `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass.

## Rules

- Set up with `pnpm install --offline --frozen-lockfile`. Add no dependency, download nothing, visit no site.
- No label, rationale or file name states or implies conformance of anything, or shows a rate or score.
- You never see `corpus/acceptance/` (it does not exist; do not create it).
- Commit on your branch, messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Reply with: branch and last commit; cases per test and per branch (a table); cases you did not write because the official text does not settle them, with the question; any place where an entry or a check record seems to contradict the official text (a finding for Fabien, not something to fix); your token use if you know it.
