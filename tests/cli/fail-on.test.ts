/**
 * `--fail-on failed` exits 1 when a criterion on the sample is failed. With
 * every entry at `enabled: none` no real run can fail one, so the engine is
 * replaced here by a stub that writes a run file with one failed criterion.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const state = { status: "failed" };
vi.mock("../../src/engine/index.ts", () => ({
  readSample: () => ({ ok: false, messages: [] }),
  runAudit: async (input: { outDir: string }) => {
    mkdirSync(input.outDir, { recursive: true });
    const path = join(input.outDir, "run.json");
    writeFileSync(
      path,
      JSON.stringify({
        targets: [{ targetId: "home/initial", established: true }],
        findings: [{ status: state.status }],
        reduced: [{ criterionOnSample: [{ criterion: "1.1", status: state.status }] }],
      }),
    );
    return { exitCode: 0, runFilePath: path, messages: [] };
  },
}));

const { runCli } = await import("../../src/cli/commands.ts");

async function audit(...extra: string[]): Promise<number> {
  const dir = mkdtempSync(join(tmpdir(), "rgaa-failon-"));
  return runCli(["audit", "sample.json", "--out", join(dir, "o"), ...extra], { out: () => undefined, err: () => undefined });
}

describe("audit --fail-on failed", () => {
  it("exits 1 when a criterion on the sample is failed", async () => {
    state.status = "failed";
    expect(await audit("--fail-on", "failed")).toBe(1);
  });
  it("is off by default", async () => {
    state.status = "failed";
    expect(await audit()).toBe(0);
  });
  it("exits 0 when nothing is failed", async () => {
    state.status = "needs_review";
    expect(await audit("--fail-on", "failed")).toBe(0);
  });
});
