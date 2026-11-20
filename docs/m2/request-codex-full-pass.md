# Request to Codex: full M2 pass after the Q56 corrections

**2026-11-21**, from the M2 orchestrator. Repository `~/Documents/rgaa-assist`, main at the commit named in the bridge message that sends this request, or later. Read-only: edit nothing in the repository; write your report in your own outputs folder and send its path on the bridge.

Your review of 2026-11-20 (`rgaa-m2-independent-review-2026-11-20.md`) held the gate on four findings and listed five items of work still required. Fabien decided the four findings (Q56 in `docs/decisions.md`) and asked for a full pass after the corrections. This is that pass: the five items, and a re-check of the four corrections.

## Re-check the four corrections (Q56)

1. 10.1.2: `align` on `fieldset` is no longer a defined pair and abstains; the `lists.json` rationale on `height` on `table` is corrected; the abstention on `height` on `table` (Q50) is kept on purpose.
2. Snippets drop the contents of editable boxes (`contenteditable` not `false`; roles `textbox`, `searchbox`, `combobox`), with redactions counted. Your fixture is a test. Check also whether any check's notes can still carry such text.
3. False assurance counts any unexpected `passed` or `not_applicable`, swaps included, with the population stated.
4. Per-link tables are gone; per-test numbers only; per-link measurement recorded as M5 work required before any entry is enabled (`docs/m2-kickoff.md` gate wording).

## The five items of your report, in full

1. **All ten implementations against their full records** (`src/checks/custom/`, records in `src/rulesets/rgaa-4.1.2/checks.json`). Classify every `RECORD:` point in `docs/m2-status.md` as faithful, narrowing or widening, with proof. In particular: 11.8.2's clipping (shapes beyond `clip-path: inset()` are not computed: can that ever turn an invisible list into a visible one and so produce a fault the record does not support?), and fault precedence beside unreadable frames in 2.1.1, 6.2.1, 11.1.1 and 11.8.2 (the gate package's order, which the records do not spell out).
2. **The full source audit of the 10.1.2 defined pairs** in `src/checks/custom/10-1-presentation-attributes/lists.json`, every pair against HTML 4.01 and the current HTML standard (conforming and obsolete features), `applet` included, and Q50's table-height rationale.
3. **All 92 expected labels** in `corpus/working/` against the official text and spec 8.3, at each level the schema allows, including the cases the writer did not write and the readings it flagged (`docs/m2-status.md`).
4. **The Aubay comparison** in `docs/m2/runs.md`, reconciled with the recorded observations in `work/m2/runs/aubay/run.json` (gitignored, local; Q53: quote no more than locators and short snippets), and **every manifest field** of both run files against spec 8.8, with the full derivation path.
5. Targeted fixtures for the measurement definitions. Privacy channel tests stay at M3.

## Format

Findings with file and line, the text each contradicts, and whether it blocks the gate. Then a disposition: hold or pass, and what you did not cover. Counts as "x of n", never a rate.
