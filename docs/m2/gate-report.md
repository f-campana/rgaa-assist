# M2 gate report

**2026-11-25, main `b69b717`.** Written by the M2 orchestrator under Q64, for Fabien. This step changed no code, record or spec. Nothing is enabled: all 258 entries are `enabled: none`. Every number is a count on a named population; nothing here says anything about the conformance of a site.

**In short.** M2's criteria are met, with one exception and three limits.
- **Exception:** not every check matches its record to the letter. The known differences are listed below (open items 1 to 5). None has an effect while nothing is enabled.
- **Limit 1:** Codex's last full pass was at `1c58636`. Its later passes covered only each correction. Nobody independent has rerun the whole suite or corpus since.
- **Limit 2:** the working set is cases this project wrote. It shows that the checks do what their records and cases say, not that the records are right.
- **Limit 3:** the API-equivalent cost that spec 14.3 asks for was not recorded.
- **Recommendation:** accept M2 as it stands. Decide items 1 to 5 before any of those entries is enabled, not before M3. The decision, and the start of M3, are Fabien's.

Spec 14.1 marks M2 as needing no approval from Fabien. Fabien keeps approval here (Q64).

## 1. Criteria

Who ran what: **O** is the orchestrator, on `b69b717`, 2026-11-25, unless another commit is given. **C** is Codex, at the commit named. "Nobody since" means no independent rerun after that commit.

### Spec 14.1: every gate

