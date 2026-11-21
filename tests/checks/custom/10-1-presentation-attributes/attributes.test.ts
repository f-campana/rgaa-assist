/**
 * `custom/10-1-presentation-attributes` (RGAA 10.1.2): one test per branch of
 * its record, through the engine (`observe`), so every result is sanitised
 * and validated against `ObservationSchema`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { ATTRIBUTES_CHECK_ID, ATTRIBUTE_LISTS, attributesDefinition } from "../../../../src/checks/custom/10-1-presentation-attributes/index.ts";
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

const page = (body: string, head = ""): string =>
  `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Boulangerie</title>${head}</head><body>${body}</body></html>`;
const xhtml = (body: string): string =>
  `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" lang="fr"><head><title>Boulangerie</title></head><body>${body}</body></html>`;
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';

async function run(files: FixtureFiles | string, pageName?: string): Promise<Observation> {
  const source = typeof files === "string" ? { "index.html": files, "logo.svg": LOGO } : files;
  const obs = await observe(presentationProvider, source, { browser, ...(pageName ? { page: pageName } : {}) });
  const o = obs.find((x) => x.checkId === ATTRIBUTES_CHECK_ID);
  if (o === undefined) throw new Error("no observation");
  return o;
}

const notes = (o: Observation): string => o.evidence.map((e) => `${e.note ?? ""} ${e.locator ?? ""} ${e.snippet ?? ""}`).join("\n");

describe("definition", () => {
  it("declares version 1.0.3 and records the version of its lists", () => {
    expect(attributesDefinition.version).toBe("1.0.3");
    expect(attributesDefinition.defaultOptions["listsVersion"]).toBe("1.0.3");
    expect(ATTRIBUTE_LISTS.presentationAttributes).toHaveLength(24);
  });

  it("keeps every defined pair the record gives as an example, height on table included (Q59)", () => {
    const d = ATTRIBUTE_LISTS.definedPairs;
    const examples: [string, string[]][] = [
      ["align", ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "img", "table", "td", "caption"]],
      ["alink", ["body"]], ["link", ["body"]], ["text", ["body"]], ["vlink", ["body"]],
      ["background", ["body", "table", "tr", "td", "th"]], ["bgcolor", ["body", "table", "tr", "td", "th"]],
      ["border", ["table", "img", "object", "input"]], ["cellpadding", ["table"]], ["cellspacing", ["table"]],
      ["char", ["col", "colgroup", "tbody", "thead", "tfoot", "tr", "td", "th"]],
      ["charoff", ["col", "colgroup", "tbody", "thead", "tfoot", "tr", "td", "th"]],
      ["valign", ["col", "colgroup", "tbody", "thead", "tfoot", "tr", "td", "th"]],
      ["clear", ["br"]], ["color", ["font", "basefont", "hr"]], ["size", ["font", "basefont", "hr", "input"]],
      ["compact", ["dl", "ol", "ul", "menu", "dir"]],
      ["frameborder", ["iframe", "frame"]], ["marginheight", ["iframe", "frame", "body"]], ["marginwidth", ["iframe", "frame", "body"]],
      ["hspace", ["img", "object", "embed", "iframe", "input"]], ["vspace", ["img", "object", "embed", "iframe", "input"]],
      ["width", ["hr", "pre", "table", "col", "colgroup", "td", "th"]], ["height", ["table", "thead", "tbody", "tfoot", "td", "th", "tr"]],
    ];
    for (const [attr, els] of examples) for (const el of els) expect(d[attr], `${attr} on ${el}`).toContain(el);
    expect(d["color"]).not.toContain("link");
  });
});

describe("(1) fault", () => {
  it("(1) a defined pair in the top-level document tree faults, naming the element and the attribute", async () => {
    const o = await run(page("<main><div align='center'>Bienvenue</div><table border='1'><tr><td>x</td></tr></table></main>"));
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:div@align,table@border`);
    const nodes = o.evidence.filter((e) => e.kind === "dom_node");
    expect(nodes[0]).toMatchObject({ locator: "html > body > main > div", snippet: '<div align="center">' });
    expect(nodes[0]?.note).toContain("align on div");
  });

  it("(1) an empty value still faults: whatever the value", async () => {
    const o = await run(page("<p align=''>x</p>"));
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:p@align`);
  });

  it("(1) a hidden element's defined pair faults: presence in the source, not rendering", async () => {
    const o = await run(page("<table hidden><tr><td width='120'>x</td></tr></table>"));
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:td@width`);
  });

  it("(1) body, br, hr, input, tr and list attributes fault as defined pairs (examples of the record)", async () => {
    const o = await run(
      `<!DOCTYPE html><html lang="fr"><head><title>x</title></head><body bgcolor="#fff" text="#000"><br clear="all"><hr size="2" noshade><input size="20" aria-label="x"><ul compact><li>x</li></ul><table><tr height="20" valign="top"><td>x</td></tr></table></body></html>`,
    );
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:body@bgcolor,body@text,br@clear,hr@size,input@size,tr@height,tr@valign,ul@compact`);
  });

  it("(1) height on table faults (an obsolete feature of the HTML standard; Q59 replaces Q50's abstention)", async () => {
    const o = await run(page("<table height='29'><tr><td>x</td></tr></table>"));
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:table@height`);
    const nodes = o.evidence.filter((e) => e.kind === "dom_node");
    expect(nodes[0]).toMatchObject({ locator: "html > body > table", snippet: '<table height="29">' });
    expect(nodes[0]?.note).toContain("height on table");
  });

  it("(1) border on input and height on thead, tbody and tfoot still fault (obsolete features of the HTML standard, Q57)", async () => {
    const pairs: [string, string][] = [
      ["<input type='text' border='0' aria-label='x'>", "input@border"],
      ["<table><thead height='20'><tr><th>a</th></tr></thead></table>", "thead@height"],
      ["<table><tbody height='20'><tr><td>a</td></tr></tbody></table>", "tbody@height"],
      ["<table><tfoot height='20'><tr><td>a</td></tr></tfoot></table>", "tfoot@height"],
    ];
    for (const [body, pair] of pairs) {
      const o = await run(page(body));
      expect(o.outcome, pair).toBe("fault");
      expect(o.fingerprint, pair).toBe(`${ATTRIBUTES_CHECK_ID}:${pair}`);
    }
  });

  it("(1) frameborder on an iframe inserted by a third-party script faults (Q49)", async () => {
    const o = await run({
      "index.html": page("<main><p>Contact</p></main><script src='__CROSS_ORIGIN__/widget.js'></script>"),
      "widget.js":
        "var f = document.createElement('iframe'); f.title = 'Protection'; f.src = '__CROSS_ORIGIN__/badge.html'; f.setAttribute('frameborder', '0'); f.setAttribute('width', '256'); document.body.appendChild(f);",
      "badge.html": page("<p>Protégé</p>"),
    });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:iframe@frameborder`);
  });

  it("(1) an attribute set by a script after load faults", async () => {
    const o = await run({
      "index.html": page("<p id='p'>x</p><script src='late.js'></script>"),
      "late.js": "window.addEventListener('load', () => setTimeout(() => document.getElementById('p').setAttribute('align', 'right'), 50));",
    });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:p@align`);
  });

  it("(1) a fault wins over the exceptions and every case of (2) the page also holds (img width beside td width)", async () => {
    const o = await run({
      "index.html": page(
        "<img src='logo.svg' width='64' height='64' alt='Logo'><table><tr><td width='50%' nowrap>x</td></tr></table><iframe title='v' src='__CROSS_ORIGIN__/f.html' width='300'></iframe><svg><rect width='4' height='4'/></svg><x-gauge size='3'></x-gauge>",
      ),
      "logo.svg": LOGO,
      "f.html": page("<p align='left'>cadre</p>"),
    });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:td@width`);
    const text = notes(o);
    expect(text).toContain("The fault wins over");
    expect(text).toContain("width or height on iframe");
    expect(text).toContain("nested browsing context");
  });

  it("(1) a defined pair under a noscript element parsed as elements (XHTML) faults: (1) excludes only shadow trees", async () => {
    const o = await run({ "index.xhtml": xhtml("<noscript><table width='100%'><tr><td>Activez JavaScript</td></tr></table></noscript>") }, "index.xhtml");
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:table@width`);
    expect(notes(o)).toContain("under a noscript element");
  });

  it("(1) a lower-case defined pair in an XHTML document faults", async () => {
    const o = await run({ "index.xhtml": xhtml("<div align='center'>x</div>") }, "index.xhtml");
    expect(o.outcome).toBe("fault");
  });
});

describe("(2) cannot tell", () => {
  it("(2) a case variant in an XHTML document (ALIGN) abstains, never faults", async () => {
    const o = await run({ "index.xhtml": xhtml("<div ALIGN='center'>x</div><table><tr><td BgColor='#eee'>y</td></tr></table>") }, "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:cannot_tell`);
    expect(notes(o)).toContain("case variant");
  });

  it("(2) a case variant on an excepted element abstains (WIDTH on img in XHTML)", async () => {
    const o = await run({ "index.xhtml": xhtml("<img src='logo.svg' alt='Logo' WIDTH='64'/>"), "logo.svg": LOGO }, "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("case variant");
  });

  it("(2) a case variant set with setAttributeNS in an HTML document abstains", async () => {
    const o = await run(page("<p id='p'>x</p><script>document.getElementById('p').setAttributeNS(null, 'Align', 'left');</script>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("case variant");
  });

  it("(2) an XHTML element named in upper case (TD) is unknown: its listed attribute abstains", async () => {
    const o = await run({ "index.xhtml": xhtml("<table><tbody><tr><TD align='left'>x</TD></tr></tbody></table>") }, "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("defines no such attribute");
  });

  it("(2) a listed attribute on an element that defines none abstains: custom element, unknown element, div with size, link with color", async () => {
    const cases = [
      page("<x-gauge size='3'></x-gauge>"),
      page("<blink align='left'>x</blink>"),
      page("<div size='3'>x</div>"),
      page("<p>x</p>", "<link rel='mask-icon' href='logo.svg' color='#5bbad5'>"),
    ];
    for (const c of cases) {
      const o = await run(c);
      expect(o.outcome, c).toBe("cannot_tell");
      expect(notes(o)).toContain("defines no such attribute");
    }
  });

  it("(2) align on fieldset abstains: neither HTML 4.01 nor the HTML standard defines it, so it is not a fault", async () => {
    const o = await run(page("<fieldset align='left'><legend>x</legend></fieldset>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(o.outcome).not.toBe("fault");
    expect(notes(o)).toContain("defines no such attribute");
    expect(ATTRIBUTE_LISTS.definedPairs["align"]).not.toContain("fieldset");
    expect(ATTRIBUTE_LISTS.definedPairs["align"]).toContain("embed");
  });

  it("(2) width or height on picture > source still abstains, never no_fault (Q59 item 3)", async () => {
    for (const attrs of ["width='40'", "height='40'", "width='40' height='40'"]) {
      const o = await run({ "index.html": page(`<picture><source srcset='logo.svg' ${attrs}><img src='logo.svg' alt='Logo'></picture>`), "logo.svg": LOGO });
      expect(o.outcome, attrs).toBe("cannot_tell");
      expect(notes(o)).toContain("width or height on iframe, video, input or source");
    }
  });

  it("(2) width or height on iframe, video, input or source abstains", async () => {
    const cases = [
      { "index.html": page("<iframe title='Vidéo' src='v.html' width='560' height='315'></iframe>"), "v.html": page("<p>v</p>") },
      { "index.html": page("<video width='320'></video>") },
      { "index.html": page("<input type='image' alt='Envoyer' src='logo.svg' height='20'>"), "logo.svg": LOGO },
      { "index.html": page("<picture><source srcset='logo.svg' width='40'><img src='logo.svg' alt='Logo'></picture>"), "logo.svg": LOGO },
    ];
    for (const c of cases) {
      const o = await run(c);
      expect(o.outcome, c["index.html"]).toBe("cannot_tell");
      expect(notes(o)).toContain("width or height on iframe, video, input or source");
    }
  });

  it("(2) a listed attribute on an SVG element other than svg abstains; the svg element's own width and height do not", async () => {
    const o = await run(page("<svg width='24' height='24'><rect width='10' height='10'/></svg>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("another namespace");
    expect(notes(o)).toContain("svg > rect");
    expect(notes(o)).not.toContain("html > body > svg\n");
  });

  it("(2) a listed attribute on a MathML element abstains", async () => {
    const o = await run(page("<math><mtable align='axis'><mtr><mtd><mi>x</mi></mtd></mtr></mtable></math>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("another namespace");
  });

  it("(2) an attribute in a namespace whose local name is listed (setAttributeNS) abstains", async () => {
    const o = await run(page("<p id='p'>x</p><script>document.getElementById('p').setAttributeNS('urn:example', 'ex:align', 'left');</script>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("in a namespace");
  });

  it("(2) a listed attribute inside an open shadow tree abstains, an excepted pair included", async () => {
    const o = await run(page("<div id='h'></div><script>document.getElementById('h').attachShadow({mode:'open'}).innerHTML = '<img alt=\"\" width=\"10\">';</script>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("inside a shadow tree");
  });

  it("(2) a listed attribute inside a closed shadow tree abstains (read through CDP)", async () => {
    const o = await run(page("<div id='h'></div><script>document.getElementById('h').attachShadow({mode:'closed'}).innerHTML = '<p align=\"left\">x</p>';</script>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("closed shadow tree");
    expect(notes(o)).toContain("closed-shadow-root >> p");
  });

  it("(2) shadow roots the check cannot read (no CDP reading of the DOM) abstain", async () => {
    const result = await withTarget(
      { "index.html": page("<p>x</p>") },
      async (ctx) => presentationProvider.run({ ...ctx, cdpFor: () => Promise.reject(new Error("test: no session")) }),
      { browser },
    );
    const r = result.get(ATTRIBUTES_CHECK_ID);
    expect(r?.outcome).toBe("cannot_tell");
    expect(JSON.stringify(r)).toContain("shadow roots the check cannot read");
  });

  it("(2) a defined pair inside a shadow tree is not a fault", async () => {
    const o = await run(page("<div id='h'></div><script>document.getElementById('h').attachShadow({mode:'open'}).innerHTML = '<table border=\"1\"><tr><td>x</td></tr></table>';</script>"));
    expect(o.outcome).toBe("cannot_tell");
  });

  it("(2) a listed attribute in the document of a cross-origin frame abstains", async () => {
    const o = await run({
      "index.html": page("<iframe title='Carte' src='__CROSS_ORIGIN__/frame.html'></iframe>"),
      "frame.html": page("<p align='center'>cadre</p>"),
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("nested browsing context");
    expect(notes(o)).toContain("cross-origin");
  });

  it("(2) an excepted pair in a framed document abstains too: the nested clause names no exception", async () => {
    const o = await run({
      "index.html": page("<iframe title='Carte' src='frame.html'></iframe>"),
      "frame.html": page("<img src='logo.svg' alt='Logo' width='10'>"),
      "logo.svg": LOGO,
    });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("(2) an object showing an SVG document is a nested browsing context: the svg's own width and height there abstain", async () => {
    const o = await run({ "index.html": page("<object data='logo.svg' type='image/svg+xml' width='10' height='10'></object>"), "logo.svg": LOGO });
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
    const r = result.get(ATTRIBUTES_CHECK_ID);
    expect(r?.outcome).toBe("cannot_tell");
    expect(JSON.stringify(r)).toContain("cannot read (test: unreadable)");
  });

  it("(2) an unread nested document does not hide a fault in the top-level document", async () => {
    const result = await withTarget(
      { "index.html": page("<p align='left'>x</p><iframe title='Carte' src='__CROSS_ORIGIN__/frame.html'></iframe>"), "frame.html": page("<p>x</p>") },
      async (ctx) => {
        const frames = ctx.frames.map((f) => (f.parent === null ? f : { ...f, readable: false, unreadableReason: "test: unreadable" }));
        return presentationProvider.run({ ...ctx, frames });
      },
      { browser },
    );
    expect(result.get(ATTRIBUTES_CHECK_ID)?.outcome).toBe("fault");
  });

  it("(2) template content holding a listed attribute that would be a fault abstains", async () => {
    const o = await run(page("<template><table><tr><td bgcolor='#eee'>x</td></tr></table></template>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("the content of a template element");
  });

  it("(2) template content holding only excepted pairs does not abstain", async () => {
    const o = await run(page("<template><img src='logo.svg' alt='Logo' width='10' height='10'></template>"));
    expect(o.outcome).toBe("no_fault");
  });

  it("(2) noscript text, parsed as HTML, holding a listed attribute that would be an abstention abstains (iframe width)", async () => {
    const o = await run(page("<noscript><iframe src='ns.html' height='0' width='0' style='display:none'></iframe></noscript>"));
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("the text of a noscript element, parsed as HTML");
  });

  it("(2) noscript text holding only an excepted pair (img width) does not abstain", async () => {
    const o = await run(page("<noscript><img src='logo.svg' alt='' height='1' width='1'></noscript>"));
    expect(o.outcome).toBe("no_fault");
  });

  it("(2) an HTML element carrying an obsolete presentational attribute RGAA does not name abstains", async () => {
    for (const body of ["<table><tr><td nowrap>x</td></tr></table>", "<table frame='box'><tr><td>x</td></tr></table>", "<hr noshade>", "<p bordercolor='red'>x</p>"]) {
      const o = await run(page(body));
      expect(o.outcome, body).toBe("cannot_tell");
      expect(notes(o)).toContain("obsolete presentational attribute");
    }
  });

  it("(2) frame is obsolete on table only: on another element it is neither listed nor obsolete", async () => {
    const o = await run(page("<div frame='box'>x</div>"));
    expect(o.outcome).toBe("no_fault");
  });
});

describe("(3) no fault", () => {
  it("(3) a page with none of the attributes gives no_fault, with the scope examined", async () => {
    const o = await run(page("<main><h1>Horaires</h1><table><caption>Horaires</caption><tr><th scope='row'>Mardi</th><td>7 h – 19 h</td></tr></table></main>"));
    expect(o.outcome).toBe("no_fault");
    expect(o.fingerprint).toBe(`${ATTRIBUTES_CHECK_ID}:no_fault`);
    expect(o.evidence.find((e) => e.kind === "scope_examined")?.note).toContain("hidden elements included");
  });

  it("(3) listed attributes only on the excepted elements give no_fault: size on select, width and height on img, object, embed, canvas and svg", async () => {
    const o = await run(
      page(
        "<select size='2' aria-label='Produit'><option>a</option></select><img src='logo.svg' alt='Logo' width='64' height='64'><object type='application/x-rgaa-test' width='10' height='10'></object><embed type='application/x-rgaa-test' width='10' height='10'><canvas width='120' height='40'></canvas><svg width='24' height='24'></svg>",
      ),
    );
    expect(o.outcome).toBe("no_fault");
    const scope = o.evidence.find((e) => e.kind === "scope_examined");
    expect(JSON.parse(scope?.locator ?? "[]")).toEqual([
      "html > body > select",
      "html > body > img",
      "html > body > object",
      "html > body > embed",
      "html > body > canvas",
      "html > body > svg",
    ]);
  });

  it("never answers inapplicable, even on an almost empty page", async () => {
    const o = await run("<!DOCTYPE html><title>x</title>");
    expect(o.outcome).toBe("no_fault");
  });
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
    expect(result.get(ATTRIBUTES_CHECK_ID)).toMatchObject({ outcome: "error", kind: "scope_unreadable" });
  });
});
