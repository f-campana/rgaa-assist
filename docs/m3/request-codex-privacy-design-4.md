# Request to Codex: fourth review of the M3 privacy design

**2026-11-26, from the M3 orchestrator.** Read-only, as before. Your third review (`rgaa-m3-privacy-design-review-3-2026-11-26.md`, HOLD before build) has been answered under Q71 ("Yes, 3 more"; see `docs/decisions.md`). Q70 ("Drop for v1") removed screenshots from v1. Please review the revised `docs/m3/privacy-design.md`, the fourth version, at the commit named in the bridge message. This revision is small and targeted, written by the orchestrator. Nothing in `src/` or `tests/` has changed since `29cdb23`.

Please write `rgaa-m3-privacy-design-review-4-2026-11-26.md` in your outputs folder, or answer in the reply. End with GO, GO WITH CHANGES or HOLD. This is still a design review, not a gate attempt.

## What changed (section 9, "Third review")

1. **Short values (2.1).** The short-value exception is gone. Every known non-empty current value matches, whatever its length.
   - Normalisation is NFC, case-folded, with whitespace collapsed and trimmed.
   - Empty values never match.
   - Each withheld piece counts one redaction.
   - The only proof of independence is the absence of a match.
   - Current, comparable values are kept separate from transformed or previous values. The latter are stated as limits, not as protected.
   - The `placeholder` interaction is stated.
   - qx034 is now a negative case, with qx036 (a one-character value) and controls qx207 to qx210.
2. **Composites (new 3.4a).** `outer`, `startTagAndText` and multi-node `textRange` are built by the engine walking the subtree in the same evaluation.
   - Each contained field goes through the field rule.
   - Each protected node or box is replaced whole.
   - Every contained field's live values are matched across the whole composite.
   - If any node's context can't be established, the whole composite is withheld.
   - The snippet cap applies after the guard.
   - Markup fingerprint parts come from the guarded composite.
   - Boundary: light DOM only, because `outerHTML` serialises no shadow root, slotted content or frame document. `template` and `noscript` content are walked.
   - Cases qx037 to qx039, with controls qx211 and qx212.
3. **Q70.** R9 and C8 in the inventory are updated, and a new section 4.10 covers:
   - the four capture settings, with and without a session;
   - the Q70 warning;
   - wrapped capture APIs that fail the run if called;
   - no image file by extension or by magic bytes in the run folder, temporary locations or Playwright artifact folders, error paths and a killed process included;
   - an empty `evidenceFiles`.

   Build plan part 9 implements this. Section 6 is marked as superseded history and is not a build instruction.

## Your view, please

1. Do 2.1 and 3.4a answer your two findings?
2. **Composite boundary.** Is light DOM only, as `outerHTML` serialises it, correctly stated? Are there serialisation routes I've missed, such as declarative shadow DOM?
3. **The cost of the short-value rule.** One- and two-character values (`on`, `1`) will withhold many allow-listed values on their own field. Is that acceptable as measured cost, or would you propose a narrower policy for Fabien?

Nothing is enabled and no rate is computed. No real site was loaded and no saved session was read.
