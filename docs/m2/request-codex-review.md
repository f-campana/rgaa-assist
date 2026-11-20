# Request to Codex: independent review of the M2 gate

**2026-11-20**, from the M2 orchestrator. Repository `~/Documents/rgaa-assist`, main at the commit that adds this file or later. Read-only: edit nothing in the repository; write your report in your own outputs folder and tell us its path on the bridge.

## What M2 delivered (spec 14.1, decisions Q50 to Q55)

Read `docs/m2-status.md` first: it lists every merge, every builder's reading of its record (`RECORD:` points) and every finding so far.

- Engine (`src/engine/`): sample reading, a fresh Chromium context per target, frames and CDP sessions, providers, the minimal sanitiser, derivation and reduction wiring, the run file.
- Axe adapter (`src/checks/axe/`).
- The ten custom checks of the minimum useful set (`src/checks/custom/`), each against its record in `src/rulesets/rgaa-4.1.2/checks.json`.
- Working set (`corpus/working/`, 92 planted cases) and harness (`src/evaluation/`, `pnpm evaluate`); results in `corpus/results/working-20261118T200029Z.json`.
- CLI (`src/cli/`).
- Two runs, summarised in `docs/m2/runs.md`. The run folders are in the gitignored `work/m2/runs/`; you may read them locally. Aubay's page content stays out of anything you publish beyond locators and short snippets, as in `docs/m2/runs.md` (Q53).

## What we ask you to review

1. **Checks against their records.** For each of the ten custom checks, does the code implement its `examines` text? List every departure, and say whether each `RECORD:` point in `docs/m2-status.md` is a faithful reading, a narrowing, or a widening. A widening that can produce a fault the record does not support is a blocker.
2. **10.1.2 defined pairs.** `src/checks/custom/10-1-presentation-attributes/lists.json` was completed from the builder's memory, with no source. Verify against HTML 4.01 and the current HTML standard (conforming and obsolete features) the pairs beyond the record's examples, above all `align` on `fieldset` and `embed`, and `background` on `thead`, `tbody`, `tfoot`. A pair that neither defines must not fault.
3. **Working-set labels.** Do the expected results in `corpus/working/` follow from the official text and spec 8.3, at both levels? The writer listed cases it did not write and readings that pull apart (in `docs/m2-status.md`).
4. **Engine and run file.** Do the run files validate, are the manifests complete (spec 8.8), does derivation get the observations it should, and does the run say nothing that implies conformance or a rate (spec 2)? Note `--site-per-process` and the facts the run file has no field for.
5. **Sanitiser.** Any obvious channel the M2 rules miss for a public page (the full channel tests are M3).
6. **The Aubay comparison** in `docs/m2/runs.md`: is every difference from the dry run explained correctly (above all 6.2.1 step (3) against step (4))?
7. **Harness counts.** The reading of "false assurance" logged on the bridge; anything in 10.3 the harness gets wrong.

## Format

A list of findings, each with: where (file and line), what is wrong, which text it contradicts, and whether it blocks the gate. Then anything you would hold the gate for. Counts as "x of n", never a rate.
