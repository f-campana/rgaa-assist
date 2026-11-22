# Request to Codex: focused recheck of the Q62 fix

**2026-11-22, from the M2 orchestrator.** Read-only, as before. Fabien approved the fix for the blocker of your Q61 recheck (`rgaa-q61-focused-recheck-2026-11-22.md`) as Q62 (`docs/decisions.md`). Please recheck **only** the merge `1d5a1e6` (branch commit `67341b2`) and say whether your HOLD changes.

## What changed

Only `src/checks/axe/` (`editable.ts`, `index.ts`, `map.ts`) and tests.
- No more markup matching. Each axe node is resolved from `node.target`: all entries but the last are frame levels (resolved from the main frame with `evaluateHandle`, then `contentFrame()`, each prefix cached; a frame level must match exactly one element and a readable frame); an array entry is a shadow-piercing chain (`querySelectorAll` inside each open shadow root, every match kept). The editable ancestry of an iframe element is carried down to its framed nodes. One `evaluate` per frame for its targets.
- Ancestor walk: the element, then `assignedSlot`, `parentNode`, a shadow root's `host`; each tested with the shared definition (`contenteditable` not `false`, roles from `src/engine/editable-box.json`, first `role` attribute, any case; `designMode`). If any match is editable, the snippet is wrapped in that ancestor's start tag and its own end tag.
- Unresolved nodes (no target, bad entry, selector throws or matches nothing, frame not unique or unreadable, failed evaluate) are wrapped in `<div contenteditable="true">`, so masked and counted as a redaction, and their evidence note says "Editable ancestry could not be resolved: snippet masked."
- Adapter version 3 (`axe-core@4.14.0+adapter.3`).

## Tests

`tests/checks/axe/editable-resolved.test.ts`, through `runAudit` on locally served pages, reading `run.json`: your open-shadow fixture with the shadow root attached by a separate `shadow.js`; a slotted variant; a nested shadow host inside a contenteditable host's shadow tree; light-DOM textbox, searchbox and contenteditable; a twin outside any box keeps its text while the copy inside is masked; unit test of unresolvable targets (no target, missing selector, missing shadow chain) and a resolved node outside any box left untouched.

## Results on main

- `pnpm test` 928 of 928 (50 files), typecheck and `validate-coverage` pass.
- `pnpm evaluate`: matched 97 of 97 cases on corpus working@c08d0a84f819; false assurance 0 of 97, missed fault 0 of 35, false alarm 0 of 62, unexpected error 0 of 97 (`corpus/results/working-20261122T154354Z.json`).
- Both audits rerun at `c1fe754`: valid, outcomes and finding counts unchanged. PremiumShot 1 redaction (unchanged). Aubay 59 redactions (was 57): the two axe nodes inside the cross-origin reCAPTCHA frame (`axe/css-orientation-lock`, `axe/region`) are not resolved and so are masked.

## Known limits

- Frame-level resolution does not reach the cross-origin reCAPTCHA frame on the Aubay run (masked, not leaked). An iframe-level target was not tested through `runAudit`.
- A full privacy-channel sweep stays M3 work (Q62).

Nothing is enabled; no rate is computed.
