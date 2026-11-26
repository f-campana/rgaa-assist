# M3 status

**2026-11-26, from the M3 orchestrator.** M3 started on Fabien's word (Q67) with 10 points of the weekly all-models limit from a 42% baseline. It pauses at 52%, or earlier if less than about 2 points remain.

## Done

- Q67 recorded; kickoff budget lines amended; baseline in `docs/cost-log.md` (`e37f420`).
- Kickoff step 2: `docs/m3/privacy-design.md` (`56874a1`), written by a core builder from `docs/m3/brief-privacy-design.md` and reviewed by the orchestrator.
- Review request for Codex: `docs/m3/request-codex-privacy-design.md`. Codex put a HOLD on the design before build (six findings).
- Q68 recorded (Fabien, "Yes, revise it"): form-field values defined; the design was revised along all six findings (`a17b64f`).
- Second review request: `docs/m3/request-codex-privacy-design-2.md`. Codex put a second HOLD on the design before build (three points, plus answers to four open points).
- Q69 recorded (Fabien, "Yes, revise again"); the design was revised a second time (`66a00f1`): providers give sources and typed derivations, and the engine reads every page-derived piece itself.
- Third review request: `docs/m3/request-codex-privacy-design-3.md`. Codex put a third HOLD on the design (short values, composites, Q70 not reflected).
- Q70 (Fabien, "Drop for v1"): no screenshots in v1, recorded by the M1 session.
- Q71 (Fabien, "Yes, 3 more"): stop line 53%. Design revised a fourth time by the orchestrator (`2e05b15`).
- Fourth review request: `docs/m3/request-codex-privacy-design-4.md`.

## Waiting

- **Codex's fourth review of the design.** Fabien prompts Codex. No code is written before it is read.

## Found by reading

Routes of the M2 leak family, in design section 1. Two of them were confirmed in the code by the M1 session: the 8.2.1 fingerprint, and the `scope_examined` locator lists. The harness baseline on `4d4b224` will show the rest.

## Next

After Codex's fourth review: answer it, then kickoff step 3 (design section 8, large). **M3 is paused** at 51% weekly, 9 of the 13 points allowed (Q67 + Q71). Step 3 waits for the reset (2026-11-28 16:00 UTC) or for Fabien's word.
