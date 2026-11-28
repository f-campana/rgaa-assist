/**
 * Baseline mode (design 4.8). Run as `node tests/privacy/baseline.ts`.
 *
 * It uses only `runAudit`, `runCli` and the byte search (through the runner):
 * no probe, nothing written for the guard. Each row gets one of three
 * verdicts, and no baseline row ever counts as passing:
 *
 *   leak seen                 a marker was found (reach is shown by the leak)
 *   not reached or unproven   no marker found; the baseline cannot tell a safe
 *                             route from an unreached one
 *   control ok / failed       for the positive rows (the text is present, or
 *                             a plain pair differs)
 *
 * The table gives row, verdict, and the file, byte offset and JSON pointer of
 * the first hits, with the prefix and form only: never the bytes around a
 * hit. Everything is written under a temporary folder, removed at the end.
 *
 * Options: `--rows qx002,qx003` runs only those rows.
 */
import { spawnSync } from "node:child_process";
import { ROWS } from "./fixtures/rows.ts";
import type { Row } from "./fixtures/types.ts";
import { execute, expectMet, finish, fingerprintsOf } from "./runner.ts";
import type { RunOutcome } from "./runner.ts";
import { describeHit } from "./search.ts";

type Verdict = "leak seen" | "not reached or unproven" | "control ok" | "control failed";

function verdictOf(row: Row, outcomes: RunOutcome[]): { verdict: Verdict; where: string[] } {
  const hits = outcomes.flatMap((o) => o.hits);
  const where = hits.slice(0, 3).map(describeHit);
  if (row.role === "leak") return { verdict: hits.length > 0 ? "leak seen" : "not reached or unproven", where };
  if (row.role === "pair") {
    const [a, b] = outcomes.map((o) => (o.runJson === undefined ? [] : fingerprintsOf(o.runJson, row.oracle.checks)));
    const comparable = a !== undefined && b !== undefined && a.length > 0 && b.length > 0;
    const differ = comparable && JSON.stringify(a) !== JSON.stringify(b);
    if (row.oracle.saved.kind === "fingerprints" && row.oracle.saved.relation === "differ") {
      return { verdict: differ ? "control ok" : "control failed", where: [comparable ? "fingerprints compared" : "no fault fingerprint on one side"] };
    }
    return {
      verdict: differ ? "leak seen" : "not reached or unproven",
      where: differ ? [...where, "fingerprints differ across the pair"] : [comparable ? "fingerprints identical" : "no fault fingerprint on one side"],
    };
  }
  // control: every expected plain piece is in that piece of that check, in every variant. A marker found
  // elsewhere in the run never counts.
  const expects = row.oracle.expect ?? [];
  const ok = expects.length > 0 && outcomes.every((o) => expects.every((e) => expectMet(o.runJson, e)));
  return { verdict: ok ? "control ok" : "control failed", where: ok ? where : [] };
}

function revision(): string {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

async function main(): Promise<void> {
  const arg = process.argv.indexOf("--rows");
  const only = arg > 0 ? new Set((process.argv[arg + 1] ?? "").split(",")) : undefined;
  const rows = ROWS.filter((r) => only === undefined || only.has(r.id));
  const lines: string[] = [];
  const notes: string[] = [];
  for (const row of rows) {
    const outcomes: RunOutcome[] = [];
    try {
      for (const variant of row.variants) outcomes.push(await execute(row, variant));
    } catch (e) {
      // The message is the harness's own failure and may carry a fixture URL, never page bytes of a marker.
      lines.push(`${row.id}\tnot reached or unproven\tharness error: ${(e as Error).name}`);
      continue;
    }
    const { verdict, where } = verdictOf(row, outcomes);
    const expected = row.baselineLeakExpected ? " [design expects a leak]" : "";
    lines.push(`${row.id}\t${verdict}\t${where.join("; ") || "-"}${expected}`);
    for (const o of outcomes) {
      if (o.captureCalls.length > 0) notes.push(`${row.id}/${o.variant}: capture call(s) seen: ${o.captureCalls.join(", ")}`);
      if (o.images.length > 0) notes.push(`${row.id}/${o.variant}: image file(s): ${o.images.map((i) => `${i.file} (${i.reason})`).join(", ")}`);
      finish(o, false);
    }
  }
  process.stdout.write(`baseline, revision ${revision()}, ${rows.length} rows\nrow\tverdict\tlocation (prefix, form, file, byte offset, JSON pointer)\n`);
  process.stdout.write(`${lines.join("\n")}\n`);
  process.stdout.write(`${notes.length === 0 ? "capture guard: no capture call; no image file or signature found" : notes.join("\n")}\n`);
  process.stdout.write("No baseline row counts as passing.\n");
}

main().then(
  () => {
    process.exit(0);
  },
  (e: unknown) => {
    process.stderr.write(`baseline: harness failure: ${e instanceof Error ? e.name : "unknown"}\n`);
    process.exit(70);
  },
);
