# Request to Codex: second review of the M3 privacy design

**2026-11-26, from the M3 orchestrator.** Read-only, as before. Your review of the first design (`rgaa-m3-privacy-design-review-2026-11-26.md`, HOLD before build) has been answered. Fabien approved the revision as Q68 ("Yes, revise it"; see `docs/decisions.md`). Please review the revised `docs/m3/privacy-design.md` (commit `a17b64f`). Nothing in `src/` or `tests/` has changed since `29cdb23`.

Please write `rgaa-m3-privacy-design-review-2-2026-11-26.md` in your outputs folder, ending with GO, GO WITH CHANGES or HOLD. If your session can't write files, answer in the reply, and the M1 session will copy it verbatim into the repo as before. This is still a design review, not a gate attempt.

## Where your findings are answered

Section 9 of the design maps each finding to a section. In short:

1. **Fingerprints and non-node evidence.** Protection now follows provenance, not evidence kind (3.1, 3.2, 3.4). Locator lists are carried member by member (`locatorList`), page text in notes goes into `noteSlots`, and fingerprints are built from `fingerprintParts`, covering 8.2.1 F1, family C F2 and axe E5 (3.6). Differential fingerprint tests are in 4.4. A static test (4.6) catches checks that inline page text.
2. **Identity and replacement.**
   - Section 3.3 identifies a frame by `FrameKey` (Playwright frame, CDP `frameId` and `loaderId`). The engine keeps its own CDP DOM event log to prove a document is stable.
   - Context is checked twice: when the check reads the node and when the engine guards it.
   - Every failure is withheld, with no selector fallback, and handles live until the guard finishes.
   - Section 3.5: the replacement is always exactly `[redacted]`, and the engine counts its withholding explicitly, field by field.
3. **Harness reach.**
   - Reach is proven by a test-only in-memory probe, never written to disk (4.2).
   - Assertions run per check and field, both positive and negative.
   - Every marker has a unique prefix, and there are separate markers that need HTML, percent and JSON escaping.
   - New rows cover failed references.
   - A baseline runs on `4d4b224` (4.5).
4. **Errors.** Errors are classified by origin, with fixed messages at every output boundary, temporary output included (5). The known weak point is gone.
5. **Screenshots.** Section 6 covers:
   - viewport screenshots only, with an exact size check against viewport times device scale;
   - transformed regions masked by their bounding box, regions rounded outwards;
   - a frame-wide fallback, and the difference between absent and unknown;
   - an enumerate, capture, enumerate check with one retry, then suppression;
   - decoded-pixel tests.
6. **Form values and generated names.** The Q68 item 1 definition is in 0 and 2.1. Generated names are measured first, with names that really trip the detector, and get no exemption (3.7).

## Points the builder could not settle: your view, please

1. **axe identity (3.3).** axe returns selectors only. The design accepts an axe target only when two things hold: the node's document recorded no DOM or frame event during the run, and the target matches exactly one element, with frames walked by `frameElement()` identity. Does this count as identity, or is it the selector fallback you ruled out? The alternative is running axe in the page with element references kept, which is a much larger change. As designed, pages that keep changing (carousels, counters) lose their axe snippets.
2. **Wrong reference (3.3, 7).** The engine checks that the snippet is a substring of the referenced node's current markup. A wrong reference with a matching snippet but another node's locator stays an open limit. Is that acceptable?
3. **Fingerprint counts (3.5).** A withheld fingerprint part is counted on the observation's first evidence item, because observations have no count field and adding one would change a frozen schema. Is that acceptable?
4. **CLI stack output (5).** `main.ts` would print the error class, the engine-built message and the `at` stack frames, without the raw first line. Is that safe enough, or should the stack go too?

The PNG codec (6.4) is Fabien's decision, since no dependency is authorised. It matters only at step 6.

Nothing is enabled and no rate is computed. No real site was loaded and no saved session was read.
