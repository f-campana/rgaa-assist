/**
 * Post-build mode: the oracle comparison (design 4.2, 4.3). Run with
 * `pnpm test:privacy`. These tests fail on today's code by design: they
 * describe what the guard must do. `pnpm test` does not pick this file up
 * (it is not `*.test.ts`).
 *
 * Per row: the capture wrapper saw nothing and no image is in a searched
 * location; leak rows hold no marker in any searched place, raw, escaped or
 * by prefix; protected pieces are saved as exactly `[redacted]` with the
 * expected count; plain pieces carry the exact expected text; differential
 * pairs compare fingerprints. The oracle states all of it from the fixture
 * source (`fixtures/rows.ts`), never from the engine.
 *
 * Diagnostics name the prefix, form, file, byte offset and JSON pointer, and
 * never the surrounding bytes. A failing run's folder is kept, its path
 * printed.
 */
import { describe, expect, it } from "vitest";
import { ROWS } from "./fixtures/rows.ts";
import type { Row } from "./fixtures/types.ts";
import { execute, finish, fingerprintsOf, observationsOf } from "./runner.ts";
import type { RunOutcome } from "./runner.ts";
import { describeHit } from "./search.ts";

const REDACTED = "[redacted]";

function problemsFor(row: Row, outcomes: RunOutcome[]): string[] {
  const problems: string[] = [];
  const { oracle } = row;
  for (const o of outcomes) {
    for (const c of o.captureCalls) problems.push(`${o.variant}: capture call ${c}`);
    for (const i of o.images) problems.push(`${o.variant}: image ${i.file} (${i.reason})`);
  }

  if (oracle.saved.kind === "fingerprints") {
    const [a, b] = outcomes.map((o) => fingerprintsOf(o.runJson, oracle.checks));
    if (a === undefined || b === undefined || a.length === 0 || b.length === 0) {
      problems.push("a variant has no fault fingerprint to compare (not reached)");
    } else {
      const same = JSON.stringify(a) === JSON.stringify(b);
      if (oracle.saved.relation === "identical" && !same) problems.push("fingerprints differ across the pair");
      if (oracle.saved.relation === "differ" && same) problems.push("fingerprints are identical across the pair (the test cannot fail)");
    }
    if (row.role === "pair" && oracle.saved.relation === "identical") {
      for (const o of outcomes) for (const h of o.hits) problems.push(`${o.variant}: ${describeHit(h)}`);
    }
    return problems;
  }

  const expectedAbsent = row.role === "leak" || oracle.saved.kind === "redacted" || oracle.saved.kind === "none";
  for (const o of outcomes) {
    if (expectedAbsent) for (const h of o.hits) problems.push(`${o.variant}: marker found: ${describeHit(h)}`);
    const obs = observationsOf(o.runJson).filter((x) => oracle.checks.includes(x.checkId));
    const items = obs.flatMap((x) => x.evidence.filter((e) => e.kind !== "scope_examined"));

    if (oracle.saved.kind === "redacted" && oracle.checks.length === 1) {
      if (oracle.items !== null && items.length !== oracle.items) problems.push(`${o.variant}: ${items.length} evidence items, expected ${oracle.items}`);
      const want = oracle.saved.count;
      if (want > 0) {
        items.forEach((e, n) => {
          if ((e.redactions ?? 0) !== want) problems.push(`${o.variant}: evidence item ${n} has ${e.redactions ?? 0} redactions, expected ${want}`);
        });
      }
      for (const piece of oracle.pieces) {
        if (piece !== "snippet" && piece !== "locator" && piece !== "note") continue;
        if (!items.some((e) => e[piece] === REDACTED)) problems.push(`${o.variant}: no ${piece} saved as exactly ${REDACTED}`);
      }
    }
    if (oracle.saved.kind === "text") {
      const strings = obs.flatMap((x) => [x.fingerprint, ...x.evidence.flatMap((e) => [e.snippet, e.locator, e.note])]).filter((s): s is string => s !== undefined);
      for (const text of oracle.saved.present) {
        if (!strings.some((s) => s.includes(text))) problems.push(`${o.variant}: expected plain text ${text.slice(0, 6)}… not present`);
        if (items.length > 0 && oracle.items !== null && items.length !== oracle.items) problems.push(`${o.variant}: ${items.length} evidence items, expected ${oracle.items}`);
      }
      const redactions = items.reduce((n, e) => n + (e.redactions ?? 0), 0);
      if (redactions !== 0) problems.push(`${o.variant}: ${redactions} redactions on a control, expected 0`);
    }
    for (const token of oracle.forbiddenInSnippets ?? []) {
      const re = new RegExp(`\\b${token}\\b`);
      if (obs.some((x) => x.evidence.some((e) => e.snippet !== undefined && re.test(e.snippet)))) problems.push(`${o.variant}: the name "${token}" is in a saved snippet`);
    }
  }
  return problems;
}

describe.each(ROWS.map((r) => [r.id, r] as const))("privacy row %s", (_id, row) => {
  it(row.title, async () => {
    const outcomes: RunOutcome[] = [];
    for (const variant of row.variants) outcomes.push(await execute(row, variant));
    const problems = problemsFor(row, outcomes);
    for (const o of outcomes) finish(o, problems.length > 0);
    expect(problems, `row ${row.id}: ${row.oracle.allowed}`).toEqual([]);
  }, 180_000);
});

// PROBE CHECK (part 4). The probe seam (`privacyProbe` on `runAudit`) does not exist until the
// engine builder lands it. For each protected row, this is where reach is asserted: the probe saw
// the expected node (its `data-probe` key) for the expected check and piece, with the verdict and
// count the oracle states. The oracle's `checks`, `pieces` and `saved` give the expectation.
describe("probe check (part 4, not yet possible)", () => {
  it.todo("reach: the probe saw the expected node for the expected check and piece, for every protected row");
  it.todo("probe keys appear nowhere in the output");
});
