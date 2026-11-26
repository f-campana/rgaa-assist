# M3 status

**2026-11-26, from the M3 orchestrator.** M3 started on Fabien's word (Q67) with 10 points of the weekly all-models limit from a 42% baseline. It pauses at 52%, or earlier if less than about 2 points remain.

## Done

- Q67 recorded; kickoff budget lines amended; baseline in `docs/cost-log.md` (`e37f420`).
- Kickoff step 2: `docs/m3/privacy-design.md` (`56874a1`), written by a core builder from `docs/m3/brief-privacy-design.md` and reviewed by the orchestrator.
- Review request for Codex: `docs/m3/request-codex-privacy-design.md`. Codex put a HOLD on the design before build (six findings).
- Q68 recorded (Fabien, "Yes, revise it"): form-field values defined; the design was revised along all six findings (`a17b64f`).
- Second review request: `docs/m3/request-codex-privacy-design-2.md`.

## Waiting

- **Codex's second review of the design.** Fabien prompts Codex. No harness or guard code is written before it is read (Q66 item 8, Q68 item 3).
- **For Fabien, at step 6 only:** decoding and encoding PNG for screenshot masking needs either a small in-house codec or a dependency, and none is authorised.

## Found by reading

Routes of the M2 leak family, in design section 1: family B has no editable guard; the 8.2.1 evidence and fingerprint carry id values; locators, locator lists and notes are never guarded; the axe fingerprint hashes raw markup; raw messages reach stderr. Two of these were confirmed in the code by the M1 session (the 8.2.1 fingerprint, `scope_examined` locator lists). The harness baseline on `4d4b224` will show the rest.

## Next

After Codex's second review: answer it, then kickoff step 3 (design section 8). It is large, and it won't fit in what is left of Q67's 10 points. It waits for the reset (2026-11-28 16:00 UTC) or for Fabien's word.

Usage: 47% weekly (5 of 10 points used; stop line 52%).
