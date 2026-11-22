# Request to Codex: focused recheck of the Q61 fix

**2026-11-22, from the M2 orchestrator.** Read-only, as before. Fabien approved the fix for the one blocker of your Q60 recheck (`rgaa-q60-focused-recheck-2026-11-22.md`) as Q61 (`docs/decisions.md`). Please recheck **only** the merge `373fb38` (branch commit `bdf3fa2`) and say whether your HOLD changes.

## What changed

- **One definition.** `src/engine/editable-box.json` lists the textbox-like roles (textbox, searchbox, combobox). `src/engine/sanitise.ts` reads it (`TEXTBOX_ROLE_LIST`, `isEditableBox` now exported). Family C receives it in `ScanArg.textboxRoles` (`family-c/read.ts`, `scan.d.ts`); family A through `helpersExpression()` in `family-a/page.ts` (`C.textboxRoles`). The contenteditable and role rules are repeated in the page scripts (`family-c/scan.js`, `family-a/page/common.js`) and pinned by an agreement test.
- **Guards.** `guardEditable` in `family-c/scan.js` (element snippets of 2.1.1, 6.2.1, 11.1.1, 11.8.2, and the optgroup snippet) and in `family-a/page/common.js` (8.5.1 title) treat a role ancestor as editable, as the sanitiser does.
- **Axe.** Your probe's full run also leaked through `axe/link-name` (axe's `node.html` has no ancestors). `src/checks/axe/editable.ts`, called from `runAxe`, wraps any axe snippet found inside an editable box's markup (any readable frame, open shadow roots, `designMode`) in that box's start tag. Adapter version 2. Known limits: it matches on the first 120 characters of the markup, so it can over-redact a twin outside a box; the wrapper closes with `</div>` whatever the box's element.
- **Versions:** 2.1.1, 6.2.1, 11.1.1 1.0.3; 11.8.2 1.0.4; 8.5.1 1.0.2; axe checks `axe-core@4.14.0+adapter.2`.

## Tests

`tests/engine/editable-role-ancestors.test.ts` runs `runAudit` on a locally served page and reads the saved `run.json`: your `role="textbox"` fixture, `searchbox`, `combobox`, `presentation TextBox`, and a contenteditable variant; for each, 6.2.1 still faults, the marker is absent from the file and every observation, and at least one redaction is counted. Control: the same link outside a box keeps its text. 8.3.1 with `role="textbox"` text and no `lang` does not fault, marker absent. Agreement test: 12 start tags through the sanitiser and the family A guard.

## Results on main

- `pnpm test` 922 of 922 (49 files), typecheck and `validate-coverage` pass.
- `pnpm evaluate`: matched 97 of 97 cases on corpus working@c08d0a84f819; false assurance 0 of 97, missed fault 0 of 35, false alarm 0 of 62, unexpected error 0 of 97 (`corpus/results/working-20261122T150554Z.json`).
- Both audits rerun at `1aa611d`: valid; outcomes, finding counts and redaction counts unchanged.

Nothing is enabled; no rate is computed.
