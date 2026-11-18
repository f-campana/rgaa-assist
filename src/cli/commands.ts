/**
 * The CLI commands (spec 11.1), as a function of the arguments and an output
 * sink, so tests call it without a child process.
 *
 * Claim boundary (spec 2): no command prints a rate, a score or a verdict.
 * Every output that is more than a bare count table ends with the "what this
 * is not" sentence.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { allProviders } from "../checks/index.ts";
import { readSample, runAudit } from "../engine/index.ts";
import { loadRgaa412, RGAA_412_ID } from "../rulesets/rgaa-4.1.2/index.ts";
import { STATUSES, WHAT_THIS_IS_NOT } from "../schema/index.ts";
import type { SampleWarning } from "../schema/index.ts";
import { formatCoverage, summariseCoverage } from "./coverage-summary.ts";

export interface CliIo {
  out(text: string): void;
  err(text: string): void;
}

export const USAGE = [
  "Usage:",
  "  rgaa-assist check-sample <sample.json>",
  "  rgaa-assist audit <sample.json> --out <dir> [--fail-on failed]",
  "  rgaa-assist coverage [--ruleset rgaa-4.1.2]",
  "  rgaa-assist report <run.json>   (arrives in M4)",
  "",
  "Exit codes: 0 completed, 1 --fail-on failed met, 2 invalid input, 3 a target was not established.",
].join("\n");

export function describeWarning(w: SampleWarning): string {
  switch (w.code) {
    case "fixed_kind_missing":
      return `fixed page kind "${w.kind}" is neither in the sample nor listed in absentKinds`;
    case "service_without_page":
      return `service "${w.service}" has no page`;
    case "process_step_not_in_pages":
      return `process "${w.process}" lists step "${w.step}", which is not a page of the sample`;
    case "process_step_without_process":
      return `page "${w.page}" is a process step but no process lists it`;
    case "too_few_random_pages":
      return `${w.randomPages} random pages for ${w.otherPages} other pages; at least ${w.required} are asked for`;
  }
}

type Options = NonNullable<Parameters<typeof parseArgs>[0]>["options"];

function parse(argv: string[], options: Options, io: CliIo) {
  try {
    return parseArgs({ args: argv, options, allowPositionals: true, strict: true });
  } catch (e) {
    io.err(`rgaa-assist: ${(e as Error).message}`);
    io.err(USAGE);
    return undefined;
  }
}

function checkSampleCommand(argv: string[], io: CliIo): number {
  const parsed = parse(argv, {}, io);
  if (parsed === undefined) return 2;
  if (parsed.positionals.length !== 1) {
    io.err("rgaa-assist check-sample: expected one argument, the sample file");
    return 2;
  }
  const path = parsed.positionals[0] as string;
  const read = readSample(path);
  if (!read.ok) {
    io.err("The sample is invalid:");
    for (const m of read.messages) io.err(`  ${m}`);
    return 2;
  }
  const warnings = loadRgaa412().checkSample(read.sample);
  io.out(`Sample ${path} is valid: ${read.sample.pages.length} page(s).`);
  if (warnings.length === 0) io.out("Warnings: none.");
  else {
    io.out(`Warnings: ${warnings.length}`);
    for (const w of warnings) io.out(`  ${w.code}: ${describeWarning(w)}`);
  }
  io.out("");
  io.out(WHAT_THIS_IS_NOT);
  return 0;
}

interface RunSummaryShape {
  targets: { targetId: string; established: boolean }[];
  findings: { status: string }[];
  reduced: { criterionOnSample: { criterion: string; status: string }[] }[];
}

async function auditCommand(argv: string[], io: CliIo): Promise<number> {
  const parsed = parse(argv, { out: { type: "string" }, "fail-on": { type: "string" } }, io);
  if (parsed === undefined) return 2;
  if (parsed.positionals.length !== 1) {
    io.err("rgaa-assist audit: expected one argument, the sample file");
    return 2;
  }
  const values = parsed.values as { out?: string; "fail-on"?: string };
  const outDir = values.out;
  if (typeof outDir !== "string" || outDir.length === 0) {
    io.err("rgaa-assist audit: --out <dir> is required");
    return 2;
  }
  const failOn = values["fail-on"];
  if (failOn !== undefined && failOn !== "failed") {
    io.err(`rgaa-assist audit: --fail-on accepts only "failed", not "${String(failOn)}"`);
    return 2;
  }
  const result = await runAudit({ samplePath: parsed.positionals[0] as string, outDir, providers: allProviders() });
  if (result.exitCode === 2) {
    io.err("The input is invalid:");
    for (const m of result.messages) io.err(`  ${m}`);
    return 2;
  }
  for (const m of result.messages) io.out(m);
  if (result.runFilePath === undefined) return result.exitCode;

  const run = JSON.parse(readFileSync(result.runFilePath, "utf8")) as RunSummaryShape;
  const established = run.targets.filter((t) => t.established).length;
  const findings = new Map<string, number>(STATUSES.map((s) => [s, 0]));
  for (const f of run.findings) findings.set(f.status, (findings.get(f.status) ?? 0) + 1);
  const sample = new Map<string, number>(STATUSES.map((s) => [s, 0]));
  for (const c of run.reduced[0]?.criterionOnSample ?? []) sample.set(c.status, (sample.get(c.status) ?? 0) + 1);
  io.out("");
  io.out(`Run file: ${result.runFilePath}`);
  io.out(`Targets: ${established} established, ${run.targets.length - established} not established.`);
  io.out(`Test findings by status (all targets): ${STATUSES.map((s) => `${s} ${findings.get(s)}`).join(", ")}`);
  io.out(`Criteria on the sample by status: ${STATUSES.map((s) => `${s} ${sample.get(s)}`).join(", ")}`);
  io.out("");
  io.out(WHAT_THIS_IS_NOT);
  if (result.exitCode !== 0) return result.exitCode;
  if (failOn === "failed" && (sample.get("failed") ?? 0) > 0) return 1;
  return 0;
}

function coverageCommand(argv: string[], io: CliIo): number {
  const parsed = parse(argv, { ruleset: { type: "string" } }, io);
  if (parsed === undefined) return 2;
  if (parsed.positionals.length !== 0) {
    io.err("rgaa-assist coverage: takes no argument besides --ruleset");
    return 2;
  }
  const ruleset = (parsed.values as { ruleset?: string }).ruleset ?? RGAA_412_ID;
  if (ruleset !== RGAA_412_ID) {
    io.err(`rgaa-assist coverage: ruleset ${String(ruleset)} is not supported; supported: ${RGAA_412_ID}`);
    return 2;
  }
  io.out(formatCoverage(summariseCoverage(loadRgaa412())));
  io.out("");
  io.out(WHAT_THIS_IS_NOT);
  return 0;
}

/** Run the CLI on `argv` (without the node and script arguments). Returns the exit code. */
export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case "check-sample":
      return checkSampleCommand(rest, io);
    case "audit":
      return auditCommand(rest, io);
    case "coverage":
      return coverageCommand(rest, io);
    case "report":
      io.err("Reports arrive in M4; this command does nothing yet.");
      return 2;
    case undefined:
      io.err(USAGE);
      return 2;
    case "help":
    case "--help":
      io.out(USAGE);
      return 0;
    default:
      io.err(`rgaa-assist: unknown command "${command}"`);
      io.err(USAGE);
      return 2;
  }
}
