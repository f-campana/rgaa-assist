/**
 * custom/8-3-default-lang-present, one test per numbered branch of its record
 * (steps 1 to 4, the frame clause of step 1), one per witness condition (a)
 * to (g) and per document type, plus XHTML served as XML, a cross-site frame,
 * shadow trees and text inserted by script after load. Every result goes
 * through the engine's sanitiser and ObservationSchema (`observe`, or
 * `toObservation` for the tests that alter what the engine hands the check).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, CDPSession, Frame } from "playwright";
import { createSanitiser, effectiveOptions, launchBrowser, toObservation } from "../../../../src/engine/index.ts";
import { observe, withTarget } from "../../../../src/engine/testing/index.ts";
import type { Observation } from "../../../../src/schema/index.ts";
import type { CheckContext } from "../../../../src/checks/types.ts";
import { ID, definition, defaultLangPresentProvider } from "../../../../src/checks/custom/8-3-default-lang-present/index.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

async function run(files: Record<string, string>, page?: string): Promise<Observation> {
  const obs = await observe(defaultLangPresentProvider, files, { browser, ...(page === undefined ? {} : { page }) });
  expect(obs).toHaveLength(1);
  const o = obs[0];
  if (o === undefined) throw new Error("no observation");
  expect(o.checkId).toBe(ID);
  expect(o.checkVersion).toBe("1.0.1");
  return o;
}

async function runAltered(files: Record<string, string>, alter: (ctx: CheckContext) => CheckContext): Promise<Observation> {
  return withTarget(
    files,
    async (ctx) => {
      const results = await defaultLangPresentProvider.run(alter(ctx));
      const r = results.get(ID);
      if (r === undefined) throw new Error("no result");
      return toObservation(ctx.targetId, definition, effectiveOptions(definition), r, createSanitiser([]));
    },
    { browser },
  );
}

const BASE_STYLE = "body{margin:0;padding:16px;font-family:sans-serif;color:#1a1a1a;background:#fff}";
const page = (htmlAttrs: string, body: string, style = ""): string =>
  `<!DOCTYPE html><html${htmlAttrs}><head><meta charset="utf-8"><title>Boulangerie</title><style>${BASE_STYLE}${style}</style></head><body>${body}</body></html>`;
const ORDINARY = "<main><h1>Nos pains</h1><p>Pain de campagne et baguette de tradition.</p></main>";
const XHTML10_STRICT = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">`;
const XHTML11 = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">`;
const xml = (doctype: string, htmlAttrs: string, body = "<p>Pain de campagne et baguette.</p>"): Record<string, string> => ({
  "index.xhtml": `<?xml version="1.0" encoding="utf-8"?>${doctype}<html xmlns="http://www.w3.org/1999/xhtml"${htmlAttrs}><head><title>Page</title><style>${BASE_STYLE}</style></head><body>${body}</body></html>`,
});
const FRAME_NO_LANG = `<!DOCTYPE html><html><head><title>Cadre</title></head><body><p>Texte du cadre.</p></body></html>`;
const FRAME_LANG = `<!DOCTYPE html><html lang="fr"><head><title>Cadre</title></head><body><p>Texte du cadre.</p></body></html>`;

describe("custom/8-3-default-lang-present: steps", () => {
  it("records the pinned text fonts and their list version", () => {
    const fonts = definition.defaultOptions["textFonts"] as { version: string; families: string[] };
    expect(fonts.version).toBe("1.0.0");
    expect(fonts.families).toHaveLength(32);
    expect(fonts.families).toContain("BlinkMacSystemFont");
  });

  it("step 1: HTML, lang on html: no_fault, with the scope examined", async () => {
    const o = await run({ "index.html": page(` lang="fr"`, ORDINARY) });
    expect(o.outcome).toBe("no_fault");
    expect(o.fingerprint).toBe("custom/8-3-default-lang-present:no_fault");
    const s = o.evidence.find((e) => e.kind === "scope_examined");
    expect(s?.locator).toBe("html");
    expect(s?.note).toMatch(/document type HTML .* requiring lang: lang="fr"/);
  });

  it("step 1: XHTML 1.0 served as text/html, lang and xml:lang (read as the attribute named xml:lang): no_fault", async () => {
    const o = await run({ "index.html": `${XHTML10_STRICT}<html xmlns="http://www.w3.org/1999/xhtml" lang="fr" xml:lang="fr"><head><title>P</title></head><body>${ORDINARY}</body></html>` });
    expect(o.outcome).toBe("no_fault");
  });

  it("step 1: XHTML 1.0 served as application/xhtml+xml, xml:lang in the XML namespace: no_fault", async () => {
    const o = await run(xml(XHTML10_STRICT, ` xml:lang="fr"`), "index.xhtml");
    expect(o.outcome).toBe("no_fault");
  });

  it("step 1: XHTML 1.1, xml:lang: no_fault", async () => {
    const o = await run(xml(XHTML11, ` xml:lang="fr"`), "index.xhtml");
    expect(o.outcome).toBe("no_fault");
  });

  it("step 1: other XML (application/xhtml+xml without an XHTML doctype), lang and xml:lang: no_fault", async () => {
    const o = await run(xml("", ` lang="fr" xml:lang="fr"`), "index.xhtml");
    expect(o.outcome).toBe("no_fault");
  });

  it("step 1, frame clause: a cross-site frame with rendered text and no lang: cannot_tell", async () => {
    const o = await run({ "index.html": page(` lang="fr"`, `${ORDINARY}<iframe src="__CROSS_ORIGIN__/frame.html"></iframe>`), "frame.html": FRAME_NO_LANG });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence.at(-1)?.note).toMatch(/frame\.html: its document holds rendered or exposed text and its html element lacks/);
  });

  it("step 1, frame clause: a cross-site frame with lang: no_fault", async () => {
    const o = await run({ "index.html": page(` lang="fr"`, `${ORDINARY}<iframe src="__CROSS_ORIGIN__/frame.html"></iframe>`), "frame.html": FRAME_LANG });
    expect(o.outcome).toBe("no_fault");
    expect(o.evidence[0]?.note).toMatch(/examined: 1,/);
  });

  it("step 1, frame clause: a frame that is not rendered (display:none) is not counted", async () => {
    const o = await run({
      "index.html": page(` lang="fr"`, `${ORDINARY}<iframe style="display:none" src="__CROSS_ORIGIN__/frame.html"></iframe>`),
      "frame.html": FRAME_NO_LANG,
    });
    expect(o.outcome).toBe("no_fault");
  });

  it("step 1, frame clause: a frame whose only text is exposed but not rendered (canvas fallback), no lang: cannot_tell", async () => {
    const o = await run({
      "index.html": page(` lang="fr"`, `${ORDINARY}<iframe src="frame.html"></iframe>`),
      "frame.html": `<!DOCTYPE html><html><head><title>C</title></head><body><canvas width="20" height="20"><p>Texte de repli</p></canvas></body></html>`,
    });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("step 1, frame clause: a frame with no rendered or exposed text and no lang: no_fault", async () => {
    const o = await run({
      "index.html": page(` lang="fr"`, `${ORDINARY}<iframe src="frame.html"></iframe>`),
      "frame.html": `<!DOCTYPE html><html><head><title>C</title></head><body><p hidden>caché</p></body></html>`,
    });
    expect(o.outcome).toBe("no_fault");
  });

  it("step 1, frame clause: a nested frame without lang: cannot_tell", async () => {
    const o = await run({
      "index.html": page(` lang="fr"`, `${ORDINARY}<iframe src="__CROSS_ORIGIN__/outer.html" width="300" height="200"></iframe>`),
      "outer.html": `<!DOCTYPE html><html lang="fr"><head><title>O</title></head><body><iframe src="inner.html"></iframe></body></html>`,
      "inner.html": FRAME_NO_LANG,
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence.at(-1)?.note).toMatch(/inner\.html/);
  });

  it("step 1, frame clause: a rendered frame whose document cannot be read: cannot_tell", async () => {
    const o = await runAltered({ "index.html": page(` lang="fr"`, `${ORDINARY}<iframe src="__CROSS_ORIGIN__/frame.html"></iframe>`), "frame.html": FRAME_LANG }, (ctx) => ({
      ...ctx,
      frames: ctx.frames.map((f) => (f.parent === null ? f : { ...f, readable: false, unreadableReason: "marked unreadable by the test" })),
    }));
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence.at(-1)?.note).toMatch(/cannot be read/);
  });

  it("step 2: an empty lang on html: cannot_tell", async () => {
    const o = await run({ "index.html": page(` lang=""`, ORDINARY) });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/^Step 2:/);
  });

  it("step 2: a whitespace-only lang on html: cannot_tell", async () => {
    const o = await run({ "index.html": page(` lang="  "`, ORDINARY) });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("step 2: HTML with only xml:lang (not the required attribute): cannot_tell", async () => {
    const o = await run({ "index.html": page(` xml:lang="fr"`, ORDINARY) });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/^Step 2:/);
  });

  it("step 2: XHTML 1.0 served as text/html with lang only: cannot_tell", async () => {
    const o = await run({ "index.html": `${XHTML10_STRICT}<html xmlns="http://www.w3.org/1999/xhtml" lang="fr"><head><title>P</title></head><body>${ORDINARY}</body></html>` });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/requiring lang and xml:lang: lang="fr", xml:lang absent/);
  });

  it("step 2: XHTML 1.1 with lang only: cannot_tell", async () => {
    const o = await run(xml(XHTML11, ` lang="fr"`), "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
  });

  it("step 2: an attribute in another case (LANG, in an XML document) is a lang attribute in some form: cannot_tell", async () => {
    const o = await run(xml("", ` LANG="fr"`), "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/^Step 2:/);
  });

  it("step 3: no attribute on html and ordinary text: fault on the first uncovered witness", async () => {
    const o = await run({ "index.html": page("", ORDINARY) });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-3-default-lang-present:uncovered-witness");
    expect(o.evidence[0]?.kind).toBe("dom_node");
    expect(o.evidence[0]?.locator).toBe("html > body > main > h1");
    expect(o.evidence[0]?.snippet).toBe("<h1>Nos pains");
    expect(o.evidence[1]?.locator).toBe("html");
  });

  it("step 3: the first witness in tree order is reported, after nodes that are not witnesses", async () => {
    const o = await run({ "index.html": page("", `<p>A</p><p><a href="#x">Lien vers la suite</a></p><p lang="fr">Couvert</p><p>Premier témoin</p><p>Second témoin</p>`) });
    expect(o.outcome).toBe("fault");
    expect(o.evidence[0]?.locator).toBe("html > body > p:nth-of-type(4)");
  });

  it("step 3: text inserted by script after load can be a witness", async () => {
    const o = await run({
      "index.html": page("", `<script>addEventListener("load", () => { const p = document.createElement("p"); p.textContent = "Ajouté après le chargement"; document.body.append(p); });</script>`),
    });
    expect(o.outcome).toBe("fault");
  });

  it("step 3: a witness in a table cell and in phrasing elements", async () => {
    const o = await run({ "index.html": page("", `<table><tbody><tr><td><span><strong>Horaires du matin</strong></span></td></tr></tbody></table>`) });
    expect(o.outcome).toBe("fault");
    expect(o.evidence[0]?.locator).toBe("html > body > table > tbody > tr > td > span > strong");
  });

  it("step 3: XHTML served as XML (other XML) with neither attribute: fault", async () => {
    const o = await run(xml("", ""), "index.xhtml");
    expect(o.outcome).toBe("fault");
  });

  it("step 3 with a combining mark between two letters: a witness", async () => {
    const o = await run({ "index.html": page("", `<p>ét</p>`) });
    expect(o.outcome).toBe("fault");
  });

  it("step 4: lang on body only: cannot_tell", async () => {
    const o = await run({ "index.html": `<!DOCTYPE html><html><head><title>P</title><style>${BASE_STYLE}</style></head><body lang="fr">${ORDINARY}</body></html>` });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/^Step 4: .*no uncovered witness/);
  });

  it("step 4 (RECORD): an XML document shown in Chromium's XML viewer is not examined: cannot_tell", async () => {
    const o = await run({ "index.xhtml": `<?xml version="1.0"?><html><head><title>x</title></head><body><p>Texte ordinaire</p></body></html>` }, "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/XML viewer/);
  });
});

/** Each case: html without lang, one text that would be a witness but for one condition. Expected: cannot_tell. */
const NOT_A_WITNESS: [string, string, string?][] = [
  // (a) place
  ["(a) under an element with xml:lang (named, in text/html)", `<div xml:lang="fr"><p>Texte couvert</p></div>`],
  ["(a) inside a link", `<p><a href="#s">Texte du lien</a></p>`],
  ["(a) inside a label", `<label>Nom complet <input></label>`],
  ["(a) inside code", `<p><code>texte de code</code></p>`],
  ["(a) under an element with a role", `<div role="region" aria-label="r"><p>Texte de région</p></div>`],
  ["(a) under aria-hidden, whatever its value", `<div aria-hidden="false"><p>Texte visible</p></div>`],
  ["(a) under inert", `<div inert><p>Texte inerte</p></div>`],
  ["(a) under an element with hidden=until-found", `<div hidden="until-found"><p>Texte trouvé</p></div>`],
  ["(a) under body with a role", `<p>Texte ordinaire</p><script>document.body.setAttribute("role", "document")</script>`],
  ["(a) in an open shadow tree", `<div id="h"></div><script>document.getElementById("h").attachShadow({ mode: "open" }).innerHTML = "<p>Texte dans l'ombre</p>";</script>`],
  ["(a) slotted through an open shadow host", `<div id="h"><p>Texte inséré</p></div><script>document.getElementById("h").attachShadow({ mode: "open" }).innerHTML = "<slot></slot>";</script>`],
  ["(a) slotted through a closed shadow host (seen through CDP)", `<div id="h"><p>Texte inséré</p></div><script>document.getElementById("h").attachShadow({ mode: "closed" }).innerHTML = "<slot></slot>";</script>`],
  // (b) letters
  ["(b) single letters only", `<p>A B C 1 2</p>`],
  // (d) font
  ["(d) an icon font family", `<p style="font-family:'Material Icons'">home</p>`],
  ["(d) a listed family that the page defines with @font-face", `<p style="font-family:Arial">Texte en Arial</p>`, `@font-face{font-family:"arial";src:local("Courier New")}`],
  ["(d) a quoted generic name", `<p style="font-family:'serif'">Texte serif</p>`],
  ["(d) a generic family not on the list (cursive)", `<p style="font-family:cursive">Texte cursif</p>`],
  ["(d) one family off the list among listed ones", `<p style="font-family:Arial, Wingdings, sans-serif">Texte mêlé</p>`],
  // (e) paint
  ["(e) an ancestor with opacity below 1", `<div style="opacity:.99"><p>Texte presque opaque</p></div>`],
  ["(e) a filter on an ancestor", `<div style="filter:blur(0)"><p>Texte filtré</p></div>`],
  ["(e) a blend mode on the parent", `<p style="mix-blend-mode:multiply">Texte mêlé</p>`],
  ["(e) a clip-path on an ancestor", `<div style="clip-path:inset(0)"><p>Texte découpé</p></div>`],
  ["(e) visibility hidden", `<p style="visibility:hidden">Texte caché</p>`],
  ["(e) font-size below 8px", `<p style="font-size:7.5px">Texte minuscule</p>`],
  ["(e) a colour with alpha below 1", `<p style="color:rgba(0,0,0,.9)">Texte translucide</p>`],
  ["(e) -webkit-text-security", `<p style="-webkit-text-security:disc">Texte masqué</p>`],
  // (f) contrast
  ["(f) low contrast", `<p style="color:#ddd">Texte pâle</p>`],
  ["(f) a background image on the walk", `<div style="background-image:linear-gradient(#fff,#fff)"><p>Texte sur dégradé</p></div>`],
  ["(f) a semi-transparent background on the walk", `<div style="background:rgba(255,255,255,.5)"><p>Texte sur voile</p></div>`],
  ["(f) a fill colour different from color", `<p style="-webkit-text-fill-color:#000;color:#111">Texte rempli</p>`],
  ["(f) a colour in a space the check does not parse (RECORD)", `<p style="color:oklch(0.2 0 0)">Texte oklch</p>`],
  // (g) geometry
  ["(g) off-screen", `<p style="position:absolute;left:-9999px">Texte hors champ</p>`],
  ["(g) below the viewport as loaded", `<div style="height:2000px"></div><p>Texte plus bas</p>`],
  ["(g) clipped by an ancestor with overflow hidden", `<div style="height:2px;overflow:hidden"><p>Texte rogné</p></div>`],
  ["(g) covered by another element", `<div style="position:relative"><p>Texte couvert</p><div style="position:absolute;inset:0;background:#fff"></div></div>`],
  ["(g) under a pointer-events:none element", `<div style="position:relative"><p>Texte voilé</p><div style="position:absolute;inset:0;pointer-events:none;background:#fff"></div></div>`],
  ["(g) a ::before box on the parent", `<p class="b">Texte précédé</p>`, `.b::before{content:"› "}`],
  ["(g) too small (under 4px high)", `<p style="line-height:3px;height:3px;overflow:hidden;font-size:8px">Texte écrasé</p>`],
];

