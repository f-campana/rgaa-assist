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
| 2026-11-17 14:15 | Batch 1 merged: builder A (Opus high, about 232k tokens, 10 entries), builder B (Opus high, about 257k tokens plus a run cut by the 5-hour limit, 11 entries); 85% stop lifted (Q44) | 86% | n/a | About 6 points for 21 entries: 0.29 point per entry. 5-hour window at 12% after its reset. |
| 2026-11-17 14:40 | Batch 2 merged: builders C (Opus high, about 237k tokens, 12 entries) and D (Opus high, about 210k tokens, 9 entries); batch 3 launched | 91% | n/a | About 5 points for 21 entries: 0.24 point per entry. |
| 2026-11-17 14:50 | Batch 3 merged: builders E (Opus high, about 186k tokens) and F (about 196k tokens), 30 entries all `none`; batch 4 launched | 94% | n/a | About 3 points for 30 entries: 0.1 point per entry when no claim is made. 5-hour window at 67%. |
| 2026-11-17 15:00 | Batch 4 merged: builders G (Opus high, about 231k tokens, 22 entries) and H (about 226k tokens, 21 entries); paused | 97% | n/a | About 3 points for 43 entries. 5-hour window at 94%. 129 of 258 entries written. |
| 2026-11-17 15:20 | Fabien used a limit reset; batches 5 and 6 launched (four Opus builders) | 1% | n/a | 5-hour window at 7%. The weekly window still ends 2026-11-21 16:00 UTC. |
| 2026-11-17 16:30 | Builders I, J, K merged (Opus high, about 228k, 218k, 214k tokens; 63 entries); batch 7 launched | 9% | n/a | 5-hour window at 66%. About 8 points of the weekly limit for 63 entries so far, L still running. |
| 2026-11-17 16:45 | Builder L merged (Opus high, about 245k tokens, 14 entries); M and N stopped before any commit; paused for Fabien's other work | 11% | n/a | 206 of 258 entries written. 5-hour window at 82%. |
| 2026-11-17 21:35 | Resumed at Fabien's request; builders M, N and O (Opus high, 54 tests) launched in parallel | 14% | n/a | Weekly rose 11% to 14% during the pause from Fabien's other work. 5-hour window at 2%. |
| 2026-11-17 21:45 | Builder O merged (Opus high, about 205k tokens, 19 entries, all `none`) | 18% | n/a | 223 of 258 entries written. Three builders ran together: weekly 14% to 18%, 5-hour window 2% to 30%. |
| 2026-11-17 21:50 | Builder N merged (Opus high, about 259k tokens, 19 entries: 11.8.2 `full`, 11.8.3 and 11.9.1 `fail_only`) | 19% | n/a | 242 of 258 entries written. 5-hour window at 43%. |
| 2026-11-17 22:00 | Builder M merged after one correction (Opus high, about 258k tokens, 16 entries: 10.11.1, 10.12.1, 10.13.2 `fail_only`) | 21% | n/a | All 258 entries written. Batches 7 and 8 together: weekly 14% to 21%, about 0.13 point per entry. 5-hour window at 53%. |
| 2026-11-17 22:25 | Codex's cross-check of all 258 entries (Codex's own plan, not counted here); orchestrator verification, Fabien's rulings Q45 to Q48, corrections builders P and Q launched (Opus high) | 21% | n/a | 5-hour window at 58%. |
| 2026-11-17 22:35 | Corrections builders P (about 238k tokens, 18 entries) and Q (about 197k tokens, 15 entries, one follow-up) merged | 26% | n/a | Claims now: fail_only 16, full 4. Weekly 21% to 26% for the corrections. 5-hour window at 91%. |
| 2026-11-17 23:00 | Codex's focused re-check read; last corrections briefed, launch held for the 5-hour window | 26% | n/a | 5-hour window at 96%, resets 02:30 UTC. |
| 2026-11-18 02:50 | Builder R merged (Opus high, about 159k tokens, last corrections: 10.5.2, 10.1.2, wording) | 28% | n/a | 5-hour window at 14% after its reset. |
| 2026-11-18 09:30 | Confirmation request sent; gate package drafted with the minimum useful set | 30% | n/a | 5-hour window at 10%. M1 so far: about 78 points of the weekly limit (52 before Fabien's reset, 26 after), an upper bound. |
| 2026-11-18 11:30 | Codex's confirmation read; builder S merged (Opus high, about 117k tokens, 10.1.1 case and noscript) | 32% | n/a | 5-hour window at 28%. |
| 2026-11-18 13:00 | Codex's 10.1.1 re-check read (clean); gate package finished | 33% | n/a | 5-hour window at 37%. M1 in all: about 81 points of the weekly limit (52 before Fabien's reset, 29 after), an upper bound. |
| 2026-11-18 13:25 | Dry run on a published audit (Q49), two proposals, Fabien's M1 approval (Q50) | 37% | n/a | 5-hour window at 62%. M1 closed at about 85 points of the weekly limit (52 before Fabien's reset, 33 after), an upper bound that includes the dry run and the proposals. |

