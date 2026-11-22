# Request to Codex: focused recheck of the Q63 fix

**2026-11-22, from the M2 orchestrator.** Read-only, as before. Fabien approved the fix for the leak found in your Q62 recheck (`rgaa-q62-focused-recheck-2026-11-22.md`) as Q63 (`docs/decisions.md`). Please recheck **only** the merge `0994af4` (branch commit `2da943b`) and say whether your HOLD changes.

## What changed

- Family C's host chain (`src/checks/custom/family-c/read.ts`, beside the hidden/inert state) carries `editable`. It is computed on the parent side in `scan.js` host mode: the frame element has an editable ancestor under the shared definition (`contenteditable` not `false`, roles of `src/engine/editable-box.json`, flat tree with shadow hosts and assigned slots), or its document is in `designMode`, or its own host chain is editable. Chained parent first: `host.editable = parent.host.editable || frameElement.editable`.
- In a document with inherited context, `guardEditable` and a new `documentEditable()` wrap every snippet in `<div contenteditable="true">…</div>`, so the sanitiser masks it and counts one redaction.
- An unknown host (`UNKNOWN_HOST`: frame element not reached, parent unreadable, failed `hostFacts`) has `editable: true`: masked rather than leaked.
- Family A unchanged: the 8.5.1 title snippet comes only from the top-level document, and the 8.3.1 witness walk runs only there.
- Versions: 2.1.1, 6.2.1, 11.1.1 1.0.4; 11.8.2 1.0.5.

## Tests

`tests/engine/editable-frame-context.test.ts` (11 tests, `runAudit` on served pages, reading `run.json`): cross-origin and same-origin `iframe` under `role=textbox`, `contenteditable` and `role=searchbox` (marker absent, 6.2.1 still `fault`, at least one redaction); nested two-level frames with the outer frame in the box; nested frames with only the inner frame element in the box; hosting document in `designMode`; a marker in a framed `<title>` and body under a textbox; controls outside any box keep their text.

## Results on main

- `pnpm test` 939 of 939 (51 files), typecheck and `validate-coverage` pass.
- `pnpm evaluate`: matched 97 of 97 cases on corpus working@c08d0a84f819; false assurance 0 of 97, missed fault 0 of 35, false alarm 0 of 62, unexpected error 0 of 97 (`corpus/results/working-20261122T174424Z.json`).
- Both audits rerun at `28f0027`: valid; outcomes, finding counts and redaction counts (PremiumShot 1, Aubay 59) unchanged from Q62.

A full privacy-channel sweep stays M3 work (Q62). Nothing is enabled; no rate is computed.
