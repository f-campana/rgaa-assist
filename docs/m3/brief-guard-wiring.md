# M3 brief: wiring the engine guard (build plan part 4, last piece), handoff for after the reset

Status on 2026-11-28 at 15:50 UTC, main `0aa6b20`. This brief is for the next core builder and for whoever orchestrates. **Nothing in it starts without Fabien's word.**

## What exists

- **`src/engine/editable-context.ts`.** The guard, three slices plus tests of its assumptions about Chrome's debugging protocol (CDP). It provides:
  - `derivePiece` for every derivation kind;
  - the composite walk, with closed-root slots;
  - `deriveNote` and `deriveEvidence`, with `locatorList` handling;
  - `buildFingerprint` and `attributeFingerprintWithholding`;
  - `startDomEventLog`, `resolveAxeTarget` and `readFrameIdentity`;
  - the in-memory `PrivacyProbe`, with the hooks `forceCompositeWalkFailure`, `forceCompositeWalkTimeout` and `betweenReads`.

  Unit tests: `tests/engine/editable-context*.test.ts`.
- **`src/checks/types.ts`.** Optional additions: `CheckResult.sourced`, `CheckDefinition.declared`, `CheckFailure.declared`, and the source and derivation types.
- **`src/engine/error-class.ts`.** Error classes by origin. The `checkFailureMessage` choke point is in `run-checks.ts`.
- **`tests/privacy/`.** The harness: the baseline script, the post-build suite (`pnpm test:privacy`), the static check and its known list. Baseline results are in `docs/m3/privacy-baseline.md`.

## Next step A: wiring (core builder B; owns `src/engine/`)

1. **`run-checks.ts`:**
   - Start `startDomEventLog` before the providers run, and stop it after the last piece is derived.
   - For a result with `sourced`, derive every piece through the guard, attribute fingerprint withholding, then validate. Strip references before schema validation.
   - Withhold legacy raw strings when a result is sourced. While providers have not moved (part 5), keep today's path for unsourced results, so nothing regresses before part 5.
2. **`runAudit`:** a test-only `privacyProbe` option, in memory, never written to disk. Its hooks are reachable only through it.
3. **Timeouts:** the guard timeout per provider (design 3.3), with every unfinished piece withheld.
4. **Tests:** engine tests with a sourced test provider, without touching `src/checks/`. `pnpm test` stays green.

## Next step B: providers emit sources (builder C; owns `src/checks/`, after A's interface)

- Every provider returns `sourced`: the axe adapter, families A, B and C, and 8.2.1. The design's 3.6 fingerprints (F1, F2, E5) are covered.
- In-page snippet guards are removed, and 8.3.1 moves to the shared predicate.
- Check versions are bumped, and constant error messages are marked `declared` where their wording matters.
- The legacy unsourced path is then removed from `run-checks.ts`.

## Then

- The test agent adds the adversarial rows qx040 to qx049 (design 4.4) against the sourced interface, and wires the probe check into `oracle.privacy.ts`. Its placeholder is already marked there.
- The orchestrator runs `pnpm test:privacy` and the baseline, and reruns the working set (step 11 of the kickoff) to measure the cost of the short-value rule and generated names.

## Open points to settle (see `docs/m3/privacy-baseline.md`)

- **Not built:**
  - XHTML walking (withheld today);
  - family B notes (E16) and storage-state errors (C7);
  - the detached-template case.
- **Untested CDP assumptions:** `frameAttached` for a frame created after the log starts, and events in a framed document's closed roots.
- **Leaks still open:** qx062 still leaks through a check's evidence note until step B lands.
- **Gate report:** Codex's two limits from Q72 go in it: absence of a match is not proof of independent origin, and the no-image claim is limited to tool-controlled locations.
- **Budget:** M3 has used 17 of Q66's 45 points, and the check-in is at 22.
