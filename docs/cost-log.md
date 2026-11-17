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
| 2026-11-16 21:17 | Implementation and contract tests merged; 180 of 185 contract tests pass, 5 have wrong fixtures and are being fixed | 63% | 22% | 5-hour window at 54%. Builders: about 173k and 233k tokens. |
| 2026-11-16 22:35 | Pilot of 14 entries merged (Opus, high effort, about 288k tokens) | 67% | 24% | 5-hour window at 81%. |
| 2026-11-16 23:15 | Codex's cross-check read and verified; decisions Q40 to Q42; guide corrected; handover written | 68% | 26% | 5-hour window at about 90%. |
| 2026-11-17 02:02 | Fresh Opus orchestrator session started (Q42); corrections builder launched (Opus, high) | 69% | 29% | 5-hour window at 2%, just reset. |
| 2026-11-17 02:14 | Corrections merged (`0352c75`; Opus, high, about 203k tokens); contract-test builder for `always` launched (Sonnet) | 71% | 29% | 5-hour window at 14%. |
| 2026-11-17 02:16 | Contract tests for `always` merged (`2b12c9a`; Sonnet, medium, about 105k tokens); Codex re-check requested | 72% | 29% | 5-hour window at 18%. |
| 2026-11-17 11:35 | Codex's re-check read and verified; guide corrected; second corrections builder launched (Opus, high) | 74% | n/a | 5-hour window at 18%. The usage card no longer shows a Fable line. |
| 2026-11-17 11:45 | Q43 applied (Opus medium about 100k, Sonnet medium about 92k tokens); 8.3.1 and 11.1.1 corrected (Opus high, about 152k tokens); focused re-check requested | 77% | n/a | 5-hour window at 38%. |
| 2026-11-17 13:40 | 8.3.1 witness fix merged (Sonnet medium, about 84k tokens); Codex's confirmation clean; entries builder A launched (Opus high, 10 tests) | 80% | n/a | 5-hour window at 62%. The corrections cycle cost about 11 points of the weekly limit in all. |

### What day 1 says about cost

- One full 5-hour window is worth about 13 points of the weekly all-models limit.
- M1's allowance of 40 points is therefore about three full windows. Day 1 used 9 points.
- The orchestrator on Fable is expensive: each of its review turns costs several points of a 5-hour window. Keep its turns few.
- **The orchestrator is the largest single cost.** By 21:17 UTC M1 had used 18 points of the all-models limit, and the Fable limit had moved 20 points. This thread carries a context of over 300k tokens, and every turn pays for it again. A fresh orchestrator session that starts from `docs/m1-status.md` would cost far less per turn.
- **The check-in at 65% arrives with no entry written.** The foundations (schemas, contract, implementation, contract tests, tooling, guide) took 18 of the 40 points.

### Projection from the pilot

- The pilot took about 3.5 points of the weekly all-models limit for 14 entries: about 0.25 point per entry.
- The 244 remaining entries would take about 61 points at that rate. That is an estimate from one batch of 14, not a measurement of the whole.
- 18 points remain before the 85% stop: about 70 entries this week.
- So M1 needs roughly one and a half more weekly allowances of 40 points, unless the cost per entry falls (lower effort, or a cheaper pass for tests that are plainly judgment).
