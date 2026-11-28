import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { DEFAULT_TIMEOUTS, launchBrowser } from "../../src/engine/browser.ts";
import { DEFAULT_VIEWPORT } from "../../src/engine/sample.ts";
import { MASK, createSanitiser } from "../../src/engine/sanitise.ts";
import { establishTarget } from "../../src/engine/target.ts";
import type { TargetHandle } from "../../src/engine/target.ts";
import { refusedPort, serveFixture } from "../../src/engine/testing/server.ts";
import type { FixtureFiles, FixtureServer } from "../../src/engine/testing/server.ts";
import { TargetExecutionSchema } from "../../src/schema/index.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

const sanitiser = createSanitiser(["page"]);
const timeouts = { ...DEFAULT_TIMEOUTS, navigation: 10_000, settle: 1_000, frameProbe: 1_000 };

async function establish(files: FixtureFiles, path = "index.html", opts: { viewport?: { width: number; height: number }; frameProbe?: number } = {}) {
  const server = await serveFixture(files);
  const handle = await establishTarget(
    browser,
    { targetId: "home/initial", pageId: "home", url: server.url(path), viewport: opts.viewport ?? DEFAULT_VIEWPORT },
    { timeouts: { ...timeouts, ...(opts.frameProbe === undefined ? {} : { frameProbe: opts.frameProbe }) }, sanitiser },
  );
  return { server, handle };
}

async function cleanup(server: FixtureServer, handle: TargetHandle): Promise<void> {
  await handle.close();
  await server.close();
}

describe("establishing a target", () => {
  it("establishes a page that loads with status 200, in a fresh context with the engine's settings", async () => {
    const { server, handle } = await establish(
      { "index.html": "<!doctype html><html lang=fr><title>Accueil</title><p>Bonjour</p>" },
      "index.html?page=1&q=jean#haut",
      { viewport: { width: 375, height: 812 } },
    );
    try {
      const t = handle.execution;
      expect(TargetExecutionSchema.safeParse(t).success).toBe(true);
      expect(t.established).toBe(true);
      expect(t.requestedUrl).toBe(`${server.mainOrigin}/index.html?page=1&q=${MASK}#${MASK}`);
      expect(t.effectiveUrl).toBe(t.requestedUrl);
      expect(t.viewport).toEqual({ requested: { width: 375, height: 812 }, applied: { width: 375, height: 812 } });
      expect(t).toMatchObject({ sessionLoaded: false, prerequisitesMet: [], steps: [], expect: { declared: false, metBeforeSteps: null, met: null } });
      const page = handle.examinable?.page;
      expect(page).toBeDefined();
      const env = await page?.evaluate(`({
        lang: navigator.language,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      })`);
      expect(env).toEqual({ lang: "fr-FR", tz: "Europe/Paris", reduced: true });
      expect(await handle.examinable?.context.cookies()).toEqual([]);
    } finally {
      await cleanup(server, handle);
    }
  });

  it("does not establish a page whose main response is 404, and gives no examinable target", async () => {
    const { server, handle } = await establish({ "index.html": "<p>x</p>" }, "missing.html");
    try {
      expect(handle.execution.established).toBe(false);
      expect(handle.examinable).toBeUndefined();
      expect(handle.notEstablishedReason).toBe("the main response has status 404");
      expect(TargetExecutionSchema.safeParse(handle.execution).success).toBe(true);
    } finally {
      await cleanup(server, handle);
    }
  });

  it("does not establish a page whose connection is refused", async () => {
    const port = await refusedPort();
    const handle = await establishTarget(
      browser,
      { targetId: "gone/initial", pageId: "gone", url: `http://127.0.0.1:${port}/?token=planted`, viewport: DEFAULT_VIEWPORT },
      { timeouts, sanitiser },
    );
    try {
      expect(handle.execution.established).toBe(false);
      expect(handle.execution.requestedUrl).toBe(`http://127.0.0.1:${port}/?token=${MASK}`);
      expect(handle.notEstablishedReason).toBe("navigation failed: the connection was refused");
      expect(handle.notEstablishedReason).not.toMatch(/planted/);
      expect(TargetExecutionSchema.safeParse(handle.execution).success).toBe(true);
    } finally {
      await handle.close();
    }
  });
});

