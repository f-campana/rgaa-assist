/**
 * Reading the sample file (spec 7, 7.1) for M2.
 *
 * M2 examines one page in its initial state, without a saved session and
 * without a model. It refuses, as invalid input, what it does not support
 * yet, naming the field: `session`, `pages[].authenticated: true`,
 * `pages[].states`, `pages[].expect` (all "supported from M3") and
 * `model.enabled: true` ("supported from M6"). The ruleset must be one the
 * engine can load (`rgaa-4.1.2`).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { zodIssueText } from "./error-class.ts";
import { INITIAL_STATE_ID, SampleFileSchema } from "../schema/index.ts";
import type { SampleFile, Size } from "../schema/index.ts";

/** Viewport used when the sample gives none. The schema has no default value, so the engine fixes it here. */
export const DEFAULT_VIEWPORT: Size = { width: 1280, height: 800 };

/** The rulesets M2 can run. */
export const SUPPORTED_RULESETS = ["rgaa-4.1.2"] as const;

export type SampleReadResult =
  | { ok: true; sample: SampleFile; sha256: string }
  | { ok: false; messages: string[] };

/** Parse, validate and check the M2 limits of a sample given as bytes. */
export function parseSample(bytes: Buffer | string): SampleReadResult {
  const buffer = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes;
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  let json: unknown;
  try {
    json = JSON.parse(buffer.toString("utf8")) as unknown;
  } catch {
    return { ok: false, messages: ["sample: not valid JSON"] };
  }
  const parsed = SampleFileSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      messages: parsed.error.issues.map((i) => `sample: ${zodIssueText(i)}`),
    };
  }
  const sample = parsed.data;
  const messages: string[] = [];
  if (!(SUPPORTED_RULESETS as readonly string[]).includes(sample.project.ruleset)) {
    messages.push(`sample: project.ruleset: ${sample.project.ruleset} is not supported; supported: ${SUPPORTED_RULESETS.join(", ")}`);
  }
  if (sample.session !== undefined) {
    messages.push("sample: session: saved sessions are supported from M3");
  }
  if (sample.model.enabled) {
    messages.push("sample: model.enabled: model use is supported from M6");
  }
  sample.pages.forEach((page, i) => {
    if (page.authenticated) messages.push(`sample: pages.${i}.authenticated (${page.id}): authenticated pages are supported from M3`);
    if (page.states.length > 0) messages.push(`sample: pages.${i}.states (${page.id}): states are supported from M3`);
    if (page.expect !== undefined) messages.push(`sample: pages.${i}.expect (${page.id}): expect is supported from M3`);
  });
  if (messages.length > 0) return { ok: false, messages };
  return { ok: true, sample, sha256 };
}

/** Read a sample file from disk. A file that cannot be read is invalid input. */
export function readSample(path: string): SampleReadResult {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (e) {
    return { ok: false, messages: [`sample: cannot read ${path}: ${(e as NodeJS.ErrnoException).code ?? "read error"}`] };
  }
  return parseSample(bytes);
}

/** One target to establish: in M2, `<pageId>/initial` for every page. */
export interface TargetSpec {
  targetId: string;
  pageId: string;
  url: string;
  viewport: Size;
}

/** The targets of a sample, in page order. */
export function targetsOf(sample: SampleFile): TargetSpec[] {
  return sample.pages.map((page) => ({
    targetId: `${page.id}/${INITIAL_STATE_ID}`,
    pageId: page.id,
    url: page.url,
    viewport: sample.viewport ?? DEFAULT_VIEWPORT,
  }));
}
