#!/usr/bin/env node
/**
 * rgaa-assist command line (spec 11.1). Run as `node src/cli/main.ts <command>`.
 * Exit codes: 0 completed, 1 `--fail-on failed` met, 2 invalid input,
 * 3 one or more targets not established.
 */
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { runCli } from "./commands.ts";

const script = process.argv[1];
const isMain = script !== undefined && import.meta.url === pathToFileURL(realpathSync(script)).href;
if (isMain) {
  runCli(process.argv.slice(2), {
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      process.stderr.write(`rgaa-assist: internal error: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
      process.exitCode = 70;
    },
  );
}

export { runCli } from "./commands.ts";
