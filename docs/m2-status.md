# M2 status

Kept current by the orchestrator. If you are taking over, read `docs/decisions.md` (Q50 to Q53 are the latest), then `docs/m2-kickoff.md`, then this file, then the M2 part of `docs/cost-log.md`.

**Orchestrator:** a fresh Opus 5.5 session at high effort (Q52), started 2026-11-18 from the M1 orchestrator's session after Fabien said "Push and start M2". Q39 carries over: the orchestrator does what the spec gives Fable.
**Ceiling (Q51):** 40 points of the weekly all-models limit from the baseline of 40% (2026-11-18 14:56 UTC). **Check-in at 60%, stop at 80%.** The weekly window resets 2026-11-21 16:00 UTC.

## Steps

| # | Step (brief, "Order of work") | State |
|---|---|---|
| 1 | Baseline in the cost log | Done 2026-11-18 14:56 UTC: weekly all-models 40%, 5-hour 21%. |
| 2 | Pin and install Playwright, Chromium, `@axe-core/playwright` | Done 2026-11-18. `playwright` 1.64.1 (2026-10-14), its Chromium 156.0.8078.4 (build 1248) and headless shell; `@axe-core/playwright` 4.14.0 (2026-10-15), resolving the one `axe-core` 4.14.0. Smoke run: Chromium launches, axe 4.14.0 analyses a page. |
| 2b | Check interface | Written by the orchestrator: `src/checks/types.ts` (types only). See "Decisions taken by the orchestrator". |
| 3 | Engine skeleton, run-file writer | Not started. |
| 4 | Minimal sanitiser | Not started (with step 3). |
| 5 | Axe adapter | Not started. |
| 6 | Ten custom checks | Not started. |
| 7 | Working set | Not started. |
| 8 | Wiring and CLI (`audit`, `coverage`) | Not started. |
| 9 | Two runs, Aubay comparison | Not started. |
| 10 | Check-in at 20 points (60%) | Not reached. |
| 11 | Codex's review, corrections, gate | Not started. |

## Builders

| Builder | Model, effort | Owns | Branch | State |
|---|---|---|---|---|

## In flight

Nothing yet.

## Decisions taken by the orchestrator

Also logged on the bridge, channel `rgaa-assist`.

- **Versions.** Playwright 1.64.1 is the newest release at least two weeks old on 2026-11-18 (1.65.0 is from 2026-11-05). `@axe-core/playwright` 4.14.0 matches axe-core 4.14.0. Both pinned exactly in `package.json`.
- **The check interface is written by the orchestrator** (`src/checks/types.ts`), as a types-only file, so that the engine, the axe adapter and three custom-check builders can work against one shape at the same time. It is not feature code. Changing it goes through the orchestrator.
  - A check returns raw evidence; the engine numbers it, sanitises it, records options and validates the observation. Checks never sanitise and never write.
  - A provider runs once per target and returns one result per declared check. The axe adapter is one provider.
  - The engine gives each provider the page, the list of frames with whether each could be read, and a CDP session per frame target (for the accessibility tree).
- **`@axe-core/playwright` needs a page from `browser.newContext()`**: it opens a blank page in the same context to finish a run. The engine creates a fresh context per target anyway (7.4).

## Findings to report at the gate

None yet.

## Open points for Fabien

None.
