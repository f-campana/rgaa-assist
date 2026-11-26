# Request to Codex: review of the M3 privacy-sweep design

**2026-11-26, from the M3 orchestrator.** Read-only, as before. Under Q66 item 8 the privacy sweep is designed first and you review the design before anything is built. Please review `docs/m3/privacy-design.md` (commit `56874a1`, written against `306153c`). Nothing in `src/` or `tests/` has changed since `29cdb23`. Please write your review as `rgaa-m3-privacy-design-review-2026-11-26.md` in your outputs folder (`~/Documents/Codex/2026-11-11/che/outputs/`), ending with GO, GO WITH CHANGES or HOLD.

## Background

M2 had one family of leak: editable-box text reaching `run.json`. You found it one route at a time (Q56, Q60 to Q63). The design tries to end that pattern. It has an inventory of every route into the run folder and the console, a decision on where the guard lives, and a harness that plants a distinct marker in every context and channel and then searches every byte of the run folder.

## What I'd like you to judge

1. **Inventory (section 1).** Is any route missing? Are the rows right against the code? The builder found these gaps by reading alone, and no run has confirmed any of them:
   - Family B (10.1.1, 10.1.2) has no editable guard (E11).
   - The 8.2.1 duplicate-id evidence is unguarded (E9).
   - Locators and notes are never guarded for editable context (E2 to E4, E13).
   - The axe fingerprint hashes the raw `node.html`, `value` attributes included (E5).
   - The 8.3.1 witness misses `<html role="textbox">` (E7).
   - The raw `JSON.parse` message reaches stderr for an invalid sample (C1).
   - The CLI's internal-error path prints `e.stack` raw (C4).
2. **Guard placement (section 3).** The design recommends a hybrid that ends as one guard in the engine. A new `src/engine/editable-context.ts` resolves each `dom_node` item through a reference the check returns (a handle, a CDP node id or an axe target). An item with no reference, or that cannot be resolved, is masked, and so are its snippet, locator and note. The in-page snippet guards are removed, the 8.3.1 witness rule stays in the check on the shared predicate, and the sanitiser's markup rule stays as a second layer. Is the fail-closed reasoning sound? Is the risk of resolving to the wrong node acceptable? Does dropping the check's note in editable context lose anything that matters?
3. **Form fields (section 2.1, definition question).** The builder proposes this. Inside `select`, mask every option's content and drop `selected`. Drop `checked` on `input`. Keep `placeholder`. Is this the right reading of spec 8.7's "values of form fields are dropped"?
4. **Harness (section 4).** Does it test what it claims to test? Look at the carrier rule (a marker counts only if its element's evidence item is present), the controls, the encodings searched, and the session and screenshot extensions (4.5, 4.6).
5. **Limits (section 5).** Should any limit be closed now instead? E16 in particular: messages from page-patched DOM methods are only pattern-masked.
6. **Generated names (gate-report item 15, section 3.4).** Measure before changing anything, as the design proposes, or do you see a rule now?
7. **Hard stop 4.** Kickoff hard stop 4 says a second hold on the same family is a hard stop. Is anything in this design likely to produce one?

## Orchestrator's notes

- I checked the design for scope. It needs no change to a frozen schema beyond Q66 item 7. `src/checks/types.ts` gains an optional reference field that is stripped before validation. I make and log that change under the kickoff. No check record changes. Check versions change wherever a guard moves.
- The option, `selected` and `checked` question (point 3) changes evidence content. I will put it to Fabien together with your answer.
- No harness or guard code is written until your review is read.

Nothing is enabled and no rate is computed. No real site was loaded and no saved session was read.
