/**
 * `pnpm evaluate [--set working] [--out corpus/results]`: measure every case
 * of the set at its entry's candidate level and write
 * `corpus/results/<set>-<UTC date and time>.json`. Local fixtures only; no
 * network. Counts, never a rate.
 */
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { allProviders } from "../checks/index.ts";
import { launchBrowser } from "../engine/index.ts";
import { loadRgaa412 } from "../rulesets/rgaa-4.1.2/index.ts";
import { CorpusError, loadCorpus } from "./corpus.ts";
import { evaluate } from "./evaluate.ts";
import { formatReport } from "./format.ts";

const ROOT = join(import.meta.dirname, "..", "..");

/** `20261118T101500Z` */
export function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

export async function main(argv: string[]): Promise<number> {
  let values;
  try {
    values = parseArgs({ args: argv, options: { set: { type: "string" }, out: { type: "string" } }, strict: true }).values;
  } catch (e) {
    process.stderr.write(`evaluate: ${(e as Error).message}\n`);
    return 2;
  }
  const set = values.set ?? "working";
  if (set !== "working" && set !== "acceptance") {
    process.stderr.write(`evaluate: --set is working or acceptance\n`);
    return 2;
  }
  const outDir = values.out ?? join(ROOT, "corpus", "results");

  let corpus;
  try {
    corpus = loadCorpus(join(ROOT, "corpus", set), set);
  } catch (e) {
    if (e instanceof CorpusError) {
      process.stderr.write(`${e.message}\n`);
      return 2;
    }
    throw e;
  }

  const browser = await launchBrowser();
  try {
    const report = await evaluate({
      corpus,
      plugin: loadRgaa412(),
      providers: allProviders(),
      browser,
      onCase: (r, i, n) => process.stderr.write(`[${i}/${n}] ${r.case}: ${r.matched ? "match" : "mismatch"}\n`),
    });
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, `${set}-${utcStamp(new Date(report.createdAt))}.json`);
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${formatReport(report, file)}\n`);
    return 0;
  } finally {
    await browser.close();
  }
}

const script = process.argv[1];
if (script !== undefined && import.meta.url === pathToFileURL(realpathSync(script)).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      process.stderr.write(`evaluate: internal error: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
      process.exitCode = 70;
    },
  );
}
