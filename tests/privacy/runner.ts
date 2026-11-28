/**
 * Privacy harness runner (design 4.1, 4.2). It runs one variant of one row
 * through the real engine and searches everything the run left behind.
 *
 * Engine imports are limited to `runAudit`, `allProviders`, `runCli` and
 * `serveFixture`: no probe, nothing written for the guard. Both the baseline
 * script and the post-build suite use this module.
 *
 * Folders. Each run owns `<system tmp>/qxp-XXXX/` with `in/` (the sample file,
 * an input that carries markers by design, so never searched), `out/` (the
 * run folder) and `tmp/` (the run's own temporary folder: `TMPDIR` points at
 * it for the whole run, including the child process). The system temporary
 * folder is listed before and after, and every new entry is searched too.
 * The run folder is removed at the end unless the caller keeps it (failure).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allProviders } from "../../src/checks/index.ts";
import { runCli } from "../../src/cli/commands.ts";
import { runAudit } from "../../src/engine/index.ts";
import { serveFixture } from "../../src/engine/testing/index.ts";
import { installCaptureGuard, takeCaptureCalls } from "./capture-guard.ts";
import type { Row, Variant } from "./fixtures/types.ts";
import { imagesUnder, searchBuffer, searchTree } from "./search.ts";
import type { Hit, ImageFinding } from "./search.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export interface RunOutcome {
  rowId: string;
  variant: string;
  exitCode: number;
  /** Every marker hit, in every searched place. */
  hits: Hit[];
  images: ImageFinding[];
  captureCalls: string[];
  /** Parsed `run.json`, when one was written. Used by the oracle comparison only. */
  runJson?: unknown;
  /** The run's folder; removed by `finish` unless kept. */
  dir: string;
  /** New top-level entries of the system temporary folder (searched). */
  newTmpEntries: string[];
}

function listDir(d: string): Set<string> {
  try {
    return new Set(readdirSync(d));
  } catch {
    return new Set();
  }
}

/** Remove a run's folder, or keep it and print its path (for a failure). */
export function finish(outcome: RunOutcome, keep: boolean): void {
  if (keep) process.stderr.write(`privacy harness: kept ${outcome.dir} (row ${outcome.rowId}, variant ${outcome.variant})\n`);
  else rmSync(outcome.dir, { recursive: true, force: true });
}

