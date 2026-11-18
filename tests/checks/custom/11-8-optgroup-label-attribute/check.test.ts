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