describe("frames and CDP sessions", () => {
  const files: FixtureFiles = {
    "index.html": `<!doctype html><html lang="fr"><title>Cadres</title>
      <iframe id="a" title="A" src="a.html"></iframe>
      <div id="slot"></div>
      <iframe id="cross" title="Tiers" src="__CROSS_ORIGIN__/cross.html"></iframe>
      <iframe id="doc" title="Doc" srcdoc="<p>srcdoc</p>"></iframe>
      <script>
        const f = document.createElement("iframe");
        f.title = "Late"; f.src = "late.html";
        document.getElementById("slot").append(f);
      </script>`,
    "a.html": `<!doctype html><title>A</title><iframe title="A1" src="a1.html"></iframe>`,
    "a1.html": `<!doctype html><title>A1</title><p>a1</p>`,
    "late.html": `<!doctype html><title>Late</title><p>late</p>`,
    "cross.html": `<!doctype html><html lang="fr"><title>Tiers</title><button>Contenu tiers</button>`,
  };

  it("lists every frame, main first, then document order depth first, with origin and readability", async () => {
    const { server, handle } = await establish(files);
    try {
      const frames = handle.examinable?.frames ?? [];
      const names = await Promise.all(frames.map((f) => f.frame.evaluate("document.title || document.body.textContent")));
      expect(names).toEqual(["Cadres", "A", "A1", "Late", "Tiers", "srcdoc"]);
      expect(frames.map((f) => f.crossOrigin)).toEqual([false, false, false, false, true, false]);
      expect(frames.every((f) => f.readable)).toBe(true);
      expect(frames[0]?.parent).toBeNull();
      expect(frames[2]?.parent).toBe(frames[1]);
      expect(frames[4]?.parent).toBe(frames[0]);
      expect(frames[4]?.frame.url().startsWith(server.crossOrigin)).toBe(true);
    } finally {
      await cleanup(server, handle);
    }
  });

  it("gives a cross-origin frame its own CDP session and same-process frames the page's", async () => {
    const { server, handle } = await establish(files);
    try {
      const target = handle.examinable;
      if (target === undefined) throw new Error("not established");
      const [main, a, a1, late, cross, doc] = target.frames;
      const mainSession = await target.cdpFor(main!.frame);
      expect(await target.cdpFor(a!.frame)).toBe(mainSession);
      expect(await target.cdpFor(a1!.frame)).toBe(mainSession);
      expect(await target.cdpFor(late!.frame)).toBe(mainSession);
      expect(await target.cdpFor(doc!.frame)).toBe(mainSession);
      const crossSession = await target.cdpFor(cross!.frame);
      expect(crossSession).not.toBe(mainSession);
      expect(await target.cdpFor(cross!.frame)).toBe(crossSession); // cached

      const names = (tree: { nodes: { name?: { value?: unknown } }[] }) => tree.nodes.map((n) => n.name?.value).filter((v) => typeof v === "string");
      const crossTree = await crossSession.send("Accessibility.getFullAXTree");
      expect(names(crossTree)).toContain("Contenu tiers");
      const mainTree = await mainSession.send("Accessibility.getFullAXTree");
      expect(names(mainTree)).not.toContain("Contenu tiers");
    } finally {
      await cleanup(server, handle);
    }
  });

  it("marks a frame that does not answer within the probe timeout as unreadable, with the reason", async () => {
    const { server, handle } = await establish(
      {
        "index.html": `<!doctype html><title>P</title><iframe title="Busy" src="__CROSS_ORIGIN__/busy.html"></iframe>`,
        "busy.html": `<!doctype html><title>Busy</title><script>addEventListener("load", () => setTimeout(() => { for (;;) {} }, 50));</script>`,
      },
      "index.html",
      { frameProbe: 500 },
    );
    try {
      const frames = handle.examinable?.frames ?? [];
      expect(frames).toHaveLength(2);
      expect(frames[0]?.readable).toBe(true);
      expect(frames[1]?.readable).toBe(false);
      expect(frames[1]?.unreadableReason).toMatch(/did not finish within 500 ms/);
      expect(frames[1]?.crossOrigin).toBe(true);
    } finally {
      await cleanup(server, handle);
    }
  });
});
