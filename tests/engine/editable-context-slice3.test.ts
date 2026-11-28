/**
 * The engine guard, third slice: the axe identity condition with its DOM
 * event log, and FrameKey frameId/loaderId stability (M3 privacy design 3.3).
 * Markers are `zz`-prefixed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import type { CheckContext, Derivation } from "../../src/checks/types.ts";
import { launchBrowser } from "../../src/engine/index.ts";
import { derivePiece, readFrameIdentity, startDomEventLog } from "../../src/engine/editable-context.ts";
import type { Piece } from "../../src/engine/editable-context.ts";
import { createSanitiser, MASK } from "../../src/engine/sanitise.ts";
import { withTarget } from "../../src/engine/testing/index.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

const sanitiser = createSanitiser();
const page = (body: string): string => `<!doctype html><html lang="fr"><title>Fixture</title><body>${body}</body></html>`;
const axe = (target: unknown[]): Derivation => ({ source: { node: { axeTarget: target } }, kind: "snippet", shape: "outer" });

/** Start the log, run `during` (page changes in the run window), then derive the axe target. */
async function axeRun(body: string, target: unknown[], during: (ctx: CheckContext) => Promise<void> = async () => undefined): Promise<Piece> {
  return withTarget(
    { "index.html": page(body) },
    async (ctx) => {
      const log = await startDomEventLog(ctx);
      try {
        await during(ctx);
        return await derivePiece(axe(target), ctx, sanitiser, { domLog: log });
      } finally {
        await log.stop();
      }
    },
    { browser },
  );
}

describe("axe identity condition (conditional, never proven)", () => {
  it("accepts a target in a stable document", async () => {
    const p = await axeRun(`<p class="zzc">zzstable</p>`, [".zzc"]);
    expect(p).toEqual({ value: `<p class="zzc">zzstable</p>`, redactions: 0, withheld: false });
  });

  it("withholds when a class is toggled away and back (event logged)", async () => {
    const p = await axeRun(`<p class="zzc">zztoggle</p>`, [".zzc"], async (ctx) => {
      await ctx.page.evaluate(`(() => { const p = document.querySelector(".zzc"); p.classList.remove("zzc"); p.classList.add("zzc"); })()`);
    });
    expect(p).toMatchObject({ value: MASK, redactions: 1, withheld: true, reason: "axe-document-changed" });
  });

  it("withholds a target that matches two elements", async () => {
    const p = await axeRun(`<p class="zzc">zz1</p><p class="zzc">zz2</p>`, [".zzc"]);
    expect(p).toMatchObject({ value: MASK, redactions: 1, reason: "axe-not-unique" });
  });

  it("withholds a node replaced with identical markup", async () => {
    const p = await axeRun(`<div id="w"><p class="zzc">zzsame</p></div>`, [".zzc"], async (ctx) => {
      await ctx.page.evaluate(`(() => { const w = document.getElementById("w"); w.innerHTML = w.innerHTML; })()`);
    });
    expect(p).toMatchObject({ value: MASK, redactions: 1, reason: "axe-document-changed" });
  });

  it("withholds without a log, and walks frames by frameElement identity", async () => {
    const files = { "index.html": page(`<iframe id="f" src="f.html"></iframe>`), "f.html": page(`<p class="zzc">zzframed</p>`) };
    const [noLog, framed] = await withTarget(
      files,
      async (ctx) => {
        const a = await derivePiece(axe(["#f", ".zzc"]), ctx, sanitiser);
        const log = await startDomEventLog(ctx);
        try {
          return [a, await derivePiece(axe(["#f", ".zzc"]), ctx, sanitiser, { domLog: log })];
        } finally {
          await log.stop();
        }
      },
      { browser },
    );
    expect(noLog).toMatchObject({ value: MASK, reason: "axe-identity-unavailable" });
    expect(framed).toEqual({ value: `<p class="zzc">zzframed</p>`, redactions: 0, withheld: false });
  });
});

describe("FrameKey frameId and loaderId stability", () => {
  const files = { "index.html": page(`<iframe src="f.html"></iframe>`), "f.html": page(`<p id="p">zzfirst</p>`), "g.html": page(`<p id="p">zzsecond</p>`) };

  it("withholds when the frame is re-navigated between the reads", async () => {
    const [stable, renavigated] = await withTarget(
      files,
      async (ctx) => {
        const frame = ctx.frames[1]?.frame;
        if (frame === undefined) throw new Error("no child frame");
        const d = async (): Promise<Derivation> => {
          const handle = await frame.$("#p");
          if (handle === null) throw new Error("no #p");
          return { source: { node: { frame: { frame }, handle } }, kind: "snippet", shape: "outer" };
        };
        const a = await derivePiece(await d(), ctx, sanitiser);
        const b = await derivePiece(await d(), ctx, sanitiser, {
          probe: {
            record: () => undefined,
            betweenReads: async () => {
              await frame.goto(frame.url().replace("f.html", "g.html"));
            },
          },
        });
        return [a, b];
      },
      { browser },
    );
    expect(stable).toEqual({ value: `<p id="p">zzfirst</p>`, redactions: 0, withheld: false });
    expect(renavigated).toMatchObject({ value: MASK, redactions: 1, withheld: true, reason: "frame-identity-changed" });
  });

  it("withholds when the key's loaderId differs from the frame's current one", async () => {
    const [current, stale] = await withTarget(
      files,
      async (ctx) => {
        const frame = ctx.frames[1]?.frame;
        if (frame === undefined) throw new Error("no child frame");
        const id = await readFrameIdentity(frame);
        if (id === null) throw new Error("no identity");
        const handle = await frame.$("#p");
        if (handle === null) throw new Error("no #p");
        const piece = (loaderId: string): Promise<Piece> =>
          derivePiece({ source: { node: { frame: { frame, frameId: id.frameId, loaderId }, handle } }, kind: "snippet", shape: "outer" }, ctx, sanitiser);
        return [await piece(id.loaderId), await piece("zz-old-loader")];
      },
      { browser },
    );
    expect(current.withheld).toBe(false);
    expect(stale).toMatchObject({ value: MASK, reason: "frame-identity-changed" });
  });
});