**M2 ceiling (Q51):** 40 points of the weekly all-models limit, check-in at 20, counted from a baseline recorded when M2 starts.

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

## M2

### Baseline, 2026-11-18 14:56 UTC

Read by the M2 orchestrator (fresh Opus 5.5 session, high effort) before any M2 work, after Fabien said "Push and start M2".

| Limit | Used | Resets |
|---|---|---|
| 5-hour | 21% | 2026-11-18 19:20 UTC |
| Weekly, all models | 40% | 2026-11-21 16:00 UTC |

Q51 counts from this baseline: **check-in at 60% all-models, stop at 80%.** The usage card shows no per-model weekly line.

### Usage by step

| When (UTC) | After | All models | Notes |
|---|---|---|---|
| 2026-11-18 14:56 | Baseline | 40% | 5-hour window at 21%. |
| 2026-11-18 15:15 | Axe adapter merged (`83df023`; Sonnet medium, about 155k tokens; 67 rules, 67 records `exists: true`); engine and working set still running; ISO 639 sources vendored (Q54) | 47% | 5-hour window at 76%, resets 19:20 UTC: the two Opus builders may be cut off before then. |
| 2026-11-18 15:20 | Engine merged (`1e7bf67`; Opus high, about 273k tokens; 509 tests); axe checked through the engine path; phase 2 held for the 5-hour window | 49% | 5-hour window at 89%, resets 19:20 UTC. Launching four builders now would be cut off; held until the reset. |
| 2026-11-18 15:25 | Working set merged (Opus medium, about 315k tokens, 92 cases); 521 tests | 50% | Phase 2 still held for the 5-hour window. |
| 2026-11-18 19:25 | 5-hour window reset; phase 2 launched: checks A, B, C (Opus high), CLI and harness (Sonnet medium) | 51% | 5-hour window at 0%. Weekly rose 49% to 51% during the pause, from the working-set builder and other work. |
| 2026-11-18 19:35 | CLI and harness merged (Sonnet medium, about 210k tokens; 549 tests); `coverage` command checked; checks A, B, C running | 57% | 5-hour window at 47% ten minutes after its reset: three Opus high builders together use about 4 points of the 5-hour window a minute. |
| 2026-11-18 19:50 | Family B merged (Opus high, about 264k tokens) | ~60% | |
| 2026-11-18 20:00 | Family C merged (Opus high, about 319k tokens); 685 tests; **check-in reached** | 62% | 5-hour window at 87%, resets 2026-11-19 00:20 UTC. Family A still running. |

### Check-in at 20 points (2026-11-18 20:00 UTC)

22 points used (40% to 62%). Builders paused: no new launch until Fabien answers; family A, already running, finishes its task.

