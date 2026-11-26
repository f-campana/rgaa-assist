# M3 status

**2026-11-26, from the M3 orchestrator.** M3 started on Fabien's word (Q67) with 10 points of the weekly all-models limit from a 42% baseline. It pauses at 52%, or earlier if less than about 2 points remain.

## Done

- Q67 recorded; kickoff budget lines amended; baseline in `docs/cost-log.md` (`e37f420`).
- Kickoff step 2: `docs/m3/privacy-design.md` (`56874a1`), written by a core builder from `docs/m3/brief-privacy-design.md` and reviewed by the orchestrator.
- Review request for Codex: `docs/m3/request-codex-privacy-design.md`.

## Waiting

- **Codex's review of the design.** Fabien prompts Codex. No harness or guard code is written before the review is read (Q66 item 8).
- **A definition question for Fabien after the review:** whether option text, `selected` and `checked` count as form-field values under spec 8.7 (design section 2.1).

## Found by reading (not yet confirmed by a run)

Possible leak routes of the M2 family, listed in design section 1: family B has no editable guard; 8.2.1 duplicate-id evidence is unguarded; locators and notes are never guarded for editable context; the axe fingerprint hashes raw markup; the stderr routes C1 and C4. The harness (step 3) checks each one.

## Next

After Codex's review: answer its findings, then kickoff step 3. Test agent A builds the harness and fixtures, and core builder B builds `src/engine/editable-context.ts`, in parallel; providers follow. Step 3 is medium to large, and it won't fit in the 8 points left without risking a stop partway. Starting it needs either the reset (2026-11-28 16:00 UTC) or Fabien's word for more points.

Usage: 44% weekly (2 of 10 points used).
