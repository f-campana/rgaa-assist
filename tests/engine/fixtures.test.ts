import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import type { CheckProvider, CheckRunResult } from "../../src/checks/types.ts";
import { launchBrowser } from "../../src/engine/browser.ts";
import { examineFixture, fixturePage, observe, serveFixture, withTarget } from "../../src/engine/testing/index.ts";
import { ObservationSchema, TargetExecutionSchema } from "../../src/schema/index.ts";
import type { CheckId } from "../../src/schema/index.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("serveFixture", () => {
  it("serves the same files on two origins with their content types, replacing the placeholder in text files only", async () => {
    const server = await serveFixture({
      "index.html": "<a href='__CROSS_ORIGIN__/x'>x</a>",
      "page.xhtml": "<html xmlns='http://www.w3.org/1999/xhtml'><body>__CROSS_ORIGIN__</body></html>",
      "s/style.css": "a { background: url(__CROSS_ORIGIN__/i.png) }",
      "s/app.js": "const o = '__CROSS_ORIGIN__';",
      "i.svg": "<svg xmlns='http://www.w3.org/2000/svg'><a href='__CROSS_ORIGIN__/'/></svg>",
      "i.png": PNG,
      "raw.bin": "__CROSS_ORIGIN__",
    });
    try {
      expect(server.mainOrigin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(server.crossOrigin).toMatch(/^http:\/\/localhost:\d+$/);
      const get = async (path: string, origin: "main" | "cross" = "main") => {
        const r = await fetch(server.url(path, origin).replace("localhost", "127.0.0.1"));
        return { status: r.status, type: r.headers.get("content-type"), body: new Uint8Array(await r.arrayBuffer()) };
      };
      const text = (b: Uint8Array) => Buffer.from(b).toString("utf8");
      const home = await get("index.html");
      expect(home.type).toBe("text/html; charset=utf-8");
      expect(text(home.body)).toBe(`<a href='${server.crossOrigin}/x'>x</a>`);
      expect((await get("page.xhtml")).type).toBe("application/xhtml+xml; charset=utf-8");
      expect(text((await get("page.xhtml")).body)).toContain(server.crossOrigin);
      expect((await get("s/style.css")).type).toBe("text/css; charset=utf-8");
      expect(text((await get("s/app.js")).body)).toBe(`const o = '${server.crossOrigin}';`);
      expect((await get("s/app.js")).type).toBe("text/javascript; charset=utf-8");
      expect((await get("i.svg")).type).toBe("image/svg+xml");
      expect(text((await get("i.svg")).body)).toContain(server.crossOrigin);
      const png = await get("i.png", "cross");
      expect(png.type).toBe("image/png");
      expect([...png.body]).toEqual([...PNG]);
      expect(text((await get("raw.bin")).body)).toBe("__CROSS_ORIGIN__");
      expect((await get("missing.html")).status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("refuses paths that leave the file set", async () => {
    await expect(serveFixture({ "../x.html": "x" })).rejects.toThrow(/must not contain/);
  });
});

describe("withTarget and observe", () => {
  const files = {
    "index.html": `<!doctype html><html lang="fr"><title>Accueil</title>
      <img alt="" src="https://example.invalid/tracker.png">
      <iframe title="Tiers" src="__CROSS_ORIGIN__/frame.html"></iframe>`,
    "frame.html": `<!doctype html><title>Cadre</title><p>cadre</p>`,
  };

  it("gives a check context on the served page, with frames from both origins, and refuses foreign requests", async () => {
    const seen = await withTarget(
      files,
      async (ctx, info) => {
        expect(ctx.targetId).toBe("fixture/initial");
        expect(ctx.signal.aborted).toBe(false);
        expect(await ctx.page.title()).toBe("Accueil");
        expect(ctx.frames.map((f) => f.crossOrigin)).toEqual([false, true]);
        const cross = ctx.frames[1];
        if (cross === undefined) throw new Error("no frame");
        expect(await ctx.cdpFor(cross.frame)).not.toBe(await ctx.cdpFor(ctx.page.mainFrame()));
        expect(TargetExecutionSchema.safeParse(info.execution).success).toBe(true);
        expect(info.server.requests).toContain(`${info.server.crossOrigin}/frame.html`);
        return info.blockedRequests;
      },
      { browser },
    );
    expect(seen).toEqual(["https://example.invalid/tracker.png"]);
  });

  it("observe runs one provider as the engine does and returns validated observations", async () => {
    const titleProvider: CheckProvider = {
      name: "custom/title",
      checks: [{ id: "custom/title-probe", version: "0.1.0", defaultOptions: { max: 3 } }],
      async run(ctx) {
        const title = await ctx.page.title();
        return new Map<CheckId, CheckRunResult>([
          [
            "custom/title-probe",
            title.length > 0
              ? { outcome: "no_fault", evidence: [{ kind: "scope_examined", note: `1 title element examined: ${title}` }], fingerprint: "custom/title-probe:no_fault" }
              : { outcome: "fault", evidence: [{ kind: "dom_node", locator: "title", snippet: "<title></title>" }], fingerprint: "custom/title-probe:empty" },
          ],
        ]);
      },
    };
    const obs = await observe(titleProvider, files, { browser, checkOptions: { "custom/title-probe": { max: 7 } } });
    expect(obs).toHaveLength(1);
    expect(ObservationSchema.safeParse(obs[0]).success).toBe(true);
    expect(obs[0]).toMatchObject({ id: "fixture/initial:custom/title-probe", outcome: "no_fault", options: { max: 7 } });

    const empty = await examineFixture([titleProvider], { "index.html": "<!doctype html><title></title>" }, { browser, targetId: "empty/initial" });
    expect(empty.execution.targetId).toBe("empty/initial");
    expect(empty.observations[0]?.outcome).toBe("fault");
    expect(empty.checkOptions).toEqual({ "custom/title-probe": { max: 3 } });
  });

  it("serves a corpus case folder and loads files[0] of its case.json", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rgaa-case-"));
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "case.json"), JSON.stringify({ files: ["sub/page.xhtml", "sub/style.css"] }));
    writeFileSync(
      join(dir, "sub", "page.xhtml"),
      `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="fr"><head><title>XHTML</title><link rel="stylesheet" href="style.css"/></head><body><p>x</p></body></html>`,
    );
    writeFileSync(join(dir, "sub", "style.css"), "p { color: rgb(1, 2, 3) }");
    expect(fixturePage(dir)).toBe("sub/page.xhtml");
    expect(fixturePage({ "index.html": "" })).toBe("index.html");
    const result = await withTarget(
      dir,
      async (ctx) => ({
        title: await ctx.page.title(),
        contentType: await ctx.page.evaluate("document.contentType"),
        color: await ctx.page.evaluate("getComputedStyle(document.querySelector('p')).color"),
      }),
      { browser },
    );
    expect(result).toEqual({ title: "XHTML", contentType: "application/xhtml+xml", color: "rgb(1, 2, 3)" });
  });

  it("throws when the fixture page is not established", async () => {
    await expect(withTarget({ "index.html": "x" }, async () => undefined, { browser, page: "nope.html" })).rejects.toThrow(
      /not established: the main response has status 404/,
    );
  });
});
