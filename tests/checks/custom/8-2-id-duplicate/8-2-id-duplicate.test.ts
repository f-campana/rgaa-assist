/**
 * custom/8-2-id-duplicate, one test per numbered branch of its record, plus
 * hidden elements (they count), SVG and MathML, a cross-site frame, a shadow
 * tree, template contents, XHTML (case and namespaces) and an element
 * inserted by script after load. Every result goes through the engine's
 * sanitiser and ObservationSchema (`observe`).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { launchBrowser } from "../../../../src/engine/index.ts";
import { observe } from "../../../../src/engine/testing/index.ts";
import type { Observation } from "../../../../src/schema/index.ts";
import { ID, definition, idDuplicateProvider } from "../../../../src/checks/custom/8-2-id-duplicate/index.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

async function run(files: Record<string, string>, page?: string): Promise<Observation> {
  const obs = await observe(idDuplicateProvider, files, { browser, ...(page === undefined ? {} : { page }) });
  expect(obs).toHaveLength(1);
  const o = obs[0];
  if (o === undefined) throw new Error("no observation");
  expect(o.checkId).toBe(ID);
  expect(o.checkVersion).toBe("1.0.0");
  return o;
}

const page = (body: string, head = "<title>Page</title>"): string =>
  `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

describe("custom/8-2-id-duplicate", () => {
  it("declares version 1.0.0 and no options", () => {
    expect(definition.version).toBe("1.0.0");
    expect(definition.defaultOptions).toEqual({});
  });

  it("step 1: no doctype node gives cannot_tell, even with a duplicate id", async () => {
    const o = await run({ "index.html": `<html lang="fr"><head><title>x</title></head><body><p id="a">1</p><p id="a">2</p></body></html>` });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.fingerprint).toBe("custom/8-2-id-duplicate:cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/^Step 1: document\.doctype is null/);
  });

  it("step 1: an XHTML document served as XML without a doctype gives cannot_tell", async () => {
    const o = await run(
      {
        "index.xhtml": `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr"><head><title>x</title></head><body><p id="a">1</p><p id="a">2</p></body></html>`,
      },
      "index.xhtml",
    );
    expect(o.outcome).toBe("cannot_tell");
  });

  it("step 3: two elements with the same id give a fault naming both, with the value", async () => {
    const o = await run({ "index.html": page(`<main><div id="formulaire">A</div><p>texte</p><div id="formulaire"></div></main>`) });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-2-id-duplicate:id=formulaire");
    const nodes = o.evidence.filter((e) => e.kind === "dom_node");
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.locator).toBe("html > body > main > div:nth-of-type(1)");
    expect(nodes[1]?.locator).toBe("html > body > main > div:nth-of-type(2)");
    expect(nodes[0]?.snippet).toBe('<div id="formulaire">');
    expect(nodes[0]?.note).toContain('"formulaire"');
  });

  it("step 3: the first pair in tree order is reported (earliest element with a later duplicate)", async () => {
    const o = await run({ "index.html": page(`<p id="x">1</p><p id="y">2</p><p id="y">3</p><p id="x">4</p>`) });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-2-id-duplicate:id=x");
    expect(o.evidence.filter((e) => e.kind === "dom_node").map((e) => e.locator)).toEqual(["html > body > p:nth-of-type(1)", "html > body > p:nth-of-type(4)"]);
    expect(o.evidence.some((e) => e.kind === "text" && e.note?.includes("1 other id value"))).toBe(true);
  });

  it("step 2: hidden elements count (hidden attribute, display:none, inside a closed details)", async () => {
    const o = await run({ "index.html": page(`<div id="horaires" hidden></div><details><summary>s</summary><p id="horaires" style="display:none">h</p></details>`) });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-2-id-duplicate:id=horaires");
  });

  it("step 2: SVG and MathML elements are collected with HTML ones", async () => {
    const o = await run({ "index.html": page(`<p id="icone">x</p><svg width="10" height="10"><circle id="icone" r="2"/></svg><math><mi id="m">x</mi></math><span id="m"></span>`) });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-2-id-duplicate:id=icone");
    expect(o.evidence.some((e) => e.note?.includes("1 other id value"))).toBe(true);
  });

  it("step 2: an element inserted by script after load is collected", async () => {
    const o = await run({
      "index.html": page(`<div id="formulaire">A</div><script>addEventListener("load", () => { const d = document.createElement("div"); d.id = "formulaire"; document.body.append(d); });</script>`),
    });
    expect(o.outcome).toBe("fault");
  });

  it("step 3: values that differ only in case are never a fault", async () => {
    const o = await run({ "index.html": page(`<p id="Titre">1</p><p id="titre">2</p>`) });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("step 2: empty and whitespace-only values are not collected, so never a fault", async () => {
    const o = await run({ "index.html": page(`<p id="">1</p><p id="">2</p><p id=" ">3</p><p id=" ">4</p><p id="\t\n">5</p><p id="\t\n">6</p>`) });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/^Step 4: 0 element\(s\) with a non-blank id/);
  });

  it("step 2: a value with surrounding whitespace is compared as is, code point for code point", async () => {
    const same = await run({ "index.html": page(`<p id=" a ">1</p><p id=" a ">2</p>`) });
    expect(same.outcome).toBe("fault");
    const differ = await run({ "index.html": page(`<p id="a">1</p><p id=" a">2</p>`) });
    expect(differ.outcome).toBe("cannot_tell");
  });

  it("step 4: unique ids give cannot_tell, never no_fault", async () => {
    const o = await run({ "index.html": page(`<header id="haut">h</header><main id="contenu"><p id="intro">x</p></main>`) });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.kind).toBe("scope_examined");
    expect(o.evidence[0]?.note).toMatch(/^Step 4: 3 element\(s\) with a non-blank id/);
  });

  it("not examined: template contents, shadow trees, noscript text and a cross-site frame", async () => {
    const o = await run({
      "index.html": page(
        `<p id="a">x</p><template><p id="a">t</p></template><div id="host"></div><noscript><p id="a">n</p></noscript><iframe src="__CROSS_ORIGIN__/frame.html"></iframe>` +
          `<script>document.getElementById("host").attachShadow({ mode: "open" }).innerHTML = '<p id="a">s</p><p id="host">s</p>';</script>`,
      ),
      "frame.html": `<!DOCTYPE html><html lang="fr"><head><title>f</title></head><body><p id="a">f</p><p id="a">f</p></body></html>`,
    });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("XHTML: an attribute named ID is not id, and an element outside the three namespaces is not collected", async () => {
    const o = await run(
      {
        "index.xhtml":
          `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "xhtml11.dtd">` +
          `<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr"><head><title>x</title></head><body>` +
          `<p id="a">1</p><p ID="a">2</p><x:item xmlns:x="urn:example" id="a">3</x:item></body></html>`,
      },
      "index.xhtml",
    );
    expect(o.outcome).toBe("cannot_tell");
  });

  it("XHTML: a duplicate id in an XHTML document with a doctype gives a fault", async () => {
    const o = await run(
      {
        "index.xhtml":
          `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "xhtml11.dtd">` +
          `<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr"><head><title>x</title></head><body><p id="a">1</p><div id="a"/></body></html>`,
      },
      "index.xhtml",
    );
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-2-id-duplicate:id=a");
  });

  it("an attribute named id in a namespace is not collected", async () => {
    const o = await run({
      "index.html": page(`<p id="a">1</p><p>2</p><script>document.querySelectorAll("p")[1].setAttributeNS("urn:example", "x:id", "a");</script>`),
    });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("reads a large page in a few seconds", async () => {
    const rows = Array.from({ length: 4000 }, (_, i) => `<li id="item-${i}"><span>Article ${i}</span></li>`).join("");
    const t0 = Date.now();
    const o = await run({ "index.html": page(`<ul>${rows}</ul><div id="item-3999"></div>`) });
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-2-id-duplicate:id=item-3999");
  });
});
