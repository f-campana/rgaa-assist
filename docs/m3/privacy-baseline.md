# M3 privacy baseline (build plan part 3, design 4.8)

**2026-11-28, run by the M3 orchestrator.** The harness came from test agent A (`91209fd`, brief `docs/m3/brief-privacy-harness.md`), and the run used `node tests/privacy/baseline.ts`. The code under test is unchanged since `4d4b224`: the harness is the only addition, and it changes nothing in `src/`. Every marker is synthetic. Locations give a prefix, file, byte offset and JSON pointer, never the surrounding bytes. **No baseline row counts as passing.**

Checks on the merged commit: `pnpm typecheck` is clean, and `pnpm test` passes 52 files and 943 tests. The post-build suite (`pnpm test:privacy`) fails on this code by design.

## Summary

| Verdict | Rows |
|---|---|
| leak seen | qx001, qx002, qx003, qx011, qx017, qx019, qx022, qx023, qx030, qx031, qx032, qx035, qx060 (stderr, prefix), qx062, qx064 (stderr), qx103, qx213 |
| not reached or unproven | qx024, qx025 (the design expected leaks; today's sanitiser masks `value=`), qx101, qx102 |
| control ok | qx200 to qx212, qx214 (qx206: the plain pair's fingerprints differ) |
| control failed | none |
| Q70 | no capture call; no image file or signature |

The design expected leaks at qx024 and qx025, and neither was reached. qx001 leaked through the locator, which the design did not list. qx213, the Q72 slot row, leaked, as expected.

## Harness differences from the design (test agent A's report)

1. `runAudit` has no confined-context hook, so the fixture origin block does not apply in `runAudit` or CLI runs. The capture guard wraps `chromium.launch` instead.
2. The child-process run is covered by the image search only.
3. The fixture server has no redirect, so the qx050 redirect-query case is not built.
4. For qx064, the marker is planted only in the message and the output path. The stack's function name and file path need `src/`.
5. 8.2.1 duplicate pairs give one evidence item per element, so each item's count is asserted on its own.
6. qx209 is a cost row: a control at baseline, and withheld after the build.

**Orchestrator's note for the next slice.** The rows share one page and one run, so different rows' markers fall in the same observation (for example `/observations/24`). A control can then be found inside another row's snippet. The post-build oracle must assert each row by exact expected values per piece, not by a marker's presence anywhere. Splitting rows into separate runs is an option, at the cost of run time.

**Not yet built.** Composite rows qx037 to qx039 and qx215 to qx219; adversarial rows qx040 to qx049; the probe; step and session rows; the static check; the remaining rows of 4.3.

## Raw table

```
baseline, revision 91209fd, 35 rows
row	verdict	location (prefix, form, file, byte offset, JSON pointer)
qx001	leak seen	qx001- (prefix) in run/run.json at byte 324579, pointer /observations/43/evidence/0/locator; qx001- (raw) in run/run.json at byte 324579, pointer /observations/43/evidence/0/locator; qx001- (prefix) in run/run.json at byte 353871, pointer /observations/53/evidence/0/locator
qx002	leak seen	qx002- (prefix) in run/run.json at byte 265881, pointer /observations/23/evidence/0/locator; qx002- (raw) in run/run.json at byte 265881, pointer /observations/23/evidence/0/locator; qx002- (raw) in run/run.json at byte 393201, pointer /observations/68/evidence/0/snippet [design expects a leak]
qx003	leak seen	qx003- (raw) in run/run.json at byte 396879, pointer /observations/73/evidence/0/snippet; qx003- (raw) in run/run.json at byte 396938, pointer /observations/73/evidence/0/note; qx003- (raw) in run/run.json at byte 397256, pointer /observations/73/evidence/1/snippet [design expects a leak]
qx011	leak seen	qx011- (raw) in run/run.json at byte 269042, pointer /observations/24/evidence/0/snippet; qx011- (prefix) in run/run.json at byte 269062, pointer /observations/24/evidence/0/snippet; qx011- (raw) in run/run.json at byte 269062, pointer /observations/24/evidence/0/snippet [design expects a leak]
qx017	leak seen	qx017- (raw) in run/run.json at byte 266091, pointer /observations/23/evidence/0/locator; qx017- (prefix) in run/run.json at byte 266121, pointer /observations/23/evidence/0/locator; qx017- (raw) in run/run.json at byte 266121, pointer /observations/23/evidence/0/locator [design expects a leak]
qx019	leak seen	qx019- (raw) in run/run.json at byte 395396, pointer /observations/69/fingerprint; qx019- (prefix) in run/run.json at byte 395409, pointer /observations/69/fingerprint; qx019- (raw) in run/run.json at byte 395409, pointer /observations/69/fingerprint [design expects a leak]
qx022	leak seen	qx022- (raw) in run/run.json at byte 268957, pointer /observations/24/evidence/0/snippet; qx022- (raw) in run/run.json at byte 353376, pointer /observations/53/evidence/0/snippet; qx022- (raw) in run/run.json at byte 362191, pointer /observations/56/evidence/0/snippet [design expects a leak]
qx023	leak seen	qx023- (raw) in run/run.json at byte 268965, pointer /observations/24/evidence/0/snippet; qx023- (raw) in run/run.json at byte 353397, pointer /observations/53/evidence/0/snippet; qx023- (raw) in run/run.json at byte 362225, pointer /observations/56/evidence/0/snippet [design expects a leak]
qx024	not reached or unproven	- [design expects a leak]
qx025	not reached or unproven	- [design expects a leak]
qx030	leak seen	qx030- (raw) in run/run.json at byte 396879, pointer /observations/73/evidence/0/snippet; qx030- (raw) in run/run.json at byte 396937, pointer /observations/73/evidence/0/note; qx030- (raw) in run/run.json at byte 397254, pointer /observations/73/evidence/1/snippet; fingerprints differ across the pair [design expects a leak]
qx035	leak seen	qx035- (raw) in run/run.json at byte 395972, pointer /observations/69/fingerprint; qx035- (raw) in run/run.json at byte 398340, pointer /observations/72/fingerprint; qx035- (prefix) in run/run.json at byte 395972, pointer /observations/69/fingerprint; fingerprints differ across the pair [design expects a leak]
qx031	leak seen	qx031- (raw) in run/run.json at byte 201843, pointer /observations/1/evidence/0/snippet; qx031- (raw) in run/run.json at byte 201877, pointer /observations/1/evidence/0/snippet; qx031- (raw) in run/run.json at byte 201995, pointer /observations/1/evidence/0/note [design expects a leak]
qx032	leak seen	qx032- (raw) in run/run.json at byte 315563, pointer /observations/40/evidence/0/snippet; qx032- (raw) in run/run.json at byte 315589, pointer /observations/40/evidence/0/snippet; qx032- (raw) in run/run.json at byte 353682, pointer /observations/53/evidence/0/snippet [design expects a leak]
qx060	leak seen	qx060- (prefix) in stderr at byte 71 [design expects a leak]
qx062	leak seen	qx062- (raw) in run/run.json at byte 198932, pointer /observations/0/error/message; qx062- (raw) in run/run.json at byte 202356, pointer /observations/1/error/message; qx062- (raw) in run/run.json at byte 205780, pointer /observations/2/error/message [design expects a leak]
qx064	leak seen	qx064- (raw) in stderr at byte 132 [design expects a leak]
qx101	not reached or unproven	-
qx102	not reached or unproven	-
qx103	leak seen	qx103- (prefix) in run/run.json at byte 201843, pointer /observations/1/evidence/0/snippet; qx103- (prefix) in run/run.json at byte 201883, pointer /observations/1/evidence/0/snippet; qx103- (json) in run/run.json at byte 202007, pointer /observations/1/evidence/0/note [design expects a leak]
qx200	control ok	qx200- (prefix) in run/run.json at byte 263154, pointer /observations/22/evidence/0/snippet; qx200- (raw) in run/run.json at byte 263154, pointer /observations/22/evidence/0/snippet; qx200- (raw) in run/run.json at byte 263196, pointer /observations/22/evidence/0/snippet
qx201	control ok	qx201- (raw) in run/run.json at byte 268966, pointer /observations/24/evidence/0/snippet; qx201- (raw) in run/run.json at byte 268993, pointer /observations/24/evidence/0/snippet; qx201- (raw) in run/run.json at byte 353356, pointer /observations/53/evidence/0/snippet
qx202	control ok	qx202- (raw) in run/run.json at byte 262989, pointer /observations/22/evidence/0/locator; qx202- (raw) in run/run.json at byte 266070, pointer /observations/23/evidence/0/locator; qx202- (raw) in run/run.json at byte 269147, pointer /observations/24/evidence/0/snippet
qx203	control ok	qx203- (prefix) in run/run.json at byte 265881, pointer /observations/23/evidence/0/locator; qx203- (raw) in run/run.json at byte 268952, pointer /observations/24/evidence/0/snippet; qx203- (prefix) in run/run.json at byte 268975, pointer /observations/24/evidence/0/snippet
qx204	control ok	qx204- (raw) in run/run.json at byte 263125, pointer /observations/22/evidence/0/snippet; qx204- (raw) in run/run.json at byte 266095, pointer /observations/23/evidence/0/locator; qx204- (raw) in run/run.json at byte 269179, pointer /observations/24/evidence/0/snippet
qx205	control ok	qx205- (prefix) in run/run.json at byte 265881, pointer /observations/23/evidence/0/locator; qx205- (raw) in run/run.json at byte 268974, pointer /observations/24/evidence/0/snippet; qx205- (prefix) in run/run.json at byte 268998, pointer /observations/24/evidence/0/snippet
qx206	control ok	fingerprints compared
qx207	control ok	qx207- (prefix) in run/run.json at byte 265881, pointer /observations/23/evidence/0/locator; qx207- (raw) in run/run.json at byte 268968, pointer /observations/24/evidence/0/snippet; qx207- (prefix) in run/run.json at byte 268991, pointer /observations/24/evidence/0/snippet
qx208	control ok	qx208- (prefix) in run/run.json at byte 265881, pointer /observations/23/evidence/0/locator; qx208- (raw) in run/run.json at byte 268967, pointer /observations/24/evidence/0/snippet; qx208- (prefix) in run/run.json at byte 268990, pointer /observations/24/evidence/0/snippet
qx209	control ok	qx209- (prefix) in run/run.json at byte 265881, pointer /observations/23/evidence/0/locator; qx209- (raw) in run/run.json at byte 268974, pointer /observations/24/evidence/0/snippet; qx209- (prefix) in run/run.json at byte 268994, pointer /observations/24/evidence/0/snippet
qx210	control ok	qx210- (raw) in run/run.json at byte 268956, pointer /observations/24/evidence/0/snippet; qx210- (raw) in run/run.json at byte 315680, pointer /observations/40/evidence/0/snippet; qx210- (raw) in run/run.json at byte 353778, pointer /observations/53/evidence/0/snippet
qx211	control ok	qx211- (prefix) in run/run.json at byte 263154, pointer /observations/22/evidence/0/snippet; qx211- (raw) in run/run.json at byte 263217, pointer /observations/22/evidence/0/snippet; qx211- (prefix) in run/run.json at byte 269268, pointer /observations/24/evidence/0/snippet
qx212	control ok	qx212- (prefix) in run/run.json at byte 268972, pointer /observations/24/evidence/0/snippet; qx212- (raw) in run/run.json at byte 268986, pointer /observations/24/evidence/0/snippet; qx212- (prefix) in run/run.json at byte 269017, pointer /observations/24/evidence/0/snippet
qx213	leak seen	qx213- (prefix) in run/run.json at byte 353382, pointer /observations/53/evidence/0/snippet; qx213- (raw) in run/run.json at byte 353382, pointer /observations/53/evidence/0/snippet; qx213- (raw) in run/run.json at byte 353399, pointer /observations/53/evidence/0/snippet [design expects a leak]
qx214	control ok	qx214- (prefix) in run/run.json at byte 269115, pointer /observations/24/evidence/0/snippet; qx214- (raw) in run/run.json at byte 269132, pointer /observations/24/evidence/0/snippet; qx214- (prefix) in run/run.json at byte 353576, pointer /observations/53/evidence/0/snippet
capture guard: no capture call; no image file or signature found
No baseline row counts as passing.
```

## Second slice (2026-11-28, `2e8b766`, rebased onto `77d1f38`)

Test agent A added 36 rows (`tests/privacy/fixtures/rows2.ts`). Each row and variant runs separately. Every control now states its check and piece, and passes only on that piece's evidence. A marker found elsewhere in `run.json` no longer counts. A self-test requires every control to state its expectations. `pnpm typecheck` is clean and `pnpm test` passes 944 tests.

| Verdict | Rows |
|---|---|
| leak seen | qx004 to qx010, qx012 to qx016, qx018, qx028, qx033, qx034, qx036, qx037, qx039, qx216 (HTML variant), qx218 |
| not reached or unproven | qx020, qx021, qx027, qx029 (today's sanitiser masks `value=` and `placeholder` content); qx038, qx215, qx217 (not reached by the chosen carrier); qx063; tokens |
| control ok | qx200 to qx212, qx214, qx219 |
| Q70 | no capture call; no image file or signature |

**Differences from the design:**
- 8.2.1 and 10.1.1 snippets are start tags only, so composites are read through axe's `outer` on `div role="img"` carriers. qx038 therefore has no `<font>` outer.
- qx018 and qx063 use the refused local port `127.0.0.1:1`.
- qx215's detached-template case is not built.
- qx216 is one row with HTML and XHTML variants.
- qx218's forced timeout is a `test.todo` naming the engine hook `forceCompositeWalkTimeout`, which part 4 must provide.

**Orchestrator's note.** qx038, qx215 and qx217 must be reached, meaning they show a leak at baseline or are proven by the probe, before the post-build run can count them.

**Still not built:**
- the provider and probe rows, qx040 to qx049;
- the redirect case;
- qx052 to qx056;
- steps and sessions;
- the static check;
- G1 to G3.

## Third slice (2026-11-28, `a1713cb`)

Written by a second test agent.
- qx038, qx215 and qx217 are now differential-fingerprint pairs in `rows3.ts`, alongside the XHTML pair `qx215x` and the plain pair control `qx219p`. Baseline: qx038, qx215 and qx215x show a **leak seen**, with fingerprints that differ across each pair. qx217 shows a **leak seen** in the snippet, through a `title=` inside `noscript`, and in the fingerprint. qx219p is **control ok**.
- The old snippet versions, qx038s, qx215s and qx217s, are still **not reached or unproven**, because today's sanitiser masks them.
- The detached-template case can't be planted from a fixture and needs engine support. A nested template stands in for it.
- **Static check (4.6):** `tests/privacy/static-check.privacy.ts`, run under `pnpm test:privacy` only. It finds 117 hits in `src/checks/**` today, kept as a per-file known list (`static-check.known.json`). It is a heuristic, not a provenance proof.

## Engine guard, first slice (part 4, `ce805f8`)

Written by core builder B. The guard is not wired into `run-checks.ts` yet, so run output is unchanged.
- **Files:** `src/engine/editable-context.ts`, the optional source and derivation types in `src/checks/types.ts`, and 23 unit tests in `tests/engine/editable-context.test.ts`.
- **Where it differs from the design:**
  - XHTML documents are withheld whole rather than walked. This fails closed.
  - A `noscript` raw text node containing `<` or `&` is withheld.
  - Options are always replaced whole.
  - Fingerprint parts are joined with `|`.
  - A test-only `failAt` option forces a walk failure. It must move behind the probe seam before wiring.
- **New limit:** a light-DOM child slotted into an editable element inside a **closed** shadow root is judged plain, because `assignedSlot` is null there. This needs CDP. It is to be fixed or added to section 7 before the gate.
- **Left:** wiring, with references stripped before validation; the axe identity condition with the CDP DOM event log; `loaderId` stability; the probe seam and the `forceCompositeWalkTimeout` hook; error classes (section 5); the `locator`, `accname`, `accvalue` and `frameUrl` derivations; note templates and `locatorList`; the per-provider timeout.
- **Flaky test:** `tests/checks/axe/editable-resolved.test.ts` timed out once at 5 s under full-suite load, in two separate runs. It passes on its own and on reruns.

## Engine guard, second slice (part 4, `07f713f`)

The guard is still not wired in.
- **Closed shadow roots** are read through `DOM.getDocument` with `pierce`, in the guard's own CDP session. A child slotted into an editable element inside a closed root is now withheld, and anything that can't be established fails closed.
- **Probe seam:** in memory only, with the hooks `forceCompositeWalkFailure` and `forceCompositeWalkTimeout` (qx218). `failAt` is removed. The guard timeout per piece is 5 s.
- **Derivations** now cover `locator`, `accname`, `accvalue` and `frameUrl`.
- **Notes and lists:** note templates and slots are checked against what the check declared, the fixed engine notes of 3.4 are in place, and `locatorList` is guarded member by member.
- `pnpm test` passes 979 tests.
- **Where it differs from the design:**
  - `accname` and `accvalue` need a CDP backend-id source, and their check and their read are two separate tasks.
  - The check for a field or box inside an `accname` does not look inside closed roots.
  - Closed-root paths assume CDP leaves out whitespace-only text nodes. If it doesn't, the piece fails closed.
  - Frame documents are matched by URL, so a duplicate URL withholds the piece.
  - A failed source counts each derived note slot as one withheld piece.
  - `locatorList` is returned beside the evidence; how it is written is left to the wiring.

## Engine guard, CDP assumption tests (part 4, `d2a8a2a`)

`tests/engine/editable-context-cdp.test.ts` has 9 tests on synthetic pages. Every assumption tested holds:
- DOM, attribute, character-data, closed-shadow-attach and frame-navigation events are logged;
- a whole-document read with `pierce` includes closed roots and leaves out whitespace-only text nodes;
- `loaderId` changes after a navigation and `frameId` doesn't;
- same-process frames share the page's log session, and a cross-origin frame has its own.

No fix was needed. Two assumptions are still untested: `frameAttached` for a frame created after the log starts, and events in a framed document's closed roots. `pnpm test` passes 995 tests.

## Error classes, design section 5 (`2fd7ea2`, `52fb117`)

`src/engine/error-class.ts` classifies errors by origin. The CLI's internal-error line now shows the class, a fixed message and the code `E-CLI-01`, with no stack. Sample parsing gives "not valid JSON", or a schema path plus its zod issue code. `target.ts` and `run-checks.ts` give fixed page and browser messages, and `firstLine` is removed. A single engine choke point (`checkFailureMessage`) replaces any undeclared text in a check's `check_error` or `scope_unreadable` message with its fixed class message. Only messages marked `declared` keep their text, and so far only axe's "rule not reported" message is marked. `pnpm test` passes 1009 tests.

**Baseline rerun at `52fb117`:**
- qx060 and qx064 are now **not reached or unproven**. Their leaks are gone.
- qx062 has left `error.message`, but it still shows a **leak seen** in a check's evidence note (`/observations/69/evidence/0/note`). That note route (E16) closes with the guard's wiring and part 5.
- qx200 is still **control ok**.

**Trade-off for Fabien.** Most checks' error messages, including families A, B and C and axe's index message, now read "the evaluation in the page failed" instead of their own text. Messages that are truly constant can be marked `declared` later to get their specific text back.

**Where it differs from the design:**
- The page message carries no frame index; the frame record already has it.
- Browser messages carry no URL; `requestedUrl` is already on the record.
- Some `net::` codes get their own fixed messages.
- The `timeouts:` message in `run.ts` is left as it is, since the engine builds it.
- The family B notes (E16) and storage-state errors (C7) are not done.
