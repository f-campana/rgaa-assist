import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import { AXE_RULE_IDS, CHECK_VERSION, DEFAULT_OPTIONS, axeProvider } from "../../../src/checks/axe/index.ts";
import type { CheckResult, CheckRunResult } from "../../../src/checks/types.ts";
import { contextFor, get, html, serve, toObservation } from "./helpers.ts";
import type { Site } from "./helpers.ts";

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const FAST = { frameProbeTimeoutMs: 600 };

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

/** A fresh context per test, with a page loaded from `site` (or from `setContent`). */
async function open(site: Site | string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  if (typeof site === "string") {
    await page.setContent(site);
  } else {
    await serve(context, site);
    await page.goto("https://main.test/");
  }
  return { context, page };
}

async function run(site: Site | string, options: Record<string, unknown> = FAST): Promise<ReadonlyMap<string, CheckRunResult>> {
  const { context, page } = await open(site);
  try {
    return await axeProvider.run(contextFor(page, options));
  } finally {
    await context.close();
  }
}

function asResult(r: CheckRunResult): CheckResult {
  if (r.outcome === "error") throw new Error(`check error: ${r.message}`);
  return r;
}

describe("declared checks", () => {
  it("declares one check per rule of axe-rules.json, 67 in all, each with the same recorded options", () => {
    expect(AXE_RULE_IDS).toHaveLength(67);
    expect(axeProvider.checks.map((c) => c.id)).toEqual(AXE_RULE_IDS.map((r) => `axe/${r}`));
    for (const c of axeProvider.checks) {
      expect(c.version).toBe(CHECK_VERSION);
      expect(c.defaultOptions).toBe(DEFAULT_OPTIONS);
    }
    expect(CHECK_VERSION).toBe("axe-core@4.14.0+adapter.1");
    expect(DEFAULT_OPTIONS["rules"]).toEqual(AXE_RULE_IDS);
  });
});

describe("one simple page", () => {
  it("reports every one of the 67 rules, none as an error, and every result is a valid observation", async () => {
    const results = await run(
      html('<main><h1>Title</h1><p>Some text.</p><img src="' + PIXEL + '" alt="A pixel"><a href="/x">A link</a></main>'),
    );
    expect(results.size).toBe(67);
    for (const rule of AXE_RULE_IDS) {
      const r = get(results, rule);
      expect(r.outcome, `${rule}: ${r.outcome === "error" ? r.message : ""}`).not.toBe("error");
      toObservation(axeProvider, `axe/${rule}`, r);
    }
  });
});

