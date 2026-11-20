/**
 * End to end: the words inside an editable box on an audited page reach no
 * observation (spec 8.7). Codex's fixture, from its independent M2 review: a
 * public page with a textbox role and contenteditable holding visitor words.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { familyCProvider } from "../../src/checks/custom/family-c/provider.ts";
import { launchBrowser } from "../../src/engine/index.ts";
import { observe } from "../../src/engine/testing/index.ts";
import { MASK } from "../../src/engine/sanitise.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

const WORDS = "private visitor words";
const PAGE = (body: string): string => `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Accueil</title></head><body>${body}</body></html>`;

describe("editable boxes in saved evidence", () => {
  it("Codex's fixture: the words appear in no observation, and the redaction is counted", async () => {
    const obs = await observe(
      familyCProvider,
      { "index.html": PAGE(`<div role="textbox" contenteditable="true">${WORDS}</div>`) },
      { browser },
    );
    const fault = obs.find((o) => o.checkId === "custom/11-1-field-label-mechanism" && o.outcome === "fault");
    expect(fault, "the 11.1.1 fault the fixture gave in the review").toBeDefined();
    expect(JSON.stringify(obs)).not.toContain(WORDS);
    expect(JSON.stringify(obs)).not.toContain("visitor");
    const snippets = (fault?.evidence ?? []).flatMap((e) => (e.snippet === undefined ? [] : [e.snippet]));
    expect(snippets.some((x) => x.includes(`role="textbox"`) && x.includes(MASK))).toBe(true);
    const counted = obs.flatMap((o) => o.evidence).reduce((n, e) => n + (e.redactions ?? 0), 0);
    expect(counted).toBeGreaterThanOrEqual(1);
    expect((fault?.evidence ?? []).some((e) => (e.redactions ?? 0) >= 1 && e.snippet?.includes(MASK))).toBe(true);
  });
});