describe("custom/8-3-default-lang-present: step 4, witness conditions", () => {
  it("the base page of these cases gives a fault (the control)", async () => {
    const o = await run({ "index.html": page("", `<p>Texte ordinaire</p>`) });
    expect(o.outcome).toBe("fault");
  });

  for (const [name, body, style] of NOT_A_WITNESS) {
    it(`not a witness: ${name}`, async () => {
      const o = await run({ "index.html": page("", body, style ?? "") });
      expect(o.outcome).toBe("cannot_tell");
      expect(o.evidence[0]?.note).toMatch(/^Step 4: /);
    });
  }

  it("not a witness: (f) no opaque background and a color-scheme other than normal", async () => {
    const o = await run({
      "index.html": `<!DOCTYPE html><html style="color-scheme:dark"><head><title>P</title><style>body{font-family:sans-serif;color:#fff}</style></head><body><p>Texte sombre</p></body></html>`,
    });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("a witness: no opaque background and color-scheme normal, contrast against white", async () => {
    const o = await run({ "index.html": `<!DOCTYPE html><html><head><title>P</title><style>body{font-family:sans-serif;color:#333}</style></head><body><p>Texte sur blanc</p></body></html>` });
    expect(o.outcome).toBe("fault");
  });

  it("a witness: a listed family other than a generic one", async () => {
    const o = await run({ "index.html": page("", `<p style="font-family:'Helvetica Neue', Arial, -apple-system, BlinkMacSystemFont, sans-serif">Texte listé</p>`) });
    expect(o.outcome).toBe("fault");
  });

  it("not a witness: (c) a node the accessibility tree does not hold (tree intercepted)", async () => {
    // No ordinary, visible, hittable text could be hidden from Chromium's tree
    // without breaking another condition (aria-hidden on html is ignored by
    // Chromium, inert and modal dialogs change hit testing), so the tree is
    // intercepted: getFullAXTree answers with no node.
    const wrapped = new Map<CDPSession, CDPSession>();
    const o = await runAltered({ "index.html": page("", `<p>Texte ordinaire</p>`) }, (ctx) => ({
      ...ctx,
      cdpFor: async (frame: Frame) => {
        const s = await ctx.cdpFor(frame);
        let w = wrapped.get(s);
        if (w === undefined) {
          w = new Proxy(s, {
            get(target, prop) {
              if (prop === "send") {
                return (method: string, params?: object) =>
                  method === "Accessibility.getFullAXTree" ? Promise.resolve({ nodes: [] }) : (target.send as (m: string, p?: object) => Promise<unknown>)(method, params);
              }
              const v = Reflect.get(target, prop) as unknown;
              return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
            },
          });
          wrapped.set(s, w);
        }
        return w;
      },
    }));
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/1 not exposed in the accessibility tree/);
  });
});

describe("custom/8-3-default-lang-present: a large page", () => {
  const many = (n: number, attrs = ""): string => Array.from({ length: n }, (_, i) => `<div class="c"><p${attrs}>Paragraphe numéro ${i} du contenu</p><span>Note ${i}</span></div>`).join("");

  it("walks every text node of a large page with no witness in a few seconds", async () => {
    const t0 = Date.now();
    const o = await run({ "index.html": page("", `<div style="height:0;overflow:hidden">${many(2500)}</div>`) });
    expect(Date.now() - t0).toBeLessThan(15_000);
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/5000 failing the geometry conditions/);
  });

  it("finds a witness after many text nodes that are not, in a few seconds", async () => {
    const t0 = Date.now();
    const o = await run({
      "index.html": page("", `<div role="feed">${many(2500)}</div><p style="position:fixed;top:0;left:0;background:#fff">Témoin final</p>`),
    });
    expect(Date.now() - t0).toBeLessThan(15_000);
    expect(o.outcome).toBe("fault");
    expect(o.evidence[0]?.locator).toBe("html > body > p");
  });

  it("checks exposure of many candidates in batches before finding none exposed", async () => {
    // 60 candidates (more than one batch of 25) fail only on exposure: the tree is intercepted.
    const o = await runAltered({ "index.html": page("", many(30)) }, (ctx) => ({
      ...ctx,
      cdpFor: async (frame: Frame) => {
        const s = await ctx.cdpFor(frame);
        return new Proxy(s, {
          get(target, prop) {
            if (prop === "send") {
              return (method: string, params?: object) =>
                method === "Accessibility.getFullAXTree" ? Promise.resolve({ nodes: [] }) : (target.send as (m: string, p?: object) => Promise<unknown>)(method, params);
            }
            const v = Reflect.get(target, prop) as unknown;
            return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
          },
        });
      },
    }));
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/ \d+ not exposed in the accessibility tree/);
  });
});