describe("outcomes", () => {
  it("a fault carries the node as evidence: locator, snippet and the failure summary", async () => {
    const results = await run(html(`<main><img src="${PIXEL}"></main>`));
    const r = asResult(get(results, "image-alt"));
    expect(r.outcome).toBe("fault");
    const ev = r.evidence.find((e) => e.kind === "dom_node");
    expect(ev?.locator).toBe("img");
    expect(ev?.snippet).toContain("<img");
    expect(ev?.note).toBeTruthy();
    expect(r.fingerprint).toMatch(/^axe\/image-alt:[0-9a-f]{16}$/);
    toObservation(axeProvider, "axe/image-alt", r);
  });

  it("the same fault on another page gives the same fingerprint; another fault gives another", async () => {
    const one = asResult(get(await run(html(`<main><p>One</p><img src="${PIXEL}"></main>`)), "image-alt"));
    const two = asResult(get(await run(html(`<main><h1>Two</h1><img src="${PIXEL}"></main>`)), "image-alt"));
    const other = asResult(get(await run(html(`<main><img src="${PIXEL}" width="3"></main>`)), "image-alt"));
    expect(one.fingerprint).toBe(two.fingerprint);
    expect(other.fingerprint).not.toBe(one.fingerprint);
  });

  it("no_fault carries scope_examined evidence: how many nodes and a capped list of locators", async () => {
    const imgs = Array.from({ length: 6 }, (_, i) => `<img src="${PIXEL}" alt="Pixel ${i}" id="i${i}">`).join("");
    const results = await run(html(`<main>${imgs}</main>`), { ...FAST, passLocatorCap: 4 });
    const r = asResult(get(results, "image-alt"));
    expect(r.outcome).toBe("no_fault");
    expect(r.fingerprint).toBe("axe/image-alt:no_fault");
    const scope = r.evidence.filter((e) => e.kind === "scope_examined");
    expect(scope).toHaveLength(1);
    expect(scope[0]?.note).toContain("6 element(s) examined");
    expect(scope[0]?.note).toContain("cap 4");
    expect(JSON.parse(scope[0]?.locator ?? "[]")).toEqual(["#i0", "#i1", "#i2", "#i3"]);
    toObservation(axeProvider, "axe/image-alt", r);
  });

  it("inapplicable carries scope_examined evidence naming what was searched", async () => {
    const results = await run(html("<main><p>No image here.</p></main>"));
    const r = asResult(get(results, "image-alt"));
    expect(r.outcome).toBe("inapplicable");
    expect(r.fingerprint).toBe("axe/image-alt:inapplicable");
    expect(r.evidence).toHaveLength(1);
    expect(r.evidence[0]?.kind).toBe("scope_examined");
    expect(r.evidence[0]?.note).toContain("no matching element");
    expect(r.evidence[0]?.note).toContain("0 frame(s)");
    toObservation(axeProvider, "axe/image-alt", r);
  });

  it("cannot_tell comes from an incomplete result, with the node as evidence", async () => {
    // Text over a background image: axe cannot compute the contrast.
    const body =
      '<main><div style="background-image: linear-gradient(#fff, #000); width: 200px; height: 80px"><p style="color: #777">Text over a gradient</p></div></main>';
    const r = asResult(get(await run(html(body)), "color-contrast"));
    expect(r.outcome).toBe("cannot_tell");
    expect(r.fingerprint).toBe("axe/color-contrast:cannot_tell");
    expect(r.evidence.some((e) => e.kind === "dom_node" && e.snippet?.includes("Text over a gradient"))).toBe(true);
    toObservation(axeProvider, "axe/color-contrast", r);
  });

  it("a rule axe disables by default still runs, and says something other than 'not reported'", async () => {
    const row = (n: number) => `<tr>${[1, 2, 3, 4].map((c) => `<td>r${n}c${c}</td>`).join("")}</tr>`;
    const table = `<table>${[1, 2, 3, 4].map(row).join("")}</table>`;
    const results = await run(html(`<main>${table}</main>`));
    for (const rule of ["css-orientation-lock", "focus-order-semantics", "p-as-heading", "table-fake-caption", "td-has-header"]) {
      expect(get(results, rule).outcome, rule).not.toBe("error");
    }
    const r = asResult(get(results, "td-has-header"));
    expect(r.outcome).toBe("fault");
    expect(r.evidence.some((e) => e.kind === "dom_node")).toBe(true);
  });
});

