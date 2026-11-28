/**
 * Validation of the CDP assumptions the engine guard rests on (M3 privacy
 * design 3.3), on synthetic pages. If one is refuted, the guard must fail
 * closed for the class it covers. Markers are `zz`-prefixed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Frame } from "playwright";
import type { CheckContext } from "../../src/checks/types.ts";
import { launchBrowser } from "../../src/engine/index.ts";
import { readFrameIdentity, startDomEventLog } from "../../src/engine/editable-context.ts";
import { withTarget } from "../../src/engine/testing/index.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

const page = (body: string): string => `<!doctype html><html lang="fr"><title>Fixture</title><body>${body}</body></html>`;
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 100));

/** Start the log, check nothing is logged yet, run `change`, and say whether `frameOf(ctx)` is now marked. */
async function logs(files: Record<string, string>, change: (ctx: CheckContext) => Promise<void>, frameOf: (ctx: CheckContext) => Frame | undefined = (c) => c.frames[0]?.frame): Promise<{ before: boolean; after: boolean }> {
  return withTarget(
    files,
    async (ctx) => {
      const frame = frameOf(ctx);
      if (frame === undefined) throw new Error("no frame");
      const log = await startDomEventLog(ctx);
      try {
        await settle();
        const before = log.changed(frame);
        await change(ctx);
        await settle();
        return { before, after: log.changed(frame) };
      } finally {
        await log.stop();
      }
    },
    { browser },
  );
}

const one = (body: string): Record<string, string> => ({ "index.html": page(body) });

describe("CDP assumption: each class of change produces an event in the log", () => {
  it("a DOM mutation (node inserted)", async () => {
    expect(await logs(one(`<div id="w"></div>`), (ctx) => ctx.page.evaluate(`document.getElementById("w").appendChild(document.createElement("p"))`).then(() => undefined))).toEqual({ before: false, after: true });
  });

  it("an attribute change", async () => {
    expect(await logs(one(`<p id="p" class="zza">zz</p>`), (ctx) => ctx.page.evaluate(`document.getElementById("p").setAttribute("class", "zzb")`).then(() => undefined))).toEqual({ before: false, after: true });
  });

  it("a character-data change", async () => {
    expect(await logs(one(`<p id="p">zzold</p>`), (ctx) => ctx.page.evaluate(`document.getElementById("p").firstChild.data = "zznew"`).then(() => undefined))).toEqual({ before: false, after: true });
  });

  it("a shadow-root attach (closed)", async () => {
    expect(await logs(one(`<div id="h"></div>`), (ctx) => ctx.page.evaluate(`document.getElementById("h").attachShadow({ mode: "closed" })`).then(() => undefined))).toEqual({ before: false, after: true });
  });

  it("a frame navigation", async () => {
    const files = { "index.html": page(`<iframe src="f.html"></iframe>`), "f.html": page("<p>zzf</p>"), "g.html": page("<p>zzg</p>") };
    const r = await logs(
      files,
      async (ctx) => {
        const f = ctx.frames[1]?.frame;
        if (f === undefined) throw new Error("no child frame");
        await f.goto(f.url().replace("f.html", "g.html"));
      },
      (c) => c.frames[1]?.frame,
    );
    expect(r).toEqual({ before: false, after: true });
  });
});

describe("CDP assumption: a pierced whole-document read", () => {
  type N = { nodeType: number; nodeName: string; nodeValue?: string; children?: N[]; shadowRoots?: (N & { shadowRootType?: string })[] };
  async function tree(body: string): Promise<N> {
    return withTarget(
      one(body),
      async (ctx) => {
        const s = await ctx.page.context().newCDPSession(ctx.page);
        try {
          return ((await s.send("DOM.getDocument", { depth: -1, pierce: true })) as { root: N }).root;
        } finally {
          await s.detach();
        }
      },
      { browser },
    );
  }
  const all = (n: N): N[] => [n, ...(n.children ?? []).flatMap(all), ...(n.shadowRoots ?? []).flatMap(all)];

  it("includes closed shadow roots", async () => {
    const root = await tree(`<div id="h"></div><script>document.getElementById("h").attachShadow({ mode: "closed" }).innerHTML = "<b>zzclosed</b>";</script>`);
    const closed = all(root).flatMap((n) => n.shadowRoots ?? []).filter((s) => s.shadowRootType === "closed");
    expect(closed).toHaveLength(1);
    expect(all(closed[0] as N).some((n) => n.nodeType === 3 && n.nodeValue === "zzclosed")).toBe(true);
  });

  it("leaves out whitespace-only text nodes (the closed-root paths count non-whitespace text only)", async () => {
    const root = await tree(`<div id="w">  <span>zza</span>\n  zzb  <span>zzc</span>   </div>`);
    const w = all(root).find((n) => n.nodeName === "DIV");
    const texts = (w?.children ?? []).filter((c) => c.nodeType === 3).map((c) => c.nodeValue);
    expect(texts).toEqual(["\n  zzb  "]);
  });
});

describe("CDP assumption: Page.getFrameTree loaderId", () => {
  it("gives a new loaderId, same frameId, after a navigation", async () => {
    const files = { "index.html": page(`<iframe src="f.html"></iframe>`), "f.html": page("<p>zzf</p>"), "g.html": page("<p>zzg</p>") };
    const [a, b] = await withTarget(
      files,
      async (ctx) => {
        const f = ctx.frames[1]?.frame;
        if (f === undefined) throw new Error("no child frame");
        const first = await readFrameIdentity(f);
        await f.goto(f.url().replace("f.html", "g.html"));
        return [first, await readFrameIdentity(f)];
      },
      { browser },
    );
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b?.frameId).toBe(a?.frameId);
    expect(b?.loaderId).not.toBe(a?.loaderId);
  });
});

describe("CDP assumption: sessions", () => {
  it("a same-process frame shares the page's log session; an out-of-process frame has its own", async () => {
    const files = {
      "index.html": page(`<iframe src="f.html"></iframe><iframe src="__CROSS_ORIGIN__/f.html"></iframe>`),
      "f.html": page(`<p id="p">zz</p>`),
    };
    const r = await withTarget(
      files,
      async (ctx) => {
        const main = ctx.frames[0]?.frame;
        const same = ctx.frames.find((f) => f.parent !== null && !f.crossOrigin)?.frame;
        const cross = ctx.frames.find((f) => f.crossOrigin)?.frame;
        if (main === undefined || same === undefined || cross === undefined) throw new Error("frames missing");
        const log = await startDomEventLog(ctx);
        try {
          await settle();
          const clean = [log.changed(main), log.changed(same), log.changed(cross)];
          await same.evaluate(`document.getElementById("p").setAttribute("class", "zzs")`);
          await settle();
          const afterSame = [log.changed(main), log.changed(same), log.changed(cross)];
          return { clean, afterSame };
        } finally {
          await log.stop();
        }
      },
      { browser },
    );
    expect(r.clean).toEqual([false, false, false]);
    // A change in the same-process frame marks the page's session, so the main frame too (conservative); the out-of-process frame is apart.
    expect(r.afterSame).toEqual([true, true, false]);
  });
});