/** Run one variant of a row, then search stdout, stderr, the run folder, the run's temporary folder and new system temporary entries. */
export async function execute(row: Row, variant: Variant): Promise<RunOutcome> {
  installCaptureGuard();
  takeCaptureCalls();
  const realTmp = tmpdir();
  const before = listDir(realTmp);
  const dir = mkdtempSync(join(realTmp, "qxp-"));
  const inDir = join(dir, "in");
  const outDir = join(dir, "out");
  const ownTmp = join(dir, "tmp");
  for (const d of [inDir, ownTmp]) mkdirSync(d, { recursive: true });
  const savedTmpdir = process.env["TMPDIR"];
  process.env["TMPDIR"] = ownTmp;
  const server = await serveFixture({ ...variant.files });
  let stdout = "";
  let stderr = "";
  let exitCode = -1;
  try {
    const samplePath = join(inDir, "sample.json");
    writeFileSync(
      samplePath,
      row.rawSample ??
        JSON.stringify({
          project: { name: "Fixture", ruleset: "rgaa-4.1.2" },
          pages: [{ id: "home", url: variant.pageUrl ?? `${server.url(variant.page ?? "index.html")}${variant.urlSuffix ?? ""}`, kinds: ["home"] }],
        }),
    );
    let out = outDir;
    if (row.badOut === true) {
      // An output directory under a regular file: creating it fails, after the audit, with a path in the message.
      const blocker = join(inDir, row.markers[0] ?? "qx000-x");
      writeFileSync(blocker, "not a directory");
      out = join(blocker, "out");
    }
    if (row.via === "child") {
      const r = spawnSync(process.execPath, [join(REPO, "src/cli/main.ts"), "audit", samplePath, "--out", out], {
        cwd: REPO,
        env: { ...process.env, TMPDIR: ownTmp },
        encoding: "buffer",
        timeout: 150_000,
      });
      stdout = r.stdout.toString("utf8");
      stderr = r.stderr.toString("utf8");
      exitCode = r.status ?? -1;
    } else if (row.via === "cli") {
      const o: string[] = [];
      const e: string[] = [];
      exitCode = await runCli(["audit", samplePath, "--out", out], { out: (t) => o.push(t), err: (t) => e.push(t) });
      stdout = o.join("\n");
      stderr = e.join("\n");
    } else {
      const r = await runAudit({ samplePath, outDir: out, providers: allProviders() });
      exitCode = r.exitCode;
      stdout = r.messages.join("\n");
    }
  } finally {
    await server.close();
    if (savedTmpdir === undefined) delete process.env["TMPDIR"];
    else process.env["TMPDIR"] = savedTmpdir;
  }

  const newTmpEntries = [...listDir(realTmp)].filter((n) => !before.has(n) && join(realTmp, n) !== dir);
  const hits: Hit[] = [
    ...searchBuffer("stdout", Buffer.from(stdout, "utf8"), row.markers),
    ...searchBuffer("stderr", Buffer.from(stderr, "utf8"), row.markers),
    ...searchTree("run", outDir, row.markers),
    ...searchTree("tmp", ownTmp, row.markers),
    ...newTmpEntries.flatMap((n) => searchTree(`systmp/${n}`, join(realTmp, n), row.markers)),
  ];
  const images: ImageFinding[] = [
    ...imagesUnder("run", outDir),
    ...imagesUnder("tmp", ownTmp),
    ...newTmpEntries.flatMap((n) => imagesUnder(`systmp/${n}`, join(realTmp, n))),
  ];
  let runJson: unknown;
  const runFile = join(outDir, "run.json");
  if (existsSync(runFile)) {
    try {
      runJson = JSON.parse(readFileSync(runFile, "utf8"));
    } catch {
      runJson = undefined;
    }
  }
  return {
    rowId: row.id,
    variant: variant.name,
    exitCode,
    hits,
    images,
    captureCalls: takeCaptureCalls(),
    ...(runJson === undefined ? {} : { runJson }),
    dir,
    newTmpEntries,
  };
}

interface ObservationShape {
  checkId: string;
  outcome: string;
  fingerprint: string;
  evidence: { kind: string; locator?: string; snippet?: string; note?: string; redactions?: number }[];
}

/** The observations of a run file, narrowed to what the oracle reads. */
export function observationsOf(runJson: unknown): ObservationShape[] {
  const obs = (runJson as { observations?: ObservationShape[] } | undefined)?.observations;
  return Array.isArray(obs) ? obs : [];
}

/** Fingerprints of the named checks, in a stable order, for the differential pairs. */
export function fingerprintsOf(runJson: unknown, checks: readonly string[]): string[] {
  return observationsOf(runJson)
    .filter((o) => checks.includes(o.checkId) && o.outcome === "fault")
    .map((o) => `${o.checkId}\u0000${o.fingerprint}`)
    .sort();
}

type Expect = import("./fixtures/types.ts").PieceExpect;

/** The saved values of one piece of one check: only these may satisfy an expectation. */
export function pieceValues(runJson: unknown, check: string, piece: Expect["piece"]): string[] {
  const obs = observationsOf(runJson).filter((o) => o.checkId === check);
  if (piece === "fingerprint") return obs.map((o) => o.fingerprint);
  const items = obs.flatMap((o) => o.evidence);
  if (piece === "scope_examined") {
    return items.filter((e) => e.kind === "scope_examined").flatMap((e) => [e.locator, e.note, e.snippet]).filter((v): v is string => v !== undefined);
  }
  return items.filter((e) => e.kind !== "scope_examined").map((e) => e[piece]).filter((v): v is string => v !== undefined);
}

/** Does the run satisfy this expectation, in that piece of that check and nowhere else? */
export function expectMet(runJson: unknown, e: Expect): boolean {
  return pieceValues(runJson, e.check, e.piece).some((v) => (e.equals !== undefined ? v === e.equals : v.includes(e.contains ?? "\u0000")));
}
