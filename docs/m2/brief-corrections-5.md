# M2 brief: Q61, textbox-role ancestors in snippet guards

You are a builder on rgaa-assist, a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree. You apply Fabien's ruling Q61 (end of `docs/decisions.md`; read Q56, Q60 and Q61). Codex's finding: `~/Documents/Codex/2026-11-11/che/outputs/rgaa-q60-focused-recheck-2026-11-22.md` (short; read it), probes `~/Documents/Codex/2026-11-11/che/work/q60-review/probe-role-ancestor.mjs` and `probe-saved-run.mjs`. The budget is tight: work directly, run the full suite once at the end.

## The defect

`src/engine/sanitise.ts` treats an element as an editable box when its start tag has `contenteditable` other than `false` or a `role` whose tokens include `textbox`, `searchbox` or `combobox` (`TEXTBOX_ROLES`, `isEditableBox`). The in-page snippet guards (`guardEditable` in `src/checks/custom/family-c/scan.js` and in `src/checks/custom/family-a/page/common.js`, used by `title-main.js`) wrap a snippet in its editable ancestor's start tag only for `contenteditable` or `designMode`. So with `<div role="textbox"><a href="/"><span aria-hidden="true">synthetic private marker</span></a></div>`, 6.2.1 faults and its snippet carries the marker into `run.json` with 0 redactions.

## You own

`src/engine/sanitise.ts` (only to share its definition), `src/checks/custom/family-c/`, `src/checks/custom/family-a/`, any other snippet builder under `src/checks/custom/` that needs the same guard, and their tests. Touch no coverage entry, no record, no `corpus/` file, no docs, no dependency.

## What to do

1. **One definition.** Put the editable-box definition (the `contenteditable` rule and the role tokens, with the first-occurrence and case rules the sanitiser uses) in one place that both the sanitiser and the in-page guards read, so they cannot drift. The page scripts cannot import TypeScript: pass the role list in from the TypeScript side (as the scripts already receive arguments), or keep it in a small JSON file both read. A test pins that the guards and the sanitiser agree on the same list of start tags.
2. **Guards.** Every `guardEditable` treats an ancestor as editable when the sanitiser would: `contenteditable` not `false`, or a role token in the list, walking the flat tree as now; `designMode` stays. The wrapper must carry the ancestor's start tag (with its `role`) so the sanitiser masks the text and counts one redaction. Check the other evidence paths that put text in a snippet (family A and C, and any other custom check) and apply the same guard where text from a descendant could leave an editable box; list what you looked at.
3. **8.3.1 witness:** `witness.js` already excludes elements with any `role` from the walk (record step (a)); confirm, and add a role=textbox test if missing.
4. **Tests.** Codex's fixture, and the same with `role="searchbox"` and `role="combobox"` (and a mixed-case role token such as `role="presentation TextBox"`): 6.2.1 still gives its outcome, the marker is absent **from the saved run file** (run `runAudit` on a locally served synthetic page, as `probe-saved-run.mjs` does, and read `run.json`), and the redaction count is at least 1. A control: the same link outside any editable box keeps its text. Bump each check whose snippets change to its next patch version.

## Rules

- `pnpm install --offline --frozen-lockfile`; first check your branch contains main's latest commit (`git merge --ff-only main` if behind). Download nothing, load no real site.
- `pnpm test`, `pnpm typecheck`, `pnpm validate-coverage` must pass. Run `pnpm evaluate` and report its counts; commit no results file, and **do not delete** any committed file under `corpus/results/`.
- Commit on your branch, messages ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not merge, push or run bridge commands.

## Report

Branch and last commit; where the shared definition lives and how each side reads it; each guard and evidence path looked at, changed or not; the tests; versions; `pnpm evaluate` counts; token use if known.
