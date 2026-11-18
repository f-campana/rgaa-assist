import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_VIEWPORT, parseSample, readSample, targetsOf } from "../../src/engine/sample.ts";

const base = () => ({
  project: { name: "Fixture", ruleset: "rgaa-4.1.2" },
  pages: [{ id: "home", url: "https://example.test/", kinds: ["home"] }],
});

function refused(sample: unknown): string[] {
  const r = parseSample(JSON.stringify(sample));
  if (r.ok) throw new Error("expected a refusal");
  return r.messages;
}

describe("reading the sample", () => {
  it("accepts a minimal sample and hashes the file's bytes", () => {
    const text = JSON.stringify(base(), null, 2);
    const r = parseSample(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sha256).toBe(createHash("sha256").update(text).digest("hex"));
    expect(targetsOf(r.sample)).toEqual([
      { targetId: "home/initial", pageId: "home", url: "https://example.test/", viewport: DEFAULT_VIEWPORT },
    ]);
  });

  it("uses the sample's viewport when given", () => {
    const r = parseSample(JSON.stringify({ ...base(), viewport: { width: 375, height: 812 } }));
    expect(r.ok && targetsOf(r.sample)[0]?.viewport).toEqual({ width: 375, height: 812 });
  });

  it("reads from disk, and refuses a file that cannot be read", () => {
    const dir = mkdtempSync(join(tmpdir(), "rgaa-sample-"));
    const p = join(dir, "sample.json");
    writeFileSync(p, JSON.stringify(base()));
    expect(readSample(p).ok).toBe(true);
    const missing = readSample(join(dir, "nope.json"));
    expect(missing.ok).toBe(false);
  });

  it("refuses invalid JSON and an empty sample", () => {
    expect(parseSample("{").ok).toBe(false);
    expect(refused({ ...base(), pages: [] }).join("\n")).toMatch(/pages/);
  });

  it("refuses a session, supported from M3", () => {
    expect(refused({ ...base(), session: {} })).toEqual(["sample: session: saved sessions are supported from M3"]);
  });

  it("refuses an authenticated page, states and expect, naming the field", () => {
    const messages = refused({
      ...base(),
      session: { storageState: "./state.json" },
      pages: [
        {
          id: "account",
          url: "https://example.test/account",
          kinds: ["service"],
          authenticated: true,
          expect: { url: "https://example.test/account" },
          states: [{ id: "menu", steps: [{ click: "role=button" }], expect: { visible: "role=dialog" } }],
        },
      ],
    });
    expect(messages).toContain("sample: pages.0.authenticated (account): authenticated pages are supported from M3");
    expect(messages).toContain("sample: pages.0.states (account): states are supported from M3");
    expect(messages).toContain("sample: pages.0.expect (account): expect is supported from M3");
    expect(messages.every((m) => /supported from M3/.test(m))).toBe(true);
  });

  it("refuses model use and an unknown ruleset", () => {
    expect(refused({ ...base(), model: { enabled: true, provider: "p", model: "m" } })).toEqual([
      "sample: model.enabled: model use is supported from M6",
    ]);
    expect(refused({ ...base(), project: { name: "x", ruleset: "wcag-2.2" } })[0]).toMatch(/project\.ruleset/);
  });
});
