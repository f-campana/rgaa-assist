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
