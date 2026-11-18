# M2 brief: axe adapter (module builder)

You are a module builder on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You build the axe adapter.

## Read first

1. `docs/decisions.md` (it wins), then `docs/spec.md` sections 2, 5.1, 8.3 ("What two outcomes mean"), 8.5, 8.6.
2. `src/checks/types.ts`: the interface you implement. Do not change it; if it does not fit, stop and report.
3. `src/schema/run.ts` (`ObservationSchema`, `EvidenceSchema`), `src/rulesets/rgaa-4.1.2/axe-rules.json` (the 67 rules) and the 67 `axe/` records in `src/rulesets/rgaa-4.1.2/checks.json`.

## You own

`src/checks/axe/` (new) and `tests/checks/axe/` (new). In `src/rulesets/rgaa-4.1.2/checks.json` you may change only one thing: `"exists": false` to `"exists": true` on the `axe/` records your adapter implements and your tests exercise. Change no other field, no `examines` text (even where it says the adapter is not built yet), no other record.

## What to build

- `axeProvider: CheckProvider`, exported from `src/checks/axe/index.ts`, declaring one `CheckDefinition` per rule of `axe-rules.json` (id `axe/<rule>`). Version string: name the axe-core version and your adapter version, for example `axe-core@4.14.0+adapter.1`.
- Run axe-core 4.14.0 through `@axe-core/playwright` 4.14.0 (both installed and pinned) on `ctx.page`, **exactly the 67 rules** (run them even if axe disables some by default; check that each one actually ran), over every frame axe can reach. `@axe-core/playwright` needs a page created from a `BrowserContext` (it opens a blank page in the same context to finish); the engine provides such a page. Record the effective options (rules run, result types, frame settings) in `defaultOptions` so the engine writes them into the manifest and each observation.
- Map each rule's result to one `CheckRunResult`:
  - any `violations` node: `fault`. One `dom_node` evidence per node: `locator` = the node's target (frames joined in a documented way), `snippet` = the node's HTML, `note` = the failure summary. Keep `incomplete` nodes of the same rule as extra evidence.
  - no violation, any `incomplete` node: `cannot_tell`, with the nodes and their messages as evidence.
  - only `passes` nodes: `no_fault`, with one `scope_examined` evidence: how many nodes passed, and a capped list of locators (choose a cap, record it).
  - listed in `inapplicable`: `inapplicable`, with `scope_examined` evidence saying the rule found no matching element in the frames examined.
  - not reported in any list: `CheckFailure` `check_error`, "rule not reported".
  - **Frames axe could not test.** If any frame could not be analysed (find out how axe 4.14.0 and `@axe-core/playwright` report this, for example through `frame-tested`, and test it), the scope was not fully examined: a `no_fault` or `inapplicable` becomes `cannot_tell`, with evidence naming the frame. A `fault` stays a `fault`.
  - Do not sanitise and do not truncate: the engine does both. Do not write files.
- **Fingerprint**: stable for the same fault on another page: the check id plus a hash of the rule's failing axe check ids and the nodes' HTML, sorted. For other outcomes, `<checkId>:<outcome>`.
- If axe itself throws, return `check_error` for every declared check with the message.

## Tests

- Vitest under `tests/checks/axe/`. One Chromium per test file, a `BrowserContext` per test. **No network**: build pages with `page.setContent`, or serve them offline with `context.route` on made-up hosts (for example `https://main.test/` and `https://other.test/` for a cross-site frame). The engine's own fixture server is being built in parallel; do not wait for it.
- Cover: a fault with evidence; `no_fault` with its scope; `inapplicable`; `cannot_tell` from incomplete; a cross-site frame whose fault is found; a frame axe cannot test turning `no_fault` into `cannot_tell`; a rule disabled by default that still runs; all 67 rules declared and reported on a simple page; every result valid against `ObservationSchema` once given ids (write a small helper in your tests that adds `id`, evidence ids and `redactions: 0`, and validate).
- `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass.

## Rules

- Set up with `pnpm install --offline --frozen-lockfile`. Add no dependency, download nothing, load no real site.
- No output, log or test name states or implies conformance, or shows a rate or score.
- Commit on your branch, messages ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Reply with: branch and last commit; what you built; test counts; how axe reports untested frames and what you did; any rule whose behaviour differs from its record's `examines` text or from what `axe-rules.json` says (a hard stop for the orchestrator, so say it plainly); gaps; your token use if you know it.