| Criterion | Met? | O ran | Codex reran | Not independently rerun |
|---|---|---|---|---|
| Tests green | Yes | 939 of 939 tests, 51 files; type check; validate-coverage | 899 of 899 at `1c58636`. Targeted: 224 at `f9254fd` (Q60), 23 at `4322991` (Q61), 29 at `2c79177` (Q62), 17 at `b69b717` (Q63). Type check and 258 of 258 entries at each recheck | The 939 tests together: O only |
| Corpus bar where it applies | Does not apply: no entry enabled | The v1 bar gates enabled entries only | - | - |
| Codex's independent review | Yes, with limit 1 | - | Full pass at `1c58636` (hold); corrections then rechecked one by one, the last at `b69b717`: no further blocker in that recheck | A pass over the whole since `1c58636` |
| Diff review | Yes | O read every merge diff (Q39, Q52: O has Fable's role) | Read the changes of each correction | Core builders and O use the same model; only Codex's review is independent |

### Spec 14.1: M2 row, as amended by Q53

| Criterion | Met? | O ran | Codex reran | Not independently rerun |
|---|---|---|---|---|
| Engine, one page, initial state | Yes | 77 observations on each page, no `error` | Local `runAudit` pages in its probes | A live run of either page by someone else |
| Axe adapter | Yes | 67 of 67 rules reported in both runs (adapter version 3) | Axe resolver and provider tests, `2c79177` and `b69b717` | - |
| Derivation and reduction | Yes | Findings written by the pure functions of M1 | Recalculated all findings and reductions of both post-Q59 runs: equal to the saved files, at `1c58636` | Same recalculation on the Q63 run files |
| PremiumShot run (Q20, Q53) | Yes | Run at `28f0027`; validated | Both post-Q56 files against `RunFileSchema`, at `b5ac061` | The Q63 run file |
| Aubay run, compared with the dry run (Q53) | Yes | Run at `28f0027`; outcomes as recorded; [runs.md](runs.md) | Comparison counts at `1c58636`; corrected at Q60 | The Q63 run file; live page content since 2026-11-18 |
| Run files validate | Yes | Both pass `RunFileSchema`, manifests complete | As above | - |
| First working-set numbers | Yes | Below | 95 of 95 cases at `1c58636`, at both allowed levels (165 of 165 combinations); 4 of 4 combinations for the two cases added at Q60 | The 97 cases together |

### Kickoff brief

| Criterion | Met? | Note |
|---|---|---|
| Tests, typecheck, coverage validation green | Yes | Above |
| Both run files validate, manifests complete | Yes | Above. Run files omit context listed in item 12 |
| Aubay comparison written, every difference explained | Yes | Same outcome 10 of 10 checks; same outcome and same elements 7 of 10; 3 of 10 with more elements or another step. No departure of the code from a record found in it. Codex corrected the first count (8 to 7) |
| Working-set numbers as counts, per test and per outcome | Yes | Section 2. Per-link measurement is M5 work (Q56), required before any entry is enabled |
| Every check matches its record, every mismatch reported | **Not to the letter; reported** | Section 4, items 1 to 5. Codex classified every `RECORD:` point at `1c58636` |
| Codex's findings answered or open | Yes | Section 3 |
| Every diff reviewed, `m2-status.md` current | Yes | Updated with this report |

## 2. Measures (O, `b69b717`, corpus working@c08d0a84f819)

- **Matched 97 of 97 cases.**
- False assurance 0 of 97; missed fault 0 of 35; false alarm 0 of 62; unexpected error 0 of 97. Each entry at its candidate level, in memory; nothing enabled.

| Test (candidate) | Matched | False assurance | Missed fault | False alarm | Custom-check outcomes over its cases |
|---|---|---|---|---|---|
| 2.1.1 (fail_only) | 10 of 10 | 0 of 10 | 0 of 5 | 0 of 5 | fault 5, no_fault 1, inapplicable 1, cannot_tell 3 |
| 6.2.1 (fail_only) | 10 of 10 | 0 of 10 | 0 of 3 | 0 of 7 | fault 3, no_fault 4, inapplicable 1, cannot_tell 2 |
| 8.2.1 (fail_only) | 7 of 7 | 0 of 7 | 0 of 3 | 0 of 4 | fault 3, cannot_tell 4 |
| 8.3.1 (fail_only) | 10 of 10 | 0 of 10 | 0 of 2 | 0 of 8 | fault 2, no_fault 2, cannot_tell 6 |
| 8.4.1 (fail_only) | 8 of 8 | 0 of 8 | 0 of 2 | 0 of 6 | fault 2, no_fault 3, cannot_tell 3 |
| 8.5.1 (full) | 9 of 9 | 0 of 9 | 0 of 1 | 0 of 8 | fault 1, no_fault 4, cannot_tell 4 |
| 10.1.1 (full) | 9 of 9 | 0 of 9 | 0 of 5 | 0 of 4 | fault 5, no_fault 2, cannot_tell 2 |
| 10.1.2 (full) | 14 of 14 | 0 of 14 | 0 of 7 | 0 of 7 | fault 7, no_fault 4, cannot_tell 3 |
| 11.1.1 (fail_only) | 10 of 10 | 0 of 10 | 0 of 4 | 0 of 6 | fault 4, inapplicable 1, cannot_tell 5 |
| 11.8.2 (full) | 10 of 10 | 0 of 10 | 0 of 3 | 0 of 7 | fault 3, no_fault 3, inapplicable 1, cannot_tell 3 |

The axe checks on these cases had no `error` and no missing observation. Their links to the ten tests are evidence only, so they decide nothing.

The case writers were not the builders of the checks (10.5). Codex ran the 95 cases of `1c58636` and established no further label discrepancy, but says this is not confirmation by a trained RGAA auditor. There is no acceptance set yet (M5).

**Runs (`28f0027`, 2026-11-22).**

| | PremiumShot | Aubay |
|---|---|---|
| Observations (77) | inapplicable 41, no_fault 30, cannot_tell 5, fault 1 | inapplicable 29, no_fault 34, fault 10, cannot_tell 4 |
| Findings (258) | needs_review 214, not_tested 44 | the same |
| Redactions | 1 | 59 |

`testsDecided: 0` in both. `not_tested` covers the 44 tests whose check is not built.

## 3. Codex's holds, and what answered them

| Codex | At | Answer |
|---|---|---|
| Review, 2026-11-20: hold, four findings | `dc35488` | Q56 |
| Full pass, 2026-11-21: hold, two findings | `b5ac061` | Q57 |
| Full pass continued: hold, two blockers (rounded inset; editable text in the 8.3.1 witness and snippets), two findings needing a decision (hidden-subtree record wording; unexpected-error count), one count correction (Aubay) | `1c58636` | Q60 (five items). Q59, Fabien's ruling on four gate items, came before this pass |
| Q60 recheck: hold, textbox-role ancestors | `f9254fd` | Q61 |
| Q61 recheck: hold, axe open shadow trees | `4322991` | Q62 |
| Q62 recheck: axe fix confirmed; a separate frame concern, predating it | `2c79177` | Q63 |
| **Q63 recheck: concern closed; no further blocker found in that recheck** | `b69b717` | 17 of 17 targeted tests, type check, 258 of 258 entries |

The hard stop on a gate failed twice was met from the second hold on: each later round was Fabien's ruling, not the orchestrator's. Codex's own words on the last: not a rerun of the 939 tests or 97 cases, not a full privacy sweep, not approval of the gate. The full sweep stays M3 work (Q62).

Codex verified at `1c58636`: all 139 pairs of 10.1.2 against their sources; 235 of 235 quoted citations; all 258 effective levels. 10.1.2 and 10.1.1 have not changed since.

Code that changed after that full pass: 2.1.1, 6.2.1, 11.1.1, 11.8.2, 8.3.1, 8.5.1 (versions and shared guards), the axe adapter, the sanitiser's role list, the unexpected-error count, and the 6.2.1 record sentence (Q60). Unchanged: 8.4.1, 8.2.1, 10.1.1, 10.1.2, the engine core.

## 4. Open items for Fabien

Each one: what it is, recommendation, what happens if left. While nothing is enabled, none changes a finding. "Decide before enabling" means before that entry is enabled.

**Checks and records.**

1. **11.8.2, three list-hiding cases still fault:** an opaque sibling covering the list, transparent colours, `text-indent: -9999px`. They are outside the record's wording. *Recommend:* leave for now; before enabling 11.8.2 (a `full` candidate), either add them to the record as unmeasured or accept them on the record's literal wording. *If left:* a hidden list could be reported as a fault.
2. **11.8.2, the "can't scroll" rule on the top-level page** (`overflow: hidden` on `html` or `body`) goes beyond the brief and the record. *Recommend:* keep it and write it into the record at the next record change. *If left:* it only removes faults, so more `cannot_tell`.
3. **8.3.1 record does not name `contenteditable`.** Q60 reads editable text as "a field's value". *Recommend:* authorise naming it. *If left:* behaviour is unchanged; the record stays less explicit than the code.
4. **Differences from the record's literal text that Codex classed as widening or departure.** *Recommend:* write each into its record (or change the code) at one record pass before enabling; that pass needs your authorisation. They are:
   - 8.3.1: a quoted `"system-ui"` counts as a named font, so it can make a text node a witness. *If left:* a possible unsupported fault (no fixture shows one).
   - 6.2.1 and 11.1.1: "explicit role" read as the first token, ignoring case; the records do not say so. *If left:* an upper-case role can fault, as Codex's fixture shows.
   - 10.1.1 and 10.1.2: evidence capped at 1,000 elements; the records say to name each. *If left:* evidence only, outcome unaffected.
   - 10.1.2: case variants, and abstention clauses applied everywhere read, widen abstention only.
   - Frames: a definite fault wins over an unread frame, and an unread frame comes before `no_fault` (gate package); the four records (2.1.1, 6.2.1, 11.1.1, 11.8.2) do not state the order. *If left:* the order lives in code and the gate package only.
5. **8.5.1, a page whose only title element is an SVG `title`.** The record faults it; the test says « balise `<title>` ». *Recommend:* rule on it before enabling, abstention being the safe reading. *If left:* it faults, and the case is not in the corpus.
6. **10.1.2, `width`/`height` on `picture > source`: already ruled** (Q59, item 3: the abstention stays). *Recommend:* nothing now. *If left:* responsive pages get "needs review" on 10.1.2. PremiumShot's home page is the case to settle in the v1 trial (10.6).
7. **Records that abstain where the official text reads as failing:** 10.1.2 `width`/`height` on `iframe`; 11.1.1 `aria-labelledby` to a missing id; 6.2.1 a link named only by `aria-label` and `title`; 8.3.1 XHTML 1.0 as text/html with `lang` only. *Recommend:* leave until the v1 trial. *If left:* "needs review" where a fault might be due; no false "passed".
8. **10.1.2 on common real pages:** Google Tag Manager's `noscript` iframe, and inline SVG `rect`, `image` or `use`, give `cannot_tell`; `size` on `input` faults (the record's own example). *Recommend:* leave; use the trial to see how often it happens. *If left:* 10.1.2 is often "needs review".
9. **8.4.1 code list.** Codes withdrawn before 2009 are in neither source, and neither source file states a licence (Q54). *Recommend:* compare the record's "withdrawn codes" scope before enabling, and settle the licence before any redistribution. *If left:* a withdrawn code could fault.
10. **Three entries cannot run at `full`** (11.1.1, 8.4.1, 8.2.1: partial links fail the schema). *Recommend:* accept; they are `fail_only` candidates. *If left:* no effect.
11. **Axe records' stale sentence.** All 67 still say the adapter is not built yet. *Recommend:* authorise removing it. *If left:* the registry contradicts itself; behaviour unchanged.

