/**
 * `custom/6-2-link-content-name`: one test per numbered step of the record,
 * plus hidden content, frames, shadow trees, XHTML and unread documents.
 * Every result goes through the engine (`observe`).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { launchBrowser } from "../../../../src/engine/index.ts";
import { observe } from "../../../../src/engine/testing/index.ts";
import type { FixtureFiles, FixtureOptions } from "../../../../src/engine/testing/index.ts";
import { familyCProvider } from "../../../../src/checks/custom/family-c/provider.ts";
import type { Observation } from "../../../../src/schema/index.ts";

const ID = "custom/6-2-link-content-name";
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

const page = (body: string, head = ""): string => `<!doctype html><html lang="fr"><head><title>t</title>${head}</head><body>${body}</body></html>`;
const one = (body: string, head = ""): Promise<Observation> => check({ "index.html": page(body, head), "i.png": "" });
const notes = (o: Observation): string => o.evidence.map((e) => e.note ?? "").join("\n");
const SVG = 'xmlns="http://www.w3.org/2000/svg"';

describe(ID, () => {
  describe("step (1): a name from content holds", () => {
    it("text, an image alternative, an inline svg title, an SVG link's title and text", async () => {
      const o = await one(
        `<a href="/a">Accueil</a>` +
          `<a href="/b"><img src="i.png" alt="Contact"></a>` +
          `<a href="/c"><span role="img" aria-label="Panier"></span></a>` +
          `<a href="/d"><svg ${SVG} width="10" height="10"><title>Recherche</title></svg></a>` +
          `<a href="/e"><img src="i.png" aria-labelledby="lbl"></a><span id="lbl" hidden>Plan</span>` +
          `<svg ${SVG} width="50" height="20"><a href="/f"><title>Aide</title><rect width="5" height="5"/></a><a href="/g"><text y="10">FAQ</text></a></svg>`,
      );
      expect(o.outcome).toBe("no_fault");
      expect(o.evidence[0]?.note).toContain("7 link(s)");
    });

    it("text inside a shadow tree of the link's content counts", async () => {
      const o = await one(
        `<a href="/a"><x-label id="h"></x-label></a><script>document.getElementById('h').attachShadow({mode:'closed'}).innerHTML = '<span>Nom</span>';</script>`,
      );
      expect(o.outcome).toBe("no_fault");
    });

    it("RECORD: a visible descendant of a visibility:hidden element still gives text", async () => {
      const o = await one(`<a href="/a"><span style="visibility:hidden"><span style="visibility:visible">Nom</span></span></a>`);
      expect(o.outcome).toBe("no_fault");
    });
  });

  describe("step (2): hidden or unexposed links are cannot_tell", () => {
    it("not rendered, aria-hidden on an ancestor, inert, or absent from the accessibility tree", async () => {
      const o = await one(
        `<a href="/a" style="display:none"></a><div aria-hidden="true"><a href="/b"></a></div><div inert><a href="/c"></a></div>` +
          `<div id="h"><a href="/d"></a></div><script>document.getElementById('h').attachShadow({mode:'open'}).innerHTML = '<p>no slot</p>';</script>`,
      );
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o).match(/Step \(2\)/g)?.length).toBe(4);
    });
  });

  describe("step (3): content the computation does not cover is cannot_tell", () => {
    it("object, canvas, a form control or a button", async () => {
      const o = await one(`<a href="/a"><canvas width="5" height="5"></canvas></a><a href="/b"><button>Go</button></a><a href="/c"><object data="i.png" type="image/png"></object></a>`);
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o).match(/Step \(3\)/g)?.length).toBe(3);
    });

    it("CSS generated content, and text made only of Private Use Area characters", async () => {
      const o = await one(`<a href="/a" class="ico"></a><a href="/b"><i></i></a>`, `<style>.ico::before { content: "\\e900"; }</style>`);
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o)).toContain("generated content");
      expect(notes(o)).toContain("Private Use Area");
    });

    it("an image whose alternative could not be computed", async () => {
      const o = await one(`<a href="/a"><img src="i.png" aria-labelledby="x"></a><span id="x"><img src="i.png" alt="Logo"></span>`);
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o)).toContain("could not be computed");
    });
  });

  it("step (4): a name only from aria-label, title, aria-labelledby or xlink:title is cannot_tell", async () => {
    const o = await one(
      `<a href="/a" aria-label="Facebook"></a><a href="/b" title="X"></a><a href="/c" aria-labelledby="n"></a><span id="n">LinkedIn</span>` +
        `<svg ${SVG} xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10"><a xlink:href="/d" xlink:title="Plan"><rect width="5" height="5"/></a></svg>`,
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o).match(/Step \(4\)/g)?.length).toBe(4);
  });

  it("step (5): role=link on an element that is not an <a href> is cannot_tell", async () => {
    const o = await one(`<span role="link" tabindex="0" onclick="location.href='/x'"></span>`);
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("Step (5)");
  });

  describe("step (6): a link with no name at all is a fault", () => {
    it("an empty <a href>", async () => {
      const o = await one(`<p><a href="/a" class="social">  </a></p>`);
      expect(o.outcome).toBe("fault");
      expect(o.evidence[0]?.locator).toBe("html > body > p > a");
      expect(o.fingerprint).toBe(`${ID}:a.social`);
    });

    it("its only text is hidden (aria-hidden, display none, hidden attribute), or its image has alt=\"\"", async () => {
      const o = await one(
        `<a href="/a"><span aria-hidden="true">x</span></a><a href="/b"><span style="display:none">x</span></a><a href="/c"><span hidden>x</span></a><a href="/d"><img src="i.png" alt=""></a>`,
      );
      expect(o.outcome).toBe("fault");
      expect(o.evidence.filter((e) => e.kind === "dom_node")).toHaveLength(4);
    });

    it("an SVG link with no title and no text", async () => {
      const o = await one(`<svg ${SVG} width="10" height="10"><a href="/a"><rect width="5" height="5"/></a></svg>`);
      expect(o.outcome).toBe("fault");
    });
  });

  it("page result: a fault wins over links the check abstains on", async () => {
    const o = await one(`<a href="/a" aria-label="X"></a><a href="/b"></a><a href="/c">Texte</a>`);
    expect(o.outcome).toBe("fault");
    expect(o.evidence.filter((e) => e.kind === "dom_node")).toHaveLength(1);
  });

  it("an <a> without href is an anchor, skipped: a page holding only anchors is inapplicable", async () => {
    const o = await one(`<a id="top"></a><a name="x">Haut</a>`);
    expect(o.outcome).toBe("inapplicable");
    expect(o.evidence[0]?.kind).toBe("scope_examined");
  });

  it("a cross-site frame is read: an empty link inside it is a fault", async () => {
    const o = await check({
      "index.html": page(`<a href="/a">Accueil</a><iframe id="w" title="Widget" src="__CROSS_ORIGIN__/w.html"></iframe>`),
      "w.html": page(`<a href="/x"><img src="i.png" alt=""></a>`),
      "i.png": "",
    });
    expect(o.outcome).toBe("fault");
    expect(o.evidence[0]?.locator).toBe("iframe#w >>> html > body > a");
  });

  it("a link inserted by a script after load, and one inside a closed shadow tree, are examined", async () => {
    const o = await one(
      `<x-nav id="n"></x-nav><script>addEventListener('load', () => { const a = document.createElement('a'); a.href = '/x'; a.className = 'late'; document.body.append(a); });
        document.getElementById('n').attachShadow({mode:'closed'}).innerHTML = '<a href="/y" class="inner"></a>';</script>`,
    );
    expect(o.outcome).toBe("fault");
    const locs = o.evidence.filter((e) => e.kind === "dom_node").map((e) => e.locator);
    expect(locs).toEqual(expect.arrayContaining(["html > body > a", "x-nav#n >> a"]));
  });

  it("XHTML: an SVG link with xlink:href is a link; empty, it is a fault", async () => {
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr"><head><title>t</title></head><body>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="20">
<a xlink:href="/a"><text y="10">Aide</text></a><a xlink:href="/b"><rect width="5" height="5"/></a></svg>
<A href="/c"></A></body></html>`;
    const o = await check({ "index.xhtml": xhtml }, { page: "index.xhtml" });
    expect(o.outcome).toBe("fault");
    // <A> in XHTML is not an HTML a element; only the empty SVG link is faulted.
    expect(o.evidence.filter((e) => e.kind === "dom_node")).toHaveLength(1);
    expect(o.evidence[0]?.snippet).toContain("xlink:href=");
  });

  it("an unread nested document makes the page cannot_tell; a definite fault still wins", async () => {
    const busy = page(`<script>addEventListener('load', () => setTimeout(() => { for (;;) {} }, 50));</script>`);
    const ct = await check(
      { "index.html": page(`<a href="/a">Accueil</a><iframe title="b" src="__CROSS_ORIGIN__/busy.html"></iframe>`), "busy.html": busy },
      { timeouts: { frameProbe: 500 } },
    );
    expect(ct.outcome).toBe("cannot_tell");
    const fault = await check(
      { "index.html": page(`<a href="/a"></a><iframe title="b" src="__CROSS_ORIGIN__/busy.html"></iframe>`), "busy.html": busy },
      { timeouts: { frameProbe: 500 } },
    );
    expect(fault.outcome).toBe("fault");
    expect(notes(fault)).toContain("Not read");
  });
});