describe("frames", () => {
  const outer = (frame: string, own = `<img src="${PIXEL}" alt="Fine">`) => html(`<main>${own}${frame}</main>`);

  it("finds a fault inside a cross-site frame and writes a locator with the frame hop", async () => {
    const site: Site = {
      "https://main.test/": { body: outer('<iframe title="Other" src="https://other.test/"></iframe>') },
      "https://other.test/": { body: html(`<main><img src="${PIXEL}"></main>`) },
    };
    const r = asResult(get(await run(site), "image-alt"));
    expect(r.outcome).toBe("fault");
    const ev = r.evidence.find((e) => e.kind === "dom_node");
    expect(ev?.locator).toBe('iframe >>> img');
    expect(r.evidence.some((e) => e.note?.startsWith("Frame not analysed"))).toBe(false);
    // The main document's image is fine, the frame's is not: another check of the page is unaffected.
    expect(asResult(get(await run(site), "document-title")).outcome).toBe("no_fault");
  });

  it("a frame axe cannot test turns no_fault into cannot_tell, with the frame named", async () => {
    // Scripts are blocked in a sandboxed frame without allow-scripts: no timer fires, axe never answers.
    const site: Site = {
      "https://main.test/": { body: outer('<iframe title="Sandboxed" sandbox src="https://main.test/inner"></iframe>') },
      "https://main.test/inner": { body: html("<main><p>Inner</p></main>") },
    };
    const results = await run(site);
    const r = asResult(get(results, "image-alt"));
    expect(r.outcome).toBe("cannot_tell");
    const gap = r.evidence.filter((e) => e.note?.startsWith("Frame not analysed"));
    expect(gap.length).toBeGreaterThan(0);
    expect(gap.some((e) => e.note?.includes("https://main.test/inner"))).toBe(true);
    expect(gap.some((e) => e.locator === "iframe" && e.snippet?.includes("sandbox"))).toBe(true);
    // An inapplicable rule is not decided either.
    expect(asResult(get(results, "area-alt")).outcome).toBe("cannot_tell");
    for (const rule of AXE_RULE_IDS) toObservation(axeProvider, `axe/${rule}`, get(results, rule));
  });

  it("a fault in the main document stays a fault when a frame could not be tested", async () => {
    const site: Site = {
      "https://main.test/": { body: outer('<iframe title="Sandboxed" sandbox src="https://main.test/inner"></iframe>', `<img src="${PIXEL}">`) },
      "https://main.test/inner": { body: html("<main><p>Inner</p></main>") },
    };
    const r = asResult(get(await run(site), "image-alt"));
    expect(r.outcome).toBe("fault");
    expect(r.evidence.some((e) => e.kind === "dom_node" && e.locator === "img")).toBe(true);
    expect(r.evidence.some((e) => e.note?.startsWith("Frame not analysed"))).toBe(true);
  });

  it("a document sent with a sandbox policy header is also taken for a frame axe cannot test", async () => {
    const site: Site = {
      "https://main.test/": { body: outer('<iframe title="Policy" src="https://main.test/inner"></iframe>') },
      "https://main.test/inner": { body: html("<main><p>Inner</p></main>"), headers: { "content-security-policy": "sandbox" } },
    };
    const r = asResult(get(await run(site), "image-alt"));
    expect(r.outcome).toBe("cannot_tell");
  });

  it("frames are put back as they were: the page answers scripts in every frame after the run", async () => {
    const site: Site = {
      "https://main.test/": { body: outer('<iframe title="Sandboxed" sandbox src="https://main.test/inner"></iframe>') },
      "https://main.test/inner": { body: html("<p>Inner</p>") },
    };
    const { context, page } = await open(site);
    try {
      await axeProvider.run(contextFor(page, FAST));
      for (const frame of page.frames()) expect(await frame.evaluate("1 + 1")).toBe(2);
    } finally {
      await context.close();
    }
  });
});

describe("failures", () => {
  it("returns check_error for every declared check when axe cannot run", async () => {
    const { context, page } = await open(html("<main><p>x</p></main>"));
    try {
      const ctx = contextFor(page, FAST);
      await page.close();
      const results = await axeProvider.run(ctx);
      expect(results.size).toBe(67);
      for (const r of results.values()) {
        expect(r.outcome).toBe("error");
        if (r.outcome === "error") {
          expect(r.kind).toBe("check_error");
          expect(r.message).toContain("axe-core run failed");
        }
      }
      for (const rule of AXE_RULE_IDS) toObservation(axeProvider, `axe/${rule}`, get(results, rule));
    } finally {
      await context.close();
    }
  });

  it("returns check_error for every check when the provider's signal is already aborted", async () => {
    const { context, page } = await open(html("<main><p>x</p></main>"));
    try {
      const abort = new AbortController();
      abort.abort();
      const results = await axeProvider.run(contextFor(page, FAST, abort.signal));
      for (const r of results.values()) expect(r.outcome).toBe("error");
    } finally {
      await context.close();
    }
  });
});
