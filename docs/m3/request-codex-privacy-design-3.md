# Request to Codex: third review of the M3 privacy design

**2026-11-26, from the M3 orchestrator.** Read-only, as before. Your second review (`rgaa-m3-privacy-design-review-2-2026-11-26.md`, HOLD before build) has been answered. Fabien approved the revision as Q69 ("Yes, revise again"; see `docs/decisions.md`). Please review the revised `docs/m3/privacy-design.md` (commit `66a00f1`). Nothing in `src/` or `tests/` has changed since `29cdb23`.

Please write `rgaa-m3-privacy-design-review-3-2026-11-26.md` in your outputs folder, or answer in the reply. End with GO, GO WITH CHANGES or HOLD. This is still a design review, not a gate attempt.

## Main change

Providers no longer hand page text to the engine.
- **What a provider returns.** Each provider returns sources (a node reference or a frame key) and typed derivations: outer markup, start tag, a text range, an attribute, a locator, an accessible name or value, a frame URL.
- **Who reads the page.** The engine reads each piece itself, in the same in-page evaluation that reads that source's context.
- **Check-owned text.** Note templates and fingerprint labels are declared on the check definition before any page loads.
- **Raw strings.** A raw string where a derivation is expected is withheld and counted.

Sections 3.2 and 3.3 cover this. They also state the trust boundary: the engine guarantees provenance and context, but not that a provider chose the node it meant to report (a correctness risk), nor that its numbers and enumeration choices encode no page data (left to review).

## Where your points are answered (section 9)

1. **Reflected field values (2.1).** On a field's start tag, only allow-listed attributes keep their values. Any piece containing the field's live value is withheld. Rows qx031 to qx034 test this, with controls qx207 to qx209.
2. **Reference association (3.2 to 3.4, 4.4).** A failed source withholds every piece derived from it. A failed snippet or locator source withholds the whole item. There is no wrong-reference exception. Independently written adversarial provider tests cover protected A against plain B with identical markup, wrong references in lists and fingerprints, and raw strings, with an independent oracle.
3. **Screenshots (6).**
   - Capture and mask happen in memory before any write, or there is no screenshot. Temporary files hold masked data only, and the crash paths are tested.
   - Stability: capture is the last action on a target, and the page is frozen first (animation playback rate 0, script disabled, on every frame session). Scroll, regions and DOM events are checked before and after.
   - Fixtures move a protected box out of its mask and back with no DOM change.
   - **Estimate (6.6): 8 to 12 points** for step 6, against about 1 point for no screenshots in v1. That choice, Q66 item 4, is Fabien's.
4. **Your four answers.**
   - axe identity is conditional and never called proven, with the covered selectors, events and timing listed. Each CDP assumption gets a validation test, and evidence is withheld if one fails.
   - There is no wrong-reference limit.
   - Fingerprint counts are added once to `evidence[0]`, with a fixed note, and empty evidence is handled.
   - There are no stack frames, only a fixed class, message and code, with no debug bypass (qx064).
5. **Further conditions.** The static test is described as supplemental. The baseline on `4d4b224` has its own runner and three verdicts, and never records a pass.

## Your view, please

1. **The derivation model as the privacy boundary.** Does it close the association gap? Is the stated trust boundary acceptable?
2. **Browser behaviour the design assumes but has not tested.**
   - DOM events fire for every node after a pierced `getDocument`, closed shadow roots included.
   - Animation playback rate 0 stops compositor transforms.
   - Disabling script stops `requestAnimationFrame` callbacks and timers that are already scheduled.
   - All of this holds on out-of-process frame sessions.

   The design makes each one a test, with evidence withheld if it fails. Is that enough, or is any of these assumptions wrong outright?
3. **Freezing the page for the screenshot.** The freeze changes the page, so the design runs it after every check. Do you see a problem with that?
4. **Evidence changes the build will report.** axe notes lose the page-derived parts of axe's messages. Locators move to one engine syntax. Benign `data-*` and ARIA values on fields are withheld. Are these acceptable?

Nothing is enabled and no rate is computed. No real site was loaded and no saved session was read.
