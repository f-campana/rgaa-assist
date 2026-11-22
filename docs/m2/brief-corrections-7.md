# M2 brief: Q63, editable context inherited across frames by the custom checks

You are a builder on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You apply Fabien's ruling Q63 (end of `docs/decisions.md`; read Q56, Q60, Q61, Q62 and Q63). Codex's finding: `~/Documents/Codex/2026-11-11/che/outputs/rgaa-q62-focused-recheck-2026-11-22.md` (short; read it), probe `~/Documents/Codex/2026-11-11/che/work/q62-review/probe-frame-saved.mjs`. The budget is tight: work directly, run the full suite once at the end.

## The defect

A cross-origin `iframe` inside `<div role="textbox">` in the parent document; a link in the framed document holds a synthetic marker. `axe/link-name` masks it (Q62), but `custom/6-2-link-content-name` writes the marker into `run.json`: the family C `guardEditable` in `src/checks/custom/family-c/scan.js` walks ancestors only within the framed document. Family A has the same gap for 8.5.1's title snippet in a framed document (`title-main.js` through `common.js` `guardEditable`), and for any 8.3.1 witness logic that reads framed documents (`witness.js`).

## You own

`src/checks/custom/family-c/`, `src/checks/custom/family-a/`, the check `index.ts` files whose versions change, and their tests, plus the new test file below. Touch nothing else: no sanitiser change unless it only exports something you need, no axe file, no coverage entry, no record, no `corpus/` file, no docs, no dependency.

## What to do

1. **Inherited context.** For each frame a family scans, establish whether its hosting frame element, or any frame element further up the chain, has an editable ancestor under the shared definition (`contenteditable` not `false`, roles of `src/engine/editable-box.json`, `designMode` of the hosting document), walking each parent document's flat tree as the guards already do. Family C already carries hosting-frame state for hidden/inert (RECORD point C3): find that plumbing and add the editable state beside it. Compute it from the parent side (the parent document can read its own frame element even when the child is cross-origin), and pass it down into the scan of the child document, chained through every level.
2. **Guards.** When a document inherits editable context, every snippet carrying text from it is wrapped so the sanitiser masks it and counts one redaction (the `designMode` wrapper `<div contenteditable="true">…</div>` is fine for this). In family A: 8.5.1's title snippet in such a framed document is wrapped; if 8.3.1 ever takes a witness or snippet from a framed document, text in such a document is never a witness (check what the record and code do: the record's witness place is the top-level document). If a frame's editable state cannot be established (frame element not found, parent not readable), treat it as editable (mask rather than leak).
3. Bump each check whose snippets or behaviour change to its next patch version.

## Tests (through `runAudit` on locally served synthetic pages, reading the saved `run.json`, as `tests/engine/editable-role-ancestors.test.ts` does)

- Codex's fixture: a cross-origin `iframe` (use the fixture server's second origin, `__CROSS_ORIGIN__`) inside `<div role="textbox">`, a link in the framed document holding a marker: the marker is absent from `run.json` (6.2.1 and every other observation), at least one redaction counted.
- The same with a same-origin `iframe`.
- A nested two-level frame (the outer frame inside the editable box, the link in the inner frame).
- A `contenteditable` host variant, and an 8.5.1 title-in-frame variant if the title snippet carries text.
- Control: the same frame outside any editable box keeps its text.

## Rules

- `pnpm install --offline --frozen-lockfile`; first check your branch contains main's latest commit (`git merge --ff-only main` if behind). Download nothing, load no real site.
- `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass. Run `pnpm evaluate` once and report its counts; commit no results file and **do not delete** any committed file under `corpus/results/`.
- Commit on your branch, messages ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Branch and last commit; how the inherited state is computed and passed, per family; what happens when it cannot be established; each snippet path changed; tests; versions; `pnpm evaluate` counts; token use if known.