**Engine, privacy and evidence.**

12. **The run file lacks** the reason a target was not established, timezone, reduced motion, launch arguments, the snippet cap, and whether network idle was reached. Spec 8.8 does not require them. *Recommend:* decide at the start of M3, when targets and sessions change the schema anyway (frozen contract). *If left:* a run cannot be rebuilt fully from its file.
13. **Two axe snippets in Aubay's reCAPTCHA frame are masked**, because frame resolution does not reach that cross-origin frame. *Recommend:* leave; look at it in the M3 sweep. *If left:* less evidence on third-party frames, no leak, outcomes unchanged.
14. **A full privacy-channel sweep stays M3 work** (Q62; you have seen this). *Recommend:* begin M3 with it: every channel of spec 8.7 and every snippet source, planted values, an orchestrator-read saved run file. Five findings in a row (Q56, Q60 to Q63) were one family of leak, found one route at a time. *If left:* another route may exist.
15. **Token masking** may hide long generated class names or ids. *Recommend:* check it in the M3 sweep. *If left:* some locators may be hard to read.
16. **Not tested:** `designMode` in a framed document beyond Codex's synthetic case; axe nodes targeted at frame level on a real page beyond that fixture. *Recommend:* add both to the M3 sweep.
17. **Q57's leftover hiding routes** in the 11.8.2 helper were answered by Q59 item 1 except the three in item 1 here. 2.1.1, 6.2.1 and 11.1.1 stay without a visibility step (Q59 item 2). *Recommend:* nothing to do.