describe("custom/8-3-default-lang-present: editable text is never a witness and never reaches the run (Q60)", () => {
  const MARKER = "Synthetic private visitor words";
  const noLang = (body: string, head = ""): Record<string, string> => ({
    "index.html": `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Boulangerie</title>${head}<style>${BASE_STYLE}</style></head><body>${body}</body></html>`,
  });

  it("the control: the same text outside an editable box is a witness and gives a fault", async () => {
    const o = await run(noLang(`<div><span>${MARKER}</span></div>`));
    expect(o.outcome).toBe("fault");
  });

  // Under the record the text of an editable box is a field's value, so it grounds no fault: with no other
  // text there is no witness, and step 4 answers cannot_tell.
  for (const [name, body, head] of [
    ["contenteditable=true", `<div contenteditable="true"><span>${MARKER}</span></div>`, ""],
    ["contenteditable empty and in capitals", `<div CONTENTEDITABLE=""><span>${MARKER}</span></div>`, ""],
    ["plaintext-only", `<div contenteditable="plaintext-only"><p><em>${MARKER}</em></p></div>`, ""],
    ["contenteditable=false inside an editable box", `<div contenteditable="true"><div contenteditable="false"><span>${MARKER}</span></div></div>`, ""],
    ["a shadow host inside an editable box", `<div contenteditable="true"><div id="h"></div></div><script>document.getElementById("h").attachShadow({mode:"open"}).innerHTML="<p>${MARKER}</p>"</script>`, ""],
    ["designMode on", `<div><span>${MARKER}</span></div>`, `<script>document.designMode="on"</script>`],
    ["a textarea", `<textarea>${MARKER}</textarea>`, ""],
  ] as const) {
    it(`${name}: no fault from that text, and the marker is nowhere in the observation`, async () => {
      const o = await run(noLang(body, head));
      expect(o.outcome).toBe("cannot_tell");
      expect(o.evidence[0]?.note).toMatch(/^Step 4: /);
      expect(JSON.stringify(o)).not.toContain(MARKER);
    });
  }

  it("an editable box beside ordinary text: the ordinary text is the witness and the box stays out of the snippet", async () => {
    const o = await run(noLang(`<div contenteditable="true"><span>${MARKER}</span></div><p>Texte ordinaire</p>`));
    expect(o.outcome).toBe("fault");
    expect(JSON.stringify(o)).not.toContain(MARKER);
  });
});
