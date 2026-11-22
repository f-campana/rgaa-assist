# M2 brief: Q62, axe snippets resolved in the page

You are a builder on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You apply Fabien's ruling Q62 (end of `docs/decisions.md`; read Q56, Q61 and Q62). Codex's finding: `~/Documents/Codex/2026-11-11/che/outputs/rgaa-q61-focused-recheck-2026-11-22.md` (short; read it), probe `~/Documents/Codex/2026-11-11/che/work/q61-review/probe-shadow-clean.mjs`. The budget is tight: work directly, run the full suite once at the end.

## The defect

`src/checks/axe/editable.ts` decides whether an axe snippet sits inside an editable box by searching the first 120 characters of `node.html` in each box's `outerHTML`. A host's `outerHTML` has no shadow tree, so with `<div id="editor" role="textbox"></div>` whose open shadow root (attached by a separately served script) holds `<a href="#"><span aria-hidden="true">synthetic private marker</span></a>`, `axe/link-name` writes the marker into `run.json` unredacted (6.2.1 is redacted).

## You own

`src/checks/axe/` and `tests/checks/axe/`, plus the new tests named below. Touch nothing else: no custom check, no sanitiser change unless it only exports something you need, no coverage entry, no record, no `corpus/` file, no docs, no dependency.

## What to do

1. Replace the markup matching. For each axe node (every result list the adapter maps), resolve the element from `node.target`: with `@axe-core/playwright`, an entry of the target array per frame level (frame selectors, then the element), and an entry that is itself an array is a shadow-piercing chain (host selector, then selectors inside each open shadow root). Check the actual shape in `node_modules/axe-core` and in a quick fixture before relying on it. Resolve it in the right frame (the adapter's `ctx.frames`), then walk its flat-tree ancestors, the element itself included (`assignedSlot`, then `parentNode`, a shadow root's `host`), and test each with the shared definition: `contenteditable` not `false` (any case, first occurrence), a role token in `src/engine/editable-box.json` (`TEXTBOX_ROLE_LIST`, first `role` attribute, any case), or the document's `designMode` on. If one is editable, wrap the snippet in that ancestor's start tag (as now, so the sanitiser masks it and counts one redaction); close with the matching end tag of that element, not a fixed `</div>`.
2. A node that cannot be resolved (no target, selector not found, frame unreadable, several matches for an ambiguous selector where any match is editable): wrap it too, so it is masked rather than leaked, and count it in a note or field the adapter already has (say where).
3. Keep the work in as few page round-trips as reasonable (one evaluate per frame with all its targets, for instance). Bump `ADAPTER_VERSION` to 3 and update the pins that name the adapter version.

## Tests (against the saved `run.json`, through `runAudit` on locally served synthetic pages, as `tests/engine/editable-role-ancestors.test.ts` does)

- Codex's open-shadow fixture, with the shadow root attached by a script in a **separate file** (so the marker is not in the page's own markup): marker absent from `run.json`, at least one redaction.
- A slotted variant: a `role="textbox"` host whose shadow root has a `<slot>`, with the light-DOM link (and marker) slotted into it.
- The existing light-DOM role and contenteditable fixtures still pass.
- A twin: the same link markup and marker text outside any editable box keeps its text in `axe/link-name` (this is what the old markup matching over-redacted), while the copy inside a box is masked.
- An unresolvable target is wrapped (unit test on the adapter's guard with a fabricated node).

## Rules

- `pnpm install --offline --frozen-lockfile`; first check your branch contains main's latest commit (`git merge --ff-only main` if behind). Download nothing, load no real site.
- `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass. Run `pnpm evaluate` and report its counts; commit no results file and **do not delete** any committed file under `corpus/results/`.
- Commit on your branch, messages ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Branch and last commit; the target shapes you found and how each is resolved; how unresolved nodes are handled and counted; tests; adapter version; `pnpm evaluate` counts; token use if known.
