# Request to Codex: focused recheck of the Q60 corrections

**2026-11-21, from the M2 orchestrator.** Read-only, as before. Fabien approved the five items of your final pass on `1c58636` (HOLD) as Q60 (`docs/decisions.md`). They are merged. Please recheck **only** these commits and the cases they affect, and say whether your HOLD changes.

## What to recheck

| Item | Commit | What changed | Where |
|---|---|---|---|
| 1. 11.8.2 rounded inset | `727e269` (branch commit `7c6fba3`) | `parseInset` returns null when the `inset()` has a `round` part, so visibility is unknown and 11.8.2 gives `cannot_tell`. 11.8.2 is 1.0.3. Only 11.8.2 reads visibility; 2.1.1, 6.2.1 and 11.1.1 are not affected. | `src/checks/custom/family-c/scan.js`; tests in `tests/checks/custom/11-8-optgroup-label-attribute/check.test.ts` (your fixture) |
| 2. 8.3.1 editable witness, snippets | `727e269` (branch commit `5702693`) | A text node under an editable ancestor (`contenteditable` not `false`, any case; `designMode` on) or in a field is never a witness. Sweep: 8.5.1's title snippet and family C's `snippetOf` wrap text from inside an editable box in that box's start tag, so the sanitiser masks it and counts a redaction. Versions: 8.3.1 1.0.1, 8.5.1 1.0.1, 2.1.1/6.2.1/11.1.1 1.0.2. | `src/checks/custom/family-a/page/{witness,common,title-main}.js`, `src/checks/custom/family-c/scan.js`; tests in the 8.3.1, 8.5.1 and 6.2.1 test files |
| 3. Unexpected-error count | `727e269` | A missing observation is unexpected when the expected status differs or the expected reason is given and differs. | `src/evaluation/evaluate.ts`; `tests/evaluation/evaluate.test.ts` (your probe) |
| 4. 6.2.1 record | `727e269` | Hidden-subtree sentence reworded; no code change. | `src/rulesets/rgaa-4.1.2/checks.json`, record `custom/6-2-link-content-name` |
| 5. Aubay counts | `8a83f32` | 7 of 10 same elements, 3 of 10 more elements or another step, 10 of 10 same outcome. | `docs/m2/runs.md` |

New working-set cases (`3b4b2eb`): `corpus/working/11.8.2/11.8.2-outside-rounded-clip-hides-select`, `corpus/working/8.3.1/8.3.1-outside-no-lang-text-in-editable-box`.

## Results on main

- `pnpm test` 914 of 914 (48 files), typecheck and `validate-coverage` pass.
- `pnpm evaluate`: matched 97 of 97 cases on corpus working@c08d0a84f819; false assurance 0 of 97, missed fault 0 of 35, false alarm 0 of 62, unexpected error 0 of 97 (`corpus/results/working-20261121T190737Z.json`).
- Both audits rerun at `6e53a70`: valid, outcomes, finding counts and redaction counts unchanged.

## What the builder did not test

`designMode` in a framed document; 2.1.1 and 11.1.1 snippets inside an editable box (shared `snippetOf`, tested through 6.2.1); the saved run file (the marker test reads the observation from `observe`). If you find any of these leaks, say so.

Nothing is enabled; no rate is computed.
