# M2 brief: custom checks of the minimum useful set (core builders)

You are a core builder on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You implement **one family** of the ten custom checks behind the minimum useful set; your launch message names it. Two other builders implement the other families at the same time.

| Family | Checks (registry ids) | Tests |
|---|---|---|
| A, document | `custom/8-5-page-title-present`, `custom/8-3-default-lang-present`, `custom/8-4-default-lang-code-valid`, `custom/8-2-id-duplicate` | 8.5.1, 8.3.1, 8.4.1, 8.2.1 |
| B, presentation | `custom/10-1-presentation-elements`, `custom/10-1-presentation-attributes` | 10.1.1, 10.1.2 |
| C, tree | `custom/2-1-frame-title-attribute`, `custom/6-2-link-content-name`, `custom/11-1-field-label-mechanism`, `custom/11-8-optgroup-label-attribute` | 2.1.1, 6.2.1, 11.1.1, 11.8.2 |

## Read first

1. `docs/decisions.md` (it wins; Q40, Q43, Q45, Q49, Q50 matter here), then `docs/spec.md` sections 2, 5.1, 8.3 ("What two outcomes mean"), 8.5, 10.5.
2. **Your checks' records** in `src/rulesets/rgaa-4.1.2/checks.json` (the `examines` text), and the coverage entries that link them (`src/rulesets/rgaa-4.1.2/coverage/<theme>/<test>.json`): their requirements, routes, exceptions and rationale.
3. `src/checks/types.ts` (the interface; do not change it), `src/schema/run.ts` (`ObservationSchema`), and the engine: `src/engine/` with its test helpers in `src/engine/testing/` (`withTarget`, `observe`, the two-origin fixture server and its `__CROSS_ORIGIN__` placeholder).
4. `docs/m1/gate-package.md` ("For the M2 briefs") and `docs/m1/dry-run-aubay.md`: what real pages did to these readings.

## The rule that matters most

**A check implements its record exactly as written** (Q50). The record was approved by Fabien; it is the specification. If a record cannot be implemented as written, or your implementation would have to be narrower or wider than the text, or the browser does not behave the way the record assumes: **do not adapt the check silently.** Implement the closest faithful reading, mark the spot with a `// RECORD:` comment, and list it in your report. The orchestrator takes it to Fabien. Never edit an `examines` text or a coverage entry.

Notes from M1 for the builders (gate package and dry run):
- A definite fault wins over an unread frame; an unread frame comes before `inapplicable`.
- `height` on `table` gives `cannot_tell` under `custom/10-1-presentation-attributes` (neither HTML 4.01 nor the HTML standard's lists of conforming or obsolete attributes define it; the standard's rendering section only maps it as a presentational hint).
- `frameborder` on an `iframe` inserted by a third-party script is a fault under 10.1.2 (Q49). The document *inside* a cross-origin frame is a separate matter, where the record's abstentions apply.
- The engine reads cross-origin frames through Playwright: `ctx.frames` lists every frame with `readable`. "A nested document the check cannot read" means a frame with `readable: false`, or an evaluation in it that fails.

## You own

- `src/checks/custom/<name>/` for each check of your family (for example `src/checks/custom/8-5-page-title-present/`), and one folder for helpers shared inside your family only: `src/checks/custom/family-a/`, `family-b/` or `family-c/`.
- `tests/checks/custom/<name>/` for each of your checks.
- In `src/checks/custom/index.ts`: add your providers to the exported list, one line per provider, and nothing else. The other families do the same; the orchestrator resolves the merge.
- In `src/rulesets/rgaa-4.1.2/checks.json`: only `"exists": false` to `"exists": true` on your family's records, once each check is implemented and tested. No other change.

Touch nothing else. Do not edit `src/engine/`, `src/schema/`, `src/checks/types.ts`, `corpus/`. You may read `corpus/working/` cases if they are in your checkout and run your checks on them to compare; never edit a case. A disagreement between a case and your check goes in your report.

## How to build each check

- A `CheckProvider` per check (or one per family) implementing `src/checks/types.ts`. `CheckDefinition.version`: `1.0.0`. Where the record pins a list (fonts, blank-looking characters, language codes), put the list in the check's folder as data, give it a version, and record that version in `defaultOptions`.
- Examine the DOM with `frame.evaluate` in each frame of `ctx.frames`, with as few round trips as you can (real pages have thousands of elements; aim for a few seconds at most). Read the accessibility tree with `Accessibility.getFullAXTree` through `ctx.cdpFor(frame)` where the record speaks of exposure in the accessibility tree.
- **Read only.** No clicks, focus moves, scrolling, navigation, or DOM or style changes that outlive your own evaluation. `custom/8-2-id-duplicate` reads the DOM before any other check changes it: the engine runs custom providers before axe.
- Outcomes and evidence as `src/checks/types.ts` says: a `fault` names each faulty element (a locator a human can use, and a short raw snippet: the engine sanitises and caps it); `no_fault` and `inapplicable` carry `scope_examined` evidence (what was examined, how many, in which frames); `cannot_tell` says which branch of the record abstained and on what. Fingerprints stable across pages (`<checkId>:<what>`).
- Return `CheckFailure` only for a real failure to run; a nested document the record says to abstain on is `cannot_tell`, not an error.

## Tests

- Vitest under `tests/checks/custom/<name>/`, through `observe(provider, files)` from `src/engine/testing/` so every result goes through the engine's sanitiser and `ObservationSchema`. One Chromium per test file. **No network**: only the local fixture server.
- **One test per numbered branch of the record**, plus: hidden elements where the record says they count; a cross-site frame (`__CROSS_ORIGIN__`); a shadow tree where the record mentions one; XHTML (`.xhtml`) where the record speaks of case or XML; an element inserted by script after load where the dry run met one. Name each test after the branch it covers.
- `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass.

## Rules

- Set up with `pnpm install --offline --frozen-lockfile`. Add no dependency, download nothing, load no real site.
- No output, log or test name states or implies conformance, or shows a rate or score.
- Commit on your branch, messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Reply with: branch and last commit; per check, its branches and the test that covers each; every `// RECORD:` point (record unclear, not implementable as written, or the browser behaving unlike the record), quoted with what you did; any disagreement with a working-set case; how long each check takes on your largest fixture; your token use if you know it.