**Other.**

18. **How later milestones run** (spec 14.2: decided after M2). *Recommend:* stay with the session and spawned agents for M3. *If left:* default continues.
19. **Two defects in the orchestrator's process, both corrected:** conflict markers pushed on 2026-11-18 (`d609681`, fixed `ec90905` minutes later), and a builder's deletion of a committed results file (Q60), restored before the merge. *Recommend:* nothing.

## 5. Cost

**Limits and what happened.**

| Decision | Limit | Outcome |
|---|---|---|
| Q51 | 40 points from 40%, check-in at 20 points (60%), stop at 80% | Check-in reached at 62%; paused and reported |
| Q55 | Continue under 90% of that week | Usage was 80% when work resumed, after Fabien's other work |
| Q56, Q57 | No new limit | 87% after Q56 |
| Q58 | 90% cap lifted for the Q57 fixes | 93% |
| Q59 | No limit set (Q58) | Window closed at about 95%; new window at 1% |
| Q60 | Weekly under 8% | 5% |
| Q61, Q62 | Weekly cap 12% | 9%, 10% |
| Q63 | Weekly cap 15%, gate report included | 14%; report did not fit and waited |
| Q64 | Weekly cap 38% | 35% at the last reading before committing; 34% when started. The 14% to 34% rise is not M2's |

**M2's total, in points of the weekly all-models limit.** Taken from the readings at each step; the plan does not separate sessions, and Fabien's other work and Codex rechecks moved the meter between steps.

| Part | Points |
|---|---|
| First build, 40% to 63% | 23 |
| Runs and comparison, 80% to 81% | 1 |
| Q56, 85% to 87% | 2 |
| Q57, 87% to 93% (includes about 15 hours with no M2 work) | 6 |
| Q59, 93% to about 95%, then 0% to 1% | 3 |
| Reading the final pass and briefing Q60, 1% to 3% (includes idle time) | 2 |
| Q60, 3% to 5% | 2 |
| Q61, 7% to 9% | 2 |
| Q62, 9% to 10% | 1 |
| Q63, 12% to 14% | 2 |
| **Total before this report** | **at most 44** |
| This report (Q64), 34% to 35% at the last reading before committing | 1 |

About 10 of the 44 points fall in readings that include idle time or other work (49% to 51% during the first pause, Q57, the 1% to 3% step) and cannot be separated. The count without idle time is therefore between about 34 and 44, against Q51's 40. Excluded as not M2's: 63% to 80%, 81% to 85%, 5% to 7%, 10% to 12%, 14% to 34%. Builders' own token counts: about 1.89 million for the first build, 1.39 million for the corrections. The corrections took about half of M2's points. API-equivalent cost (spec 14.3) was not recorded: the counts do not split input, cached and output tokens, so it cannot be worked out from them.

## 6. Proposed M3 ceiling

**45 points of the weekly all-models limit, with a check-in at 22.** An estimate from one milestone, not a measurement of M3.

- **Why:** M2's first build took 23 points and its corrections up to about 21. M3 changes the engine (steps, `expect`, fresh context per target, saved sessions, capture policy, sample check) and tests every capture channel with planted values. It has no ten checks, but it has the privacy sweep.
- **Split:** up to 25 for the build, 20 kept for Codex's correction rounds.
- **Check-in at 22:** pause, report what is merged, what remains, whether it fits. If not, say so; no scope is cut to make it fit.
- **Start:** after the reset of 2026-11-28 16:00 UTC, in a fresh orchestrator session (cheaper per turn), from a kickoff brief written then. Never more than two Opus builders at once; Sonnet for the rest.
- **Count** only readings taken just before and just after each step, so other work is not booked to M3.
- **First step:** the privacy sweep's design (item 14), since every later piece passes through the sanitiser.

Nothing in M3 has started. M3 starts on Fabien's word.
