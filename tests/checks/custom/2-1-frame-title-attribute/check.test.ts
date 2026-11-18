/**
 * `custom/2-1-frame-title-attribute`: one test per numbered step of the
 * record, plus frames, shadow trees and unread documents. Every result goes
 * through the engine (`observe`): sanitiser and `ObservationSchema`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { launchBrowser } from "../../../../src/engine/index.ts";
import { observe } from "../../../../src/engine/testing/index.ts";
import type { FixtureFiles, FixtureOptions } from "../../../../src/engine/testing/index.ts";
import { familyCProvider } from "../../../../src/checks/custom/family-c/provider.ts";
import type { Observation } from "../../../../src/schema/index.ts";

const ID = "custom/2-1-frame-title-attribute";
let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

async function check(files: FixtureFiles, options: FixtureOptions = {}): Promise<Observation> {
  const obs = await observe(familyCProvider, files, { browser, ...options });
  const o = obs.find((x) => x.checkId === ID);
  if (o === undefined) throw new Error("no observation");
  return o;
}

const page = (body: string): string => `<!doctype html><html lang="fr"><head><title>t</title></head><body>${body}</body></html>`;
const inner = page("<p>inner</p>");
const notes = (o: Observation): string => o.evidence.map((e) => e.note ?? "").join("\n");

describe(ID, () => {
  it("step (1): a titled iframe holds, so the page is no_fault", async () => {
    const o = await check({ "index.html": page(`<iframe src="f.html" title="Carte"></iframe>`), "f.html": inner });
    expect(o.outcome).toBe("no_fault");
    expect(o.evidence.some((e) => e.kind === "scope_examined")).toBe(true);
    expect(o.fingerprint).toBe(`${ID}:no_fault`);
  });

  it("step (2): an empty or blank title attribute is cannot_tell", async () => {
    const o = await check({ "index.html": page(`<iframe src="f.html" title=""></iframe><iframe src="f.html" title="  "></iframe>`), "f.html": inner });
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("Step (2)");
  });

  it("step (3): aria-hidden on the frame, on an ancestor, or on a hosting frame element is cannot_tell", async () => {
    const o = await check({
      "index.html": page(
        `<iframe src="f.html" aria-hidden="true"></iframe><div aria-hidden="TRUE"><iframe src="f.html"></iframe></div>` +
          `<iframe src="host.html" title="hôte" aria-hidden="true"></iframe>`,
      ),
      "host.html": page(`<iframe src="f.html"></iframe>`),
      "f.html": inner,
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o).match(/Step \(3\)/g)?.length).toBe(3);
  });

  it("step (4): an untitled frame not rendered (display none, visibility hidden, inside a hidden frame) is cannot_tell", async () => {
    const o = await check({
      "index.html": page(
        `<iframe src="f.html" style="display:none"></iframe><div style="display:none"><iframe src="f.html"></iframe></div>` +
          `<iframe src="f.html" style="visibility:hidden"></iframe><iframe src="host.html" title="hôte" style="display:none"></iframe>`,
      ),
      "host.html": page(`<iframe src="f.html"></iframe>`),
      "f.html": inner,
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o).match(/Step \(4\)/g)?.length).toBe(4);
  });

  it("step (4): an untitled frame that is inert, or not exposed for another reason, is cannot_tell", async () => {
    const o = await check({
      "index.html": page(`<div inert><iframe src="f.html"></iframe></div><div id="h"><iframe src="f.html"></iframe></div>
        <script>document.getElementById('h').attachShadow({mode:'open'}).innerHTML = '<p>no slot</p>';</script>`),
      "f.html": inner,
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("inert");
    expect(notes(o)).toContain("Step (4): no title attribute, and not rendered");
  });

  it("step (5): an untitled, rendered, exposed iframe is a fault, with a locator and a snippet", async () => {
    const o = await check({ "index.html": page(`<main><iframe src="f.html" class="map"></iframe></main>`), "f.html": inner });
    expect(o.outcome).toBe("fault");
    const e = o.evidence.find((x) => x.kind === "dom_node");
    expect(e?.locator).toBe("html > body > main > iframe");
    expect(e?.snippet).toContain("<iframe");
    expect(o.fingerprint).toMatch(/^custom\/2-1-frame-title-attribute:iframe\[src=http:\/\/127\.0\.0\.1:\d+\/f\.html\]\.map$/);
  });

  it("step (5): aria-label, aria-labelledby and role do not replace the title attribute", async () => {
    const o = await check({
      "index.html": page(`<p id="l">Carte</p><iframe src="f.html" aria-label="Carte" aria-labelledby="l" role="region"></iframe>`),
      "f.html": inner,
    });
    expect(o.outcome).toBe("fault");
  });

  it("step (5): a frame element of a frameset document is examined", async () => {
    const o = await check({
      "index.html": `<!doctype html><html><head><title>t</title></head><frameset cols="50%,50%"><frame src="f.html" title="a"><frame src="f.html"></frameset></html>`,
      "f.html": inner,
    });
    expect(o.outcome).toBe("fault");
    expect(o.evidence.filter((e) => e.kind === "dom_node")).toHaveLength(1);
    expect(o.evidence[0]?.snippet).toContain("<frame");
  });

  it("page result: a fault wins over frames the check abstains on", async () => {
    const o = await check({ "index.html": page(`<iframe src="f.html" title=""></iframe><iframe src="f.html"></iframe>`), "f.html": inner });
    expect(o.outcome).toBe("fault");
    expect(o.evidence.filter((e) => e.kind === "dom_node")).toHaveLength(1);
  });

  it("page result: no frame element at all is inapplicable, with the scope examined", async () => {
    const o = await check({ "index.html": page(`<p>Rien</p><object data="x.svg" type="image/svg+xml"></object>`), "x.svg": `<svg xmlns="http://www.w3.org/2000/svg"/>` });
    expect(o.outcome).toBe("inapplicable");
    expect(o.evidence[0]?.kind).toBe("scope_examined");
    expect(o.evidence[0]?.note).toContain("No frame element(s)");
  });

  it("a cross-site frame is read: an untitled iframe inside it is a fault, located through its host", async () => {
    const o = await check({
      "index.html": page(`<iframe id="booking" src="__CROSS_ORIGIN__/booking.html" title="Réservation"></iframe>`),
      "booking.html": page(`<iframe src="cal.html"></iframe>`),
      "cal.html": inner,
    });
    expect(o.outcome).toBe("fault");
    expect(o.evidence[0]?.locator).toBe("iframe#booking >>> html > body > iframe");
  });

  it("aria-hidden on a cross-site hosting frame element reaches the frames inside it (step 3)", async () => {
    const o = await check({
      "index.html": page(`<iframe src="__CROSS_ORIGIN__/booking.html" title="Réservation" aria-hidden="true"></iframe>`),
      "booking.html": page(`<iframe src="cal.html"></iframe>`),
      "cal.html": inner,
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("Step (3)");
  });

  it("an iframe inserted by a script after load is examined", async () => {
    const o = await check({
      "index.html": page(`<script>addEventListener('load', () => { const f = document.createElement('iframe'); f.src = '__CROSS_ORIGIN__/chat.html'; document.body.append(f); });</script>`),
      "chat.html": inner,
    });
    expect(o.outcome).toBe("fault");
  });

  it("frames in an open shadow tree and in a closed one are examined", async () => {
    const open = await check({
      "index.html": page(`<div id="h"></div><script>document.getElementById('h').attachShadow({mode:'open'}).innerHTML = '<iframe src="f.html"></iframe>';</script>`),
      "f.html": inner,
    });
    expect(open.outcome).toBe("fault");
    expect(open.evidence[0]?.locator).toBe("div#h >> iframe");
    const closed = await check({
      "index.html": page(`<x-w id="h"></x-w><script>document.getElementById('h').attachShadow({mode:'closed'}).innerHTML = '<iframe src="f.html" title="ok"></iframe><iframe src="f.html"></iframe>';</script>`),
      "f.html": inner,
    });
    expect(closed.outcome).toBe("fault");
    expect(closed.evidence[0]?.locator).toBe("x-w#h >> iframe:nth-of-type(2)");
  });

  it("an unread nested document makes the page cannot_tell, before no_fault and inapplicable", async () => {
    const o = await check(
      {
        "index.html": page(`<iframe src="__CROSS_ORIGIN__/busy.html" title="Occupé"></iframe>`),
        "busy.html": page(`<script>addEventListener('load', () => setTimeout(() => { for (;;) {} }, 50));</script>`),
      },
      { timeouts: { frameProbe: 500 } },
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("Not read");
  });

  it("a definite fault wins over an unread nested document, which is listed as a limit", async () => {
    const o = await check(
      {
        "index.html": page(`<iframe src="__CROSS_ORIGIN__/busy.html" title="Occupé"></iframe><iframe src="f.html"></iframe>`),
        "busy.html": page(`<script>addEventListener('load', () => setTimeout(() => { for (;;) {} }, 50));</script>`),
        "f.html": inner,
      },
      { timeouts: { frameProbe: 500 } },
    );
    expect(o.outcome).toBe("fault");
    expect(notes(o)).toContain("Not read");
  });

  it("leaves nothing behind in the page", async () => {
    const { withTarget } = await import("../../../../src/engine/testing/index.ts");
    await withTarget(
      { "index.html": page(`<x-w id="h"></x-w><iframe src="f.html"></iframe><script>document.getElementById('h').attachShadow({mode:'closed'}).innerHTML = '<a href="#"></a>';</script>`), "f.html": inner },
      async (ctx) => {
        await familyCProvider.run(ctx);
        for (const f of ctx.frames) {
          const left = await f.frame.evaluate(() => Object.getOwnPropertySymbols(globalThis).map((s) => s.description ?? ""));
          expect(left.filter((d) => d.startsWith("rgaa-assist"))).toEqual([]);
        }
      },
      { browser },
    );
  });
});
