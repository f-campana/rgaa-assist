/**
 * `custom/11-8-optgroup-label-attribute`: one test per numbered step of the
 * record, plus hidden and invisible lists, frames, shadow trees, XHTML and
 * unread documents. Every result goes through the engine (`observe`).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { launchBrowser } from "../../../../src/engine/index.ts";
import { observe } from "../../../../src/engine/testing/index.ts";
import type { FixtureFiles, FixtureOptions } from "../../../../src/engine/testing/index.ts";
import { familyCProvider } from "../../../../src/checks/custom/family-c/provider.ts";
import type { Observation } from "../../../../src/schema/index.ts";

const ID = "custom/11-8-optgroup-label-attribute";
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
const one = (body: string): Promise<Observation> => check({ "index.html": page(body) });
const notes = (o: Observation): string => o.evidence.map((e) => e.note ?? "").join("\n");
const sel = (attrs: string, groups: string): string => `<select aria-label="Choix" ${attrs}>${groups}</select>`;
const G = `<optgroup label="Fruits"><option>Pomme</option></optgroup>`;
const NOLABEL = `<optgroup><option>Poire</option></optgroup>`;

describe(ID, () => {
  describe("step (1): a list outside any form is cannot_tell", () => {
    it("no form ancestor and no form owner", async () => {
      const o = await one(sel("", NOLABEL));
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o)).toContain("Step (1)");
    });

    it("a role=form ancestor (first token, ignoring ASCII case) or a form attribute puts it in a form", async () => {
      const o = await one(`<div role="FORM region" aria-label="f">${sel("", NOLABEL)}</div><form id="f1"></form>${sel('form="f1"', NOLABEL)}`);
      expect(o.outcome).toBe("fault");
      expect(o.evidence.filter((e) => e.kind === "dom_node")).toHaveLength(2);
    });
  });

  describe("step (2): a list not rendered, not exposed or not visible is cannot_tell", () => {
    it("display none, aria-hidden, inert, inside a frame that is not rendered", async () => {
      const o = await check({
        "index.html": page(
          `<form>${sel('style="display:none"', NOLABEL)}<div aria-hidden="true">${sel("", NOLABEL)}</div><div inert>${sel("", NOLABEL)}</div></form>` +
            `<iframe title="f" src="f.html" style="display:none"></iframe>`,
        ),
        "f.html": page(`<form>${sel("", NOLABEL)}</form>`),
      });
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o).match(/Step \(2\)/g)?.length).toBe(4);
    });

    it("opacity 0, off the page, under 4 pixels, clipped by an ancestor or by clip (a list replaced by a scripted widget)", async () => {
      const o = await one(
        `<form><div style="opacity:0">${sel("", NOLABEL)}</div>${sel('style="position:absolute;left:-9999px"', NOLABEL)}` +
          `${sel('style="width:3px;height:3px;padding:0;border:0"', NOLABEL)}<div style="overflow:hidden;height:0">${sel("", NOLABEL)}</div>` +
          `${sel('style="position:absolute;clip:rect(0,0,0,0)"', NOLABEL)}<div style="position:relative;overflow:hidden;width:2px;height:2px"><div style="position:absolute">${sel("", NOLABEL)}</div></div></form>`,
      );
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o).match(/Step \(2\)/g)?.length).toBe(6);
    });

    it("an absolutely positioned list escapes a static ancestor's overflow, so it is decided", async () => {
      const o = await one(`<form><div style="overflow:hidden;height:0">${sel('style="position:absolute;top:10px;left:10px"', NOLABEL)}</div></form>`);
      expect(o.outcome).toBe("fault");
    });
  });

  describe("step (2): a clip-path other than inset() makes visibility unknown, so cannot_tell (Q57)", () => {
    const UNKNOWN = "is not known: a clip-path";

    // Codex's fixtures (full pass of 2026-11-21): the list is fully clipped, so no fault.
    for (const clip of ["circle(0px)", "polygon(0 0,0 0,0 0)"]) {
      it(`${clip} on an ancestor`, async () => {
        const o = await one(`<form><div style="clip-path:${clip}"><select><optgroup><option>Choice</option></optgroup></select></div></form>`);
        expect(o.outcome).toBe("cannot_tell");
        expect(notes(o)).toContain(UNKNOWN);
      });

      it(`${clip} on the select itself`, async () => {
        const o = await one(`<form><select style="clip-path:${clip}"><optgroup><option>Choice</option></optgroup></select></form>`);
        expect(o.outcome).toBe("cannot_tell");
        expect(notes(o)).toContain(UNKNOWN);
      });
    }

    it("never no_fault either: a labelled optgroup under an unmeasured clip-path is cannot_tell", async () => {
      const o = await one(`<form><div style="clip-path:circle(50%)">${sel("", G)}</div></form>`);
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o)).toContain(UNKNOWN);
    });

    it("every other unmeasured value: ellipse, path, url, a box keyword alone or with a shape, an inset() not parsed", async () => {
      const values = ["ellipse(0px 0px)", 'path("M0 0")', "url(#none)", "border-box", "circle(50%) margin-box", "inset(0px) content-box", "inset(calc(1% + 1px))"];
      const o = await one(`<form>${values.map((c) => `<div style='clip-path:${c}'>${sel("", NOLABEL)}</div>`).join("")}</form>`);
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o).split(UNKNOWN).length - 1).toBe(values.length);
    });

    it("rect() and xywh() compute to inset() in Chromium, so they are measured", async () => {
      const o = await one(`<form><div style="clip-path:rect(0px 0px 0px 0px)">${sel("", NOLABEL)}</div><div style="clip-path:xywh(0 0 0 0)">${sel("", NOLABEL)}</div></form>`);
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o).match(/no part at least 4 pixels square/g)?.length).toBe(2);
      expect(notes(o)).not.toContain(UNKNOWN);
    });

    it("on an ancestor outside the containing-block chain of an absolutely positioned list", async () => {
      const o = await one(`<form><div style="clip-path:circle(0px)">${sel('style="position:absolute;top:10px;left:10px"', NOLABEL)}</div></form>`);
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o)).toContain(UNKNOWN);
    });

    it("on the frame element hosting the list's document", async () => {
      const o = await check({
        "index.html": page(`<div style="clip-path:polygon(0 0,0 0,0 0)"><iframe title="f" src="f.html"></iframe></div>`),
        "f.html": page(`<form>${sel("", NOLABEL)}</form>`),
      });
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o)).toContain(UNKNOWN);
    });

    it("an area already under 4 pixels square stays 'not visible', whatever the clip-path", async () => {
      const o = await one(`<form><div style="overflow:hidden;height:0;clip-path:circle(0px)">${sel("", NOLABEL)}</div></form>`);
      expect(o.outcome).toBe("cannot_tell");
      expect(notes(o)).toContain("no part at least 4 pixels square");
      expect(notes(o)).not.toContain(UNKNOWN);
    });

    it("an inset() with a round part is unmeasured: cannot_tell, never a fault or no_fault (Q60, Codex's fixture)", async () => {
      const box = (lab: string) =>
        `<form><div style="position:relative;width:200px;height:200px;clip-path:inset(0 round 100px)"><select style="position:absolute;left:0;top:0;width:10px;height:10px;padding:0;border:0">${lab}</select></div></form>`;
      const bad = await one(box("<optgroup><option>A</option></optgroup>"));
      expect(bad.outcome).toBe("cannot_tell");
      expect(notes(bad)).toContain(UNKNOWN);
      const good = await one(box('<optgroup label="G"><option>A</option></optgroup>'));
      expect(good.outcome).toBe("cannot_tell");
    });

    it("control: inset() is still measured, so a fully inset list is not visible and a slightly inset one is decided", async () => {
      const hidden = await one(`<form><div style="clip-path:inset(50%)">${sel("", NOLABEL)}</div>${sel('style="clip-path:inset(0 100% 0 0)"', NOLABEL)}</form>`);
      expect(hidden.outcome).toBe("cannot_tell");
      expect(notes(hidden).match(/no part at least 4 pixels square/g)?.length).toBe(2);
      expect(notes(hidden)).not.toContain(UNKNOWN);
      const shown = await one(
        `<form><div style="clip-path:inset(1px)">${sel("", NOLABEL)}</div>${sel('style="clip-path:inset(0)"', NOLABEL)}<div style="clip-path:inset(10% 5%)">${sel("", NOLABEL)}</div></form>`,
      );
      expect(shown.outcome).toBe("fault");
      expect(shown.evidence.filter((e) => e.kind === "dom_node")).toHaveLength(3);
    });

    it("clip-path none is no clipping", async () => {
      const o = await one(`<form><div style="clip-path:none">${sel("", NOLABEL)}</div></form>`);
      expect(o.outcome).toBe("fault");
    });
  });

  describe("step (2): visibility needs positive evidence, so hiding the check does not measure gives cannot_tell (Q59)", () => {
    const UNKNOWN = "is visible is not known";
    const count = (o: Observation, s: string): number => notes(o).split(s).length - 1;
    // Each route: the unlabelled list gives cannot_tell (never a fault), and a labelled one never no_fault.
    async function unknownBoth(wrap: (list: string) => string, reason: string, n = 1): Promise<void> {
      for (const groups of [NOLABEL, G]) {
        const o = await one(wrap(sel("", groups)));
        expect(o.outcome).toBe("cannot_tell");
        expect(count(o, UNKNOWN)).toBe(n);
        expect(notes(o)).toContain(reason);
      }
    }
    const MASK = "a mask on it";
    const FILTER = "a filter or backdrop-filter";
    const OPACITY = "an opacity below 1";
    const TRANSFORM = "a transform the check does not resolve";
    const OFF_CHAIN = "outside its containing-block chain";
    const NO_SCROLL = "outside the visible part of a document that cannot scroll";
    const PARTIAL = "a hosting frame element is shown only in part";

    describe("masks", () => {
      const masks = [
        "mask-image:linear-gradient(transparent,transparent)",
        "-webkit-mask-image:linear-gradient(transparent,transparent)",
        "mask:linear-gradient(transparent,transparent)",
        "-webkit-mask:linear-gradient(transparent,transparent)",
        "mask:url(#empty)",
        "mask-image:linear-gradient(#000,#000);mask-size:0",
        "-webkit-mask-box-image:linear-gradient(transparent,transparent) 0",
      ];
      const svg = `<svg width="0" height="0" style="position:absolute"><mask id="empty"></mask></svg>`;
      for (const m of masks) {
        it(`${m} on an ancestor`, async () => {
          await unknownBoth((list) => `${svg}<form><div style="${m}">${list}</div></form>`, MASK);
        });
      }

      it("on the select itself", async () => {
        await unknownBoth((list) => `<form>${list.replace("<select ", `<select style="mask-image:linear-gradient(transparent,transparent)" `)}</form>`, MASK);
      });

      it("on the frame element hosting the list's document (and under an empty SVG mask)", async () => {
        for (const style of ["mask-image:linear-gradient(transparent,transparent)", "mask:url(#empty)"]) {
          const o = await check({
            "index.html": page(`<svg width="0" height="0" style="position:absolute"><mask id="empty"></mask></svg><iframe title="f" src="f.html" style="${style}"></iframe>`),
            "f.html": page(`<form>${sel("", NOLABEL)}</form>`),
          });
          expect(o.outcome).toBe("cannot_tell");
          expect(notes(o)).toContain(MASK);
        }
      });
    });

    describe("filter and backdrop-filter", () => {
      for (const f of ["filter:opacity(0)", "filter:blur(1px)", "backdrop-filter:blur(1px)", "filter:url(#none)"]) {
        it(`${f} on an ancestor`, async () => {
          await unknownBoth((list) => `<form><div style="${f}">${list}</div></form>`, FILTER);
        });
      }

      it("filter: opacity(0) on the select and on the hosting frame element", async () => {
        await unknownBoth((list) => `<form>${list.replace("<select ", `<select style="filter:opacity(0)" `)}</form>`, FILTER);
        const o = await check({
          "index.html": page(`<iframe title="f" src="f.html" style="filter:opacity(0)"></iframe>`),
          "f.html": page(`<form>${sel("", NOLABEL)}</form>`),
        });
        expect(o.outcome).toBe("cannot_tell");
        expect(notes(o)).toContain(FILTER);
      });
    });

    describe("opacity below 1", () => {
      for (const op of ["0.001", "0.5", "0.99"]) {
        it(`opacity ${op} on an ancestor`, async () => {
          await unknownBoth((list) => `<form><div style="opacity:${op}">${list}</div></form>`, OPACITY);
        });
      }

      it("on the select and on the hosting frame element; opacity 0 stays 'not visible'", async () => {
        await unknownBoth((list) => `<form>${list.replace("<select ", `<select style="opacity:0.001" `)}</form>`, OPACITY);
        const framed = await check({
          "index.html": page(`<iframe title="f" src="f.html" style="opacity:0.01"></iframe>`),
          "f.html": page(`<form>${sel("", NOLABEL)}</form>`),
        });
        expect(framed.outcome).toBe("cannot_tell");
        expect(notes(framed)).toContain(OPACITY);
        const zero = await one(`<form><div style="opacity:0">${sel("", NOLABEL)}</div></form>`);
        expect(zero.outcome).toBe("cannot_tell");
        expect(notes(zero)).toContain("computed opacity 0");
      });
    });

    describe("transforms the bounding rectangle does not reflect", () => {
      const routes = [
        "transform:rotateY(180deg);backface-visibility:hidden",
        "rotate:y 180deg;backface-visibility:hidden",
        "transform:perspective(100px) translateZ(200px)",
        "transform:rotate(45deg)",
        "transform:skewX(30deg)",
        "scale:1 1 -1;backface-visibility:hidden",
        "offset-path:path('M0 0 L100 100')",
      ];
      for (const t of routes) {
        it(`${t} on the select`, async () => {
          await unknownBoth((list) => `<form>${list.replace("<select ", `<select style="${t}" `)}</form>`, TRANSFORM);
        });
      }

      it("rotateY(180deg) with backface-visibility hidden on an ancestor, and on the hosting frame element", async () => {
        await unknownBoth((list) => `<form><div style="transform:rotateY(180deg);backface-visibility:hidden">${list}</div></form>`, TRANSFORM);
        const o = await check({
          "index.html": page(`<iframe title="f" src="f.html" style="transform:rotateY(180deg);backface-visibility:hidden"></iframe>`),
          "f.html": page(`<form>${sel("", NOLABEL)}</form>`),
        });
        expect(o.outcome).toBe("cannot_tell");
        expect(notes(o)).toContain(TRANSFORM);
      });

      it("control: an axis-aligned translation or scale is measured, so the list is decided", async () => {
        const o = await one(
          // transform-origin 0 0: scaled about the centre of a page-wide block, the list would leave the page
          `<form><div style="transform:translate(10px,20px)">${sel("", NOLABEL)}</div><div style="transform:scale(2);transform-origin:0 0">${sel("", NOLABEL)}</div>` +
            `<div style="transform:translateZ(0)">${sel("", NOLABEL)}</div><div style="translate:5px 5px;scale:1.5;transform-origin:0 0">${sel("", NOLABEL)}</div></form>`,
        );
        expect(o.outcome).toBe("fault");
        expect(o.evidence.filter((e) => e.kind === "dom_node")).toHaveLength(4);
      });

      it("control: scale(0) is measured as under 4 pixels square", async () => {
        const o = await one(`<form><div style="transform:scale(0)">${sel("", NOLABEL)}</div></form>`);
        expect(o.outcome).toBe("cannot_tell");
        expect(notes(o)).toContain("no part at least 4 pixels square");
      });
    });

    describe("clip-path inset() or clip on an ancestor off the containing-block chain", () => {
      it("inset(50%) on a static ancestor of an absolutely positioned list", async () => {
        await unknownBoth((list) => `<form><div style="clip-path:inset(50%)">${list.replace("<select ", '<select style="position:absolute;top:10px;left:10px" ')}</div></form>`, OFF_CHAIN);
      });

      it("inset(50%) on a positioned ancestor of a fixed list, and clip on an absolute ancestor of a fixed list", async () => {
        await unknownBoth(
          (list) => `<form><div style="position:relative;clip-path:inset(50%)">${list.replace("<select ", '<select style="position:fixed;top:10px;left:10px" ')}</div></form>`,
          OFF_CHAIN,
        );
        await unknownBoth(
          (list) => `<form><div style="position:absolute;clip:rect(0,0,0,0)">${list.replace("<select ", '<select style="position:fixed;top:10px;left:10px" ')}</div></form>`,
          OFF_CHAIN,
        );
      });

      it("control: inset() on the chain is still measured", async () => {
        const o = await one(`<form><div style="position:relative;clip-path:inset(50%)">${sel('style="position:absolute;top:10px;left:10px"', NOLABEL)}</div></form>`);
        expect(o.outcome).toBe("cannot_tell");
        expect(notes(o)).toContain("no part at least 4 pixels square");
      });
    });

    describe("a list outside the visible part of a document that cannot scroll", () => {
      const doc = (htmlStyle: string, body: string): string =>
        `<!doctype html><html lang="fr" style="${htmlStyle}"><head><title>f</title></head><body style="margin:0">${body}</body></html>`;
      const below = (list: string): string => `<div style="height:2000px"></div><form>${list}</form>`;

      for (const [where, style] of [
        ["overflow hidden on the frame's root", "overflow:hidden"],
        ["overflow clip on the frame's root", "overflow:clip"],
      ] as const) {
        it(`${where}, the list below the frame's viewport`, async () => {
          for (const groups of [NOLABEL, G]) {
            const o = await check({ "index.html": page(`<iframe title="f" src="f.html"></iframe>`), "f.html": doc(style, below(sel("", groups))) });
            expect(o.outcome).toBe("cannot_tell");
            expect(notes(o)).toContain(NO_SCROLL);
          }
        });
      }

      it("overflow hidden on the frame's body, propagated to its viewport", async () => {
        const o = await check({
          "index.html": page(`<iframe title="f" src="f.html"></iframe>`),
          "f.html": `<!doctype html><html lang="fr"><head><title>f</title></head><body style="overflow:hidden">${below(sel("", NOLABEL))}</body></html>`,
        });
        expect(o.outcome).toBe("cannot_tell");
        expect(notes(o)).toContain(NO_SCROLL);
      });

      it('scrolling="no" on the frame element', async () => {
        const o = await check({ "index.html": page(`<iframe title="f" src="f.html" scrolling="NO"></iframe>`), "f.html": doc("", below(sel("", NOLABEL))) });
        expect(o.outcome).toBe("cannot_tell");
        expect(notes(o)).toContain(NO_SCROLL);
      });

      it("the top-level page itself when it cannot scroll", async () => {
        const o = await check({ "index.html": doc("overflow:hidden", below(sel("", NOLABEL))) });
        expect(o.outcome).toBe("cannot_tell");
        expect(notes(o)).toContain(NO_SCROLL);
      });

      it("a frame that cannot scroll, shown only in part by its frame element", async () => {
        const o = await check({
          "index.html": page(`<div style="overflow:hidden;width:60px;height:40px"><iframe title="f" src="f.html"></iframe></div>`),
          "f.html": doc("overflow:hidden", `<form>${sel('style="margin-left:200px"', NOLABEL)}</form>`),
        });
        expect(o.outcome).toBe("cannot_tell");
        expect(notes(o)).toContain(PARTIAL);
      });

      it("control: in the visible part of a frame that cannot scroll, or below the viewport of one that can, the list is decided", async () => {
        const shown = await check({ "index.html": page(`<iframe title="f" src="f.html"></iframe>`), "f.html": doc("overflow:hidden", `<form>${sel("", NOLABEL)}</form>`) });
        expect(shown.outcome).toBe("fault");
        const scrollable = await check({ "index.html": page(`<iframe title="f" src="f.html"></iframe>`), "f.html": doc("", below(sel("", NOLABEL))) });
        expect(scrollable.outcome).toBe("fault");
        const top = await check({ "index.html": doc("overflow-x:hidden", below(sel("", NOLABEL))) });
        expect(top.outcome).toBe("fault");
      });
    });

    it("a list fixed to the viewport and outside it, on a page that scrolls (found by this builder)", async () => {
      await unknownBoth(
        (list) => `<div style="height:3000px"></div><form>${list.replace("<select ", '<select style="position:fixed;top:2000px;left:10px" ')}</form>`,
        "fixed to the viewport and lies outside it",
      );
      const shown = await one(`<div style="height:3000px"></div><form>${sel('style="position:fixed;top:10px;left:10px"', NOLABEL)}</form>`);
      expect(shown.outcome).toBe("fault");
    });

    it("a definite fault elsewhere on the page still wins", async () => {
      const o = await one(`<form><div style="mask-image:linear-gradient(transparent,transparent)">${sel("", NOLABEL)}</div>${sel("", NOLABEL)}</form>`);
      expect(o.outcome).toBe("fault");
      expect(o.evidence.filter((e) => e.kind === "dom_node")).toHaveLength(1);
      expect(o.evidence[0]?.locator).toBe("html > body > form > select > optgroup");
    });

    it("control: a plainly visible list still faults, or passes when labelled", async () => {
      expect((await one(`<form>${sel("", NOLABEL)}</form>`)).outcome).toBe("fault");
      expect((await one(`<form>${sel("", G)}</form>`)).outcome).toBe("no_fault");
    });

    it("2.1.1, 6.2.1 and 11.1.1 do not change: a frame, link and field under a mask, a filter, opacity 0.5 or a 3D flip still fault", async () => {
      const hide = ["mask-image:linear-gradient(transparent,transparent)", "filter:opacity(0)", "opacity:0.5", "transform:rotateY(180deg);backface-visibility:hidden"];
      const body = hide.map((h) => `<div style="${h}"><iframe src="about:blank"></iframe><a href="/x"></a><input type="text"></div>`).join("");
      const obs = await observe(familyCProvider, { "index.html": page(body) }, { browser });
      for (const id of ["custom/2-1-frame-title-attribute", "custom/6-2-link-content-name", "custom/11-1-field-label-mechanism"]) {
        const o = obs.find((x) => x.checkId === id);
        expect(o?.outcome, id).toBe("fault");
        expect(o?.evidence.filter((e) => e.kind === "dom_node"), id).toHaveLength(hide.length);
      }
    });
  });

  it("step (3): an optgroup whose parent is not the select is cannot_tell", async () => {
    const o = await one(
      `<form>${sel('id="s"', "<option>a</option>")}</form><script>const d = document.createElement('div'); const g = document.createElement('optgroup'); d.append(g); document.getElementById('s').append(d);</script>`,
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("Step (3)");
  });

  it("step (4): an optgroup with hidden, display none, aria-hidden or inert is cannot_tell", async () => {
    const o = await one(
      `<form>${sel("", `<optgroup hidden></optgroup><optgroup style="display:none"></optgroup><optgroup aria-hidden="true"></optgroup><optgroup inert></optgroup>`)}</form>`,
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o).match(/Step \(4\)/g)?.length).toBe(4);
  });

  it("step (5): an optgroup with a legend child is cannot_tell", async () => {
    const o = await one(
      `<form>${sel('id="s"', NOLABEL)}</form><script>const l = document.createElement('legend'); l.textContent = 'Poires'; document.querySelector('#s optgroup').prepend(l);</script>`,
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("Step (5)");
  });

  it("step (6): a label attribute, even empty, holds: no_fault", async () => {
    const o = await one(`<form>${sel("", `${G}<optgroup label=""><option>x</option></optgroup>`)}</form>`);
    expect(o.outcome).toBe("no_fault");
    expect(o.evidence[0]?.note).toContain("2 optgroup element(s)");
  });

  it("step (7): an optgroup with no label attribute is a fault", async () => {
    const o = await one(`<form>${sel("", `${G}${NOLABEL}`)}</form>`);
    expect(o.outcome).toBe("fault");
    expect(o.evidence.filter((e) => e.kind === "dom_node")).toHaveLength(1);
    expect(o.evidence[0]?.locator).toBe("html > body > form > select > optgroup:nth-of-type(2)");
    expect(o.fingerprint).toBe(`${ID}:optgroup`);
  });

  it("page result: a fault wins; cannot_tell wins over no_fault; no optgroup in a select is inapplicable", async () => {
    const mixed = await one(`<form>${sel("", NOLABEL)}${sel("", `<optgroup hidden></optgroup>`)}</form>${sel("", G)}`);
    expect(mixed.outcome).toBe("fault");
    const ct = await one(`<form>${sel("", G)}</form>${sel("", G)}`);
    expect(ct.outcome).toBe("cannot_tell");
    const none = await one(`<form>${sel("", "<option>a</option>")}</form><div id="d"></div><script>document.getElementById('d').append(document.createElement('optgroup'));</script>`);
    expect(none.outcome).toBe("inapplicable");
    expect(none.evidence[0]?.kind).toBe("scope_examined");
  });

  it("lists in a cross-site frame and in a closed shadow tree are examined", async () => {
    const o = await check({
      "index.html": page(`<form>${sel("", G)}</form><iframe id="f" title="f" src="__CROSS_ORIGIN__/f.html"></iframe>`),
      "f.html": page(`<form><x-f id="h"></x-f></form><script>document.getElementById('h').attachShadow({mode:'closed'}).innerHTML = '<select aria-label="c">${NOLABEL}</select>';</script>`),
    });
    expect(o.outcome).toBe("fault");
    expect(o.evidence[0]?.locator).toBe("iframe#f >>> x-f#h >> select > optgroup");
  });

  it("XHTML: optgroups are read, and role=Form counts as a form", async () => {
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr"><head><title>t</title></head><body>
<div role="Form" aria-label="f"><select aria-label="c"><optgroup label="A"><option>a</option></optgroup><optgroup><option>b</option></optgroup></select></div>
</body></html>`;
    const o = await check({ "index.xhtml": xhtml }, { page: "index.xhtml" });
    expect(o.outcome).toBe("fault");
  });

  it("an unread nested document makes the page cannot_tell instead of inapplicable; a fault still wins", async () => {
    const busy = page(`<script>addEventListener('load', () => setTimeout(() => { for (;;) {} }, 50));</script>`);
    const ct = await check({ "index.html": page(`<iframe title="b" src="__CROSS_ORIGIN__/busy.html"></iframe>`), "busy.html": busy }, { timeouts: { frameProbe: 500 } });
    expect(ct.outcome).toBe("cannot_tell");
    expect(notes(ct)).toContain("Not read");
    const fault = await check(
      { "index.html": page(`<form>${sel("", NOLABEL)}</form><iframe title="b" src="__CROSS_ORIGIN__/busy.html"></iframe>`), "busy.html": busy },
      { timeouts: { frameProbe: 500 } },
    );
    expect(fault.outcome).toBe("fault");
  });
});