| Role | Model, effort | Tokens (builder's own count) | Share of the 22 points |
|---|---|---|---|
| Orchestrator | Opus 5.5, high | not measured; its context is about 355k tokens and every turn pays for it again | not separable; estimated 6 to 8 points |
| Core builders: engine, checks B, checks C | Opus 5.5, high | 273k, 264k, 319k | most of the rest, with family A still running |
| Core builder: working set | Opus 5.5, medium | 315k | |
| Module builders: axe adapter, CLI and harness | Sonnet 5.5, medium | 155k, 210k | small |
| Reviewer | Codex | Codex's own plan | not counted |

Three Opus high builders running together filled about 85% of a 5-hour window in 35 minutes.
| 2026-11-18 20:05 | Family A merged (Opus high, about 357k tokens); 828 tests; working-set numbers run by the orchestrator: matched 92 of 92 cases | 63% | 5-hour window at 94%, resets 2026-11-19 00:20 UTC. Paused at the check-in. |
| 2026-11-20 17:38 | Resumed on Fabien's word (Q55: stay under 90% weekly) | 80% | Weekly rose 63% to 80% during the two-day pause, from Fabien's other work, not M2. |
| 2026-11-20 17:45 | Both audits run (about 3 s and 4 s), run files validated, Aubay comparison written, Codex's review requested | 81% | About 1 point of orchestrator time. 5-hour window at 18%. |
| 2026-11-20 23:50 | Codex review read (hold, four findings); Q56 recorded; one corrections builder launched (Sonnet medium) | 85% | Weekly rose 81% to 85% since the runs, outside M2. 5-hour window at 24%. |
| 2026-11-21 00:10 | Q56 corrections merged (`3d80b49`; Sonnet medium, about 150k tokens; 840 tests); evaluate and both audits rerun; full-pass request sent | 87% | Under the 90% cap (Q55). The weekly window resets 2026-11-21 16:00 UTC. |
| 2026-11-21 15:00 | Q57 fixes merged (Opus high about 193k tokens; case writer Sonnet about 93k); 856 tests; working set 94 of 94; both audits rerun | 93% | Q58 lifted the 90% cap for these fixes. The weekly window resets 16:00 UTC today. |
| 2026-11-21 16:20 | Q59 fixes merged (Opus high about 204k tokens; case writer Sonnet about 90k); 899 tests; working set 95 of 95; both audits rerun | 1% (new week) | The weekly window reset at 16:00 UTC during this step; the old window closed at about 95%. 5-hour window at 52%. No budget set for the new week (Q58). |
| 2026-11-21 18:55 | Codex final pass read (hold, five items); Q60 recorded (budget: weekly under 8%); briefs written; runs.md counts fixed; code builder and case writer launched (both Sonnet medium, for the budget) | 3% | 5-hour window at 66%, resets 19:10 UTC. Stop line 8% weekly. |
| 2026-11-21 19:10 | Q60 merged (code Sonnet medium about 164k tokens; cases Sonnet medium about 103k); 914 tests; working set 97 of 97; both audits rerun, unchanged; Codex recheck requested | 5% | Under the 8% stop line (Q60). 5-hour window at 80%, resetting. |
| 2026-11-22 15:10 | Q61 recorded and merged (Sonnet medium, about 147k tokens); 922 tests; working set 97 of 97; both audits rerun, unchanged; Codex recheck requested | 9% | Cap 12% (Q61). Weekly was 7% at the start, after the M1 session's relays and other work (Codex does not use this plan). 5-hour window at 21%. |
| 2026-11-22 15:50 | Q62 recorded and merged (Sonnet medium, about 124k tokens); 928 tests; working set 97 of 97; both audits rerun (Aubay 2 more redactions, outcomes unchanged); Codex recheck requested | 10% | Cap 12% (Q61, Q62). 5-hour window at 31%. |
| 2026-11-22 17:50 | Q63 recorded and merged (Sonnet medium, about 126k tokens); 939 tests; working set 97 of 97; both audits rerun, as recorded; Codex recheck requested | 14% | Cap 15% (Q63) covers the gate report too: not enough left for it, so stopped here. 5-hour window at 60%. |
| 2026-11-25 17:20 | Gate report started (Q64) | 34% | Cap 38%. The rise from 14% on 2026-11-22 came while M2 was idle: not booked to M2. 5-hour window at 24%. |
| 2026-11-25 17:30 | Gate report written, no builder launched; tests, type check, coverage and working set rerun on `b69b717` (939 tests, matched 97 of 97) | 35% | About 1 point at this reading. 5-hour window at 33%. |
| 2026-11-25 17:37 | M2 accepted (Q65); report corrected, documentation only | 37% | 36% when the step was sent, after the M1 session reran the checks on `ee99ba0`. Cap 38%. |

### At the gate (2026-11-25)

| Role | Model, effort | Tokens (builders' own counts) | Share of plan used |
|---|---|---|---|
| Orchestrator | Opus 5.5, high | not measured | not separable |
| Core builders, first build: engine, checks A, B, C, working set | Opus 5.5, high (working set medium) | 273k, 357k, 264k, 319k, 315k | in the 23 points of the first build |
| Module builders, first build: axe adapter, CLI and harness | Sonnet 5.5, medium | 155k, 210k | in the same 23 points |
| Correction builders: Q57, Q59 | Opus 5.5, high | 193k, 204k | Q57 about 6 (includes idle time), Q59 3 |
| Correction builders: Q56, Q60, Q61, Q62, Q63 | Sonnet 5.5, medium | 150k, 164k, 147k, 124k, 126k | 2, 2, 2, 1, 2 |
| Case writers: Q57, Q59, Q60 | Sonnet 5.5, medium | 93k, 90k, 103k | in the same steps |
| Reviewer | Codex | Codex's own plan | not counted |

M2's total, an estimate: about 44 points before the gate report and about 1 for it. Not a maximum: some of those points include idle time or other work, and intervals left out include M1-session work for M2. M2 may have exceeded Q51's 40. Against Q51's 40 and the later limits: `docs/m2/gate-report.md`, section 5. API-equivalent cost: not recorded.

## M3

### Baseline, 2026-11-26 10:46 UTC

Read by the M1 orchestration session just before starting the M3 orchestrator, and again by the M3 orchestrator (fresh Opus 5.5 session) before any M3 work; both readings agree.

| Limit | Used | Resets |
|---|---|---|
| 5-hour | 18% | 2026-11-26 13:10 UTC |
| Weekly, all models | 42% | 2026-11-28 16:00 UTC |

Q67 counts from this baseline: **pause at 52% all-models**, and start nothing new above about 50%. Q66's 45 points (check-in at 22) are the milestone's estimate, not permission. The usage card shows no per-model weekly line.

### Usage by step

| When (UTC) | After | All models | Notes |
|---|---|---|---|
| 2026-11-26 10:46 | Baseline | 42% | 5-hour window at 18%. |
| 2026-11-26 10:56 | Privacy-sweep design merged (`56874a1`; Opus 5.5 medium, about 195k tokens); Codex review request written | 44% | 2 points of Q67's 10. No other work ran in between. 5-hour window at 32%, resets 13:10 UTC. |
| 2026-11-26 11:14 | Q68 recorded; design revised after Codex's hold (`a17b64f`; same builder resumed, Opus 5.5 medium, about 80k more tokens, about 240k in all); second Codex request written | 47% | 5 points of Q67's 10. The M1 session's relay of Codex's review ran in between. 5-hour window at 54%, resets 13:10 UTC. |
