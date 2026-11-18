/**
 * `custom/10-1-presentation-elements` (RGAA 10.1.1): one test per branch of
 * its record, through the engine (`observe`), so every result is sanitised
 * and validated against `ObservationSchema`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { ELEMENTS_CHECK_ID, doctypeKind, elementsDefinition } from "../../../../src/checks/custom/10-1-presentation-elements/index.ts";
import { presentationProvider } from "../../../../src/checks/custom/family-b/index.ts";
import { launchBrowser } from "../../../../src/engine/index.ts";
import { observe, withTarget } from "../../../../src/engine/testing/index.ts";
import type { FixtureFiles } from "../../../../src/engine/testing/index.ts";
import type { Observation } from "../../../../src/schema/index.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

const HTML5 = "<!DOCTYPE html>";
const HTML401 = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">';
const page = (body: string, doctype = HTML5): string =>
  `${doctype}<html lang="fr"><head><meta charset="utf-8"><title>Boulangerie</title></head><body>${body}</body></html>`;
const xhtml = (body: string, doctype = "<!DOCTYPE html>"): string =>
  `<?xml version="1.0" encoding="utf-8"?>${doctype}<html xmlns="http://www.w3.org/1999/xhtml" lang="fr"><head><title>Boulangerie</title></head><body>${body}</body></html>`;

async function run(files: FixtureFiles | string, pageName?: string): Promise<Observation> {
  const source = typeof files === "string" ? { "index.html": files } : files;
  const obs = await observe(presentationProvider, source, { browser, ...(pageName ? { page: pageName } : {}) });
  const o = obs.find((x) => x.checkId === ELEMENTS_CHECK_ID);
  if (o === undefined) throw new Error("no observation");
  return o;
}

const notes = (o: Observation): string => o.evidence.map((e) => `${e.note ?? ""} ${e.locator ?? ""} ${e.snippet ?? ""}`).join("\n");

describe("definition", () => {
  it("declares version 1.0.0 and records the version of its lists", () => {
    expect(elementsDefinition.version).toBe("1.0.0");
    expect(elementsDefinition.defaultOptions["listsVersion"]).toBe("1.0.0");
  });

  it("recognises the HTML 5 doctype and the earlier ones exactly", () => {
    expect(doctypeKind({ name: "html", publicId: "", systemId: "" })).toBe("html5");
    expect(doctypeKind({ name: "html", publicId: "", systemId: "about:legacy-compat" })).toBe("html5");
    expect(doctypeKind({ name: "HTML", publicId: "", systemId: "" })).toBe("other");
    expect(doctypeKind({ name: "html", publicId: "-//W3C//DTD XHTML 1.0 Strict//EN", systemId: "" })).toBe("earlier");
    expect(doctypeKind({ name: "html", publicId: "-//W3C//DTD HTML 3.2 Final//EN", systemId: "" })).toBe("earlier");
    expect(doctypeKind({ name: "html", publicId: "-//w3c//dtd html 4.01//en", systemId: "" })).toBe("other");
    expect(doctypeKind(null)).toBe("none");
  });
});

describe("(1) fault", () => {
  it("(1) a listed element other than u in the top-level document tree faults, naming it", async () => {
    const o = await run(page("<main><center>Bienvenue</center><p>Pain</p><font color='red'>Promo</font></main>"));
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ELEMENTS_CHECK_ID}:center,font`);
    const nodes = o.evidence.filter((e) => e.kind === "dom_node");
    expect(nodes.map((e) => e.locator)).toEqual(["html > body > main > center", "html > body > main > font"]);
    expect(nodes[0]?.snippet).toBe("<center>");
  });

  it("(1) every listed element other than u faults: basefont, big, blink, center, font, marquee, s, strike, tt", async () => {
    const o = await run(
      page("<basefont size='3'><big>a</big><blink>b</blink><center>c</center><font>d</font><marquee>e</marquee><s>f</s><strike>g</strike><tt>h</tt>"),
    );
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ELEMENTS_CHECK_ID}:basefont,big,blink,center,font,marquee,s,strike,tt`);
  });

  it("(1) a hidden listed element faults: presence in the source, not rendering", async () => {
    const o = await run(page("<div hidden><font>caché</font></div><div style='display:none'><tt>x</tt></div>"));
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ELEMENTS_CHECK_ID}:font,tt`);
  });

  it("(1) a listed element inserted by a script after load faults", async () => {
    const o = await run({
      "index.html": page("<p id='prix'>Prix</p><script src='late.js'></script>"),
      "late.js": "window.addEventListener('load', () => setTimeout(() => { const s = document.createElement('s'); s.textContent = '3 €'; document.getElementById('prix').append(s); }, 50));",
    });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ELEMENTS_CHECK_ID}:s`);
  });

  it("(1) a u element under an earlier doctype (HTML 4.01) faults", async () => {
    const o = await run(page("<p><u>souligné</u></p>", HTML401));
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ELEMENTS_CHECK_ID}:u`);
    expect(notes(o)).toContain("earlier one");
  });

  it("(1) a u element under an XHTML 1.0 doctype, in an XHTML document, faults", async () => {
    const o = await run(
      { "index.xhtml": xhtml("<p><u>souligné</u></p>", '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">') },
      "index.xhtml",
    );
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ELEMENTS_CHECK_ID}:u`);
  });

  it("(1) a lower-case listed element in an XHTML document faults", async () => {
    const o = await run({ "index.xhtml": xhtml("<center>x</center>") }, "index.xhtml");
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ELEMENTS_CHECK_ID}:center`);
  });

  it("(1) a fault wins over every case of (2) the page also holds, and the evidence names them", async () => {
    const o = await run({
      "index.html": page(
        "<big>x</big><nobr>y</nobr><svg><font></font></svg><template><center>t</center></template><noscript><font>n</font></noscript><iframe title='cadre' src='__CROSS_ORIGIN__/f.html'></iframe><u>z</u>",
        "",
      ),
      "f.html": page("<center>cadre</center>"),
    });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ELEMENTS_CHECK_ID}:big`);
    const text = notes(o);
    expect(text).toContain("The fault wins over");
    expect(text).toContain("no doctype");
    expect(text).toContain("nested browsing context");
  });
});

describe("(2) cannot tell", () => {
  it("(2) a case variant in an XHTML document (CENTER) abstains, never faults", async () => {
    const o = await run({ "index.xhtml": xhtml("<CENTER>x</CENTER><Font>y</Font>") }, "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
    expect(o.fingerprint).toBe(`${ELEMENTS_CHECK_ID}:cannot_tell`);
    expect(notes(o)).toContain("case variant");
  });

  it("(2) a case variant U abstains under the HTML 5 doctype too", async () => {
    const o = await run({ "index.xhtml": xhtml("<U>x</U>") }, "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("case variant");
  });

  it("(2) a case variant given to createElementNS in an HTML document abstains", async () => {
    const o = await run(
      page("<p id='p'>x</p><script>document.getElementById('p').append(document.createElementNS('http://www.w3.org/1999/xhtml', 'NoBr'));</script>"),
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("case variant");
  });

  it("(2) a u element while the document has no doctype abstains", async () => {
    const o = await run(page("<p><u>souligné</u></p>", ""));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("no doctype");
  });

  it("(2) a u element under a doctype named HTML in an XHTML document (neither HTML 5 nor earlier) abstains", async () => {
    const o = await run({ "index.xhtml": xhtml("<p><u>souligné</u></p>", "<!DOCTYPE HTML>") }, "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("neither the HTML 5 doctype nor an earlier one");
  });

  it("(2) an element with a listed local name in another namespace (an SVG font element) abstains", async () => {
    const o = await run(page("<svg width='10' height='10'><font></font></svg>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("another namespace");
  });

  it("(2) a listed element inside an open shadow tree abstains", async () => {
    const o = await run(page("<div id='h'></div><script>document.getElementById('h').attachShadow({mode:'open'}).innerHTML = '<center>x</center>';</script>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("inside a shadow tree");
    expect(notes(o)).toContain("shadow-root >> center");
  });

  it("(2) a listed element inside a closed shadow tree abstains (read through CDP)", async () => {
    const o = await run(page("<div id='h'></div><script>document.getElementById('h').attachShadow({mode:'closed'}).innerHTML = '<p><tt>x</tt></p>';</script>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("closed shadow tree");
    expect(notes(o)).toContain("closed-shadow-root >> p > tt");
  });

  it("(2) a closed shadow tree without listed elements is read, so it does not abstain", async () => {
    const o = await run(page("<div id='h'></div><script>document.getElementById('h').attachShadow({mode:'closed'}).innerHTML = '<p>x</p>';</script>"));
    expect(o.outcome).toBe("no_fault");
    expect(notes(o)).toContain("Closed shadow roots read through CDP: 1");
  });

  it("(2) shadow roots the check cannot read (no CDP reading of the DOM) abstain", async () => {
    const result = await withTarget(
      { "index.html": page("<p>x</p>") },
      async (ctx) => presentationProvider.run({ ...ctx, cdpFor: () => Promise.reject(new Error("test: no session")) }),
      { browser },
    );
    const r = result.get(ELEMENTS_CHECK_ID);
    expect(r?.outcome).toBe("cannot_tell");
    expect(JSON.stringify(r)).toContain("shadow roots the check cannot read");
  });

  it("(2) a listed element in the document of a cross-origin frame abstains", async () => {
    const o = await run({
      "index.html": page("<iframe title='Carte' src='__CROSS_ORIGIN__/frame.html'></iframe>"),
      "frame.html": page("<center>cadre</center>"),
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("nested browsing context");
    expect(notes(o)).toContain("cross-origin");
  });

  it("(2) a u element in a framed document abstains whatever the doctype there", async () => {
    const o = await run({
      "index.html": page("<iframe title='Carte' src='frame.html'></iframe>"),
      "frame.html": page("<u>x</u>", HTML5),
    });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("(2) a listed element in the document of an object element abstains", async () => {
    const o = await run({
      "index.html": page("<object title='Encart' type='text/html' data='frame.html' width='200' height='80'></object>"),
      "frame.html": page("<marquee>x</marquee>"),
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("nested browsing context");
  });

  it("(2) a nested document the check cannot read abstains", async () => {
    const result = await withTarget(
      { "index.html": page("<iframe title='Carte' src='__CROSS_ORIGIN__/frame.html'></iframe>"), "frame.html": page("<p>x</p>") },
      async (ctx) => {
        const frames = ctx.frames.map((f) => (f.parent === null ? f : { ...f, readable: false, unreadableReason: "test: unreadable" }));
        return presentationProvider.run({ ...ctx, frames });
      },
      { browser },
    );
    const r = result.get(ELEMENTS_CHECK_ID);
    expect(r?.outcome).toBe("cannot_tell");
    expect(JSON.stringify(r)).toContain("cannot read (test: unreadable)");
  });

  it("(2) an unread nested document does not hide a fault in the top-level document", async () => {
    const result = await withTarget(
      { "index.html": page("<center>x</center><iframe title='Carte' src='__CROSS_ORIGIN__/frame.html'></iframe>"), "frame.html": page("<p>x</p>") },
      async (ctx) => {
        const frames = ctx.frames.map((f) => (f.parent === null ? f : { ...f, readable: false, unreadableReason: "test: unreadable" }));
        return presentationProvider.run({ ...ctx, frames });
      },
      { browser },
    );
    expect(result.get(ELEMENTS_CHECK_ID)?.outcome).toBe("fault");
  });

  it("(2) a listed element under a noscript element parsed as elements (XHTML) abstains", async () => {
    const o = await run({ "index.xhtml": xhtml("<noscript><p><center>Activez JavaScript</center></p></noscript>") }, "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("noscript element among its ancestors");
  });

  it("(2) the text of a noscript element, parsed as HTML, holding a listed element abstains", async () => {
    const o = await run(page("<noscript><p><font color='red'>Activez JavaScript</font></p></noscript>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("the text of a noscript element, parsed as HTML");
    expect(notes(o)).toContain("noscript-text >> p > font");
  });

  it("(2) the content of a template element holding a listed element abstains, u included", async () => {
    const o = await run(page("<template><p><u>gabarit</u></p></template>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("the content of a template element");
  });

  it("(2) an HTML multicol, nobr or spacer element abstains", async () => {
    for (const name of ["nobr", "multicol", "spacer"]) {
      const o = await run(page(`<p><${name}>x</${name}></p>`));
      expect(o.outcome, name).toBe("cannot_tell");
      expect(notes(o)).toContain("multicol, nobr or spacer");
    }
  });
});

describe("(3) no fault", () => {
  it("(3) a page with none of the elements gives no_fault, with the scope examined", async () => {
    const o = await run(page("<header><p>Boulangerie</p></header><main><h1>Horaires</h1><p><strong>7 h</strong> – <em>19 h</em></p></main>"));
    expect(o.outcome).toBe("no_fault");
    expect(o.fingerprint).toBe(`${ELEMENTS_CHECK_ID}:no_fault`);
    const scope = o.evidence.find((e) => e.kind === "scope_examined");
    expect(scope?.note).toContain("hidden elements included");
    expect(scope?.note).toMatch(/Top-level document \(text\/html\): \d+ element\(s\)/);
  });

  it("(3) a u element under the HTML 5 doctype is allowed: no_fault, listing it", async () => {
    const o = await run(page("<p><u>souligné</u></p>"));
    expect(o.outcome).toBe("no_fault");
    const scope = o.evidence.find((e) => e.kind === "scope_examined");
    expect(JSON.parse(scope?.locator ?? "[]")).toEqual(["html > body > p > u"]);
  });

  it("(3) a frame without listed elements is examined and does not abstain", async () => {
    const o = await run({
      "index.html": page("<iframe title='Carte' src='__CROSS_ORIGIN__/frame.html'></iframe>"),
      "frame.html": page("<p>cadre</p>"),
    });
    expect(o.outcome).toBe("no_fault");
    expect(notes(o)).toContain("frame 1 (cross-origin");
  });

  it("never answers inapplicable, even on an almost empty page", async () => {
    const o = await run("<!DOCTYPE html><title>x</title>");
    expect(o.outcome).toBe("no_fault");
  });
});

describe("a large page", () => {
  it("reads about 56,000 elements in four documents within a few seconds, naming faults up to the cap", async () => {
    let body = "<table>";
    for (let i = 0; i < 2000; i++) body += `<tr class="r${i}"><td width="10">x</td><td><a href="#${i}">l</a></td><td><span><u>u</u></span></td></tr>`;
    body += "</table>";
    const frame = page(body);
    for (let f = 0; f < 3; f++) body += `<iframe title="f${f}" src="${f === 0 ? "__CROSS_ORIGIN__/" : ""}f.html"></iframe>`;
    const files = { "index.html": page(`${body}<center>x</center>`), "f.html": frame };
    const started = Date.now();
    const obs = await observe(presentationProvider, files, { browser });
    const elapsed = Date.now() - started; // includes loading the page
    const e = obs.find((o) => o.checkId === ELEMENTS_CHECK_ID);
    const a = obs.find((o) => o.checkId !== ELEMENTS_CHECK_ID);
    expect(e?.outcome).toBe("fault");
    expect(a?.outcome).toBe("fault");
    expect(a?.evidence.filter((x) => x.kind === "dom_node")).toHaveLength(1000);
    expect(a?.evidence.some((x) => x.note?.includes("2000 faulty instance(s) in all"))).toBe(true);
    expect(elapsed).toBeLessThan(15000);
  }, 30000);
});

describe("failure to run", () => {
  it("a top-level document it cannot read is an error (scope_unreadable), not an outcome", async () => {
    const result = await withTarget(
      { "index.html": page("<p>x</p>") },
      async (ctx) => {
        const frames = ctx.frames.map((f) => ({ ...f, readable: false, unreadableReason: "test: unreadable" }));
        return presentationProvider.run({ ...ctx, frames });
      },
      { browser },
    );
    const r = result.get(ELEMENTS_CHECK_ID);
    expect(r).toMatchObject({ outcome: "error", kind: "scope_unreadable" });
  });
});
