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
- Fourth review request: `docs/m3/request-codex-privacy-design-4.md`. Codex's fourth review is **GO WITH CHANGES**, with five conditions (`rgaa-m3-privacy-design-review-4-2026-11-26.md`).
- Q72 (Fabien, "Yes, that plan"):
  1. Fold the five conditions into the design and the build handoff.
  2. Build after the reset under Q66's 45-point ceiling, counted from 42%.
  3. Ask Fabien before resuming.
- Q73 (Fabien, "5 points allowed"): baseline 88%, stop line 93%. Codex's five conditions are folded into the design, with the build handoff in section 8.1 and new rows qx213 to qx219.
- Q74 (Fabien, "We can use 7 points right now before the reset"): the build started. Baseline 88%, stop line 95%.
- Build plan parts 1 and 2, baseline slice: the privacy harness in `tests/privacy/`, by test agent A (`91209fd`).
- Part 3: the baseline is recorded in `docs/m3/privacy-baseline.md`, with 17 leaks seen, 4 not reached, all controls ok, and no capture.
- Q75 (Fabien: up to 100% weekly, stop before 16:00 UTC).
- Harness second and third slices: 36 more rows; per-piece control expectations; fingerprint pairs for composites; the static check (4.6), 117 known hits.
- Part 4, engine guard, slices 1 to 3, in `src/engine/editable-context.ts` (**not wired into `run-checks.ts`**):
  - the in-page context and field rule, and the composite walk;
  - closed-root slots through CDP;
  - the in-memory probe seam with its hooks;
  - the `locator`, `accname`, `accvalue` and `frameUrl` derivations;
  - note templates and `locatorList`;
  - the axe identity condition with the CDP DOM event log;
  - `FrameKey` stability;
  - the CDP assumption tests (`d2a8a2a`).

  Details and the differences from the design are in `docs/m3/privacy-baseline.md`.

## Waiting

- Nothing.

## Found by reading

Routes of the M2 leak family, in design section 1. Two of them were confirmed in the code by the M1 session: the 8.2.1 fingerprint, and the `scope_examined` locator lists. The harness baseline on `4d4b224` will show the rest.

## Next

**Part 4, what is left:**
- wiring into `run-checks.ts`: the event-log window, references stripped before validation, and `privacyProbe` on `runAudit`;
- error classes (section 5);
- XHTML walking (withheld today);
- the gaps against the design that `docs/m3/privacy-baseline.md` lists.

**Then:**
- part 5: providers emit sources (builder C);
- the post-build privacy run (`pnpm test:privacy`) with the probe;
- the adversarial rows qx040 to qx049.

**M3 is paused before the 16:00 UTC reset (Q75).** Going on needs Fabien's word. Q66's check-in comes at 22 points; 17 are used so far.
