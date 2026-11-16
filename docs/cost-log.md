# Cost log

Plan: Claude Pro, extra usage off. Figures are shares of plan limits, read from the app's usage card. Spec 14.3 asks for one line per milestone and role.

## M1

### Baseline, 2026-11-16 16:08 UTC

Read before any M1 work. Fabien used a limit reset on this day; the weekly windows still end on 2026-11-21 16:00 UTC.

| Limit | Used | Resets |
|---|---|---|
| 5-hour | 14% | 2026-11-16 21:00 UTC |
| Weekly, all models | 45% | 2026-11-21 16:00 UTC |
| Weekly, Fable | 2% | 2026-11-21 16:00 UTC |

The all-models figure was not zero, so Fabien decided the ceilings are counted from this baseline (Q38): check-in at 65% all-models, stop at 85%, Fable stop at 50%.

### Usage by step

| When (UTC) | After | All models | Fable | Notes |
|---|---|---|---|---|
| 2026-11-16 16:08 | Baseline | 45% | 2% | |
| 2026-11-16 16:17 | Start decisions, data vendored, scaffold merged, two builders launched | 48% | 7% | 5-hour window at 41%. The orchestrator's own setup is most of this. |
| 2026-11-16 16:42 | Schemas and contract merged, reviewed and frozen; axe table and packets merged | 54% | 11% | 5-hour window at 83%. The Opus schemas builder used about 300k tokens, the two Sonnet builders about 80k and 110k. |
| 2026-11-16 21:02 | 5-hour window reset; two Opus builders relaunched after being cut off at 17:00 | 56% | 13% | The cut-off launch cost about 2 points and produced nothing. |

### What day 1 says about cost

- One full 5-hour window is worth about 13 points of the weekly all-models limit.
- M1's allowance of 40 points is therefore about three full windows. Day 1 used 9 points.
- The orchestrator on Fable is expensive: each of its review turns costs several points of a 5-hour window. Keep its turns few.
