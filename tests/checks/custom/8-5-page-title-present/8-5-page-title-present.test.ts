/**
 * custom/8-5-page-title-present, one test per numbered branch of its record,
 * plus SVG titles, template contents, open and closed shadow trees, noscript
 * text, cross-site and nested frames, a frame in a shadow tree, XHTML and a
 * title set by script after load. Every result goes through the engine's
 * sanitiser and ObservationSchema (`observe`, or `toObservation` for the one
 * test that marks a frame unreadable).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { createSanitiser, effectiveOptions, launchBrowser, toObservation } from "../../../../src/engine/index.ts";
import { observe, withTarget } from "../../../../src/engine/testing/index.ts";
import type { Observation } from "../../../../src/schema/index.ts";
import type { CheckContext } from "../../../../src/checks/types.ts";
import { BLANK_CODE_POINTS, ID, definition, pageTitleProvider } from "../../../../src/checks/custom/8-5-page-title-present/index.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

async function run(files: Record<string, string>, page?: string): Promise<Observation> {
  const obs = await observe(pageTitleProvider, files, { browser, ...(page === undefined ? {} : { page }) });
  expect(obs).toHaveLength(1);
  const o = obs[0];
  if (o === undefined) throw new Error("no observation");
  expect(o.checkId).toBe(ID);
  expect(o.checkVersion).toBe("1.0.2");
  return o;
}

/** Run with a changed context (a frame marked unreadable), validating the result as the engine does. */
async function runAltered(files: Record<string, string>, alter: (ctx: CheckContext) => CheckContext): Promise<Observation> {
  return withTarget(
    files,
    async (ctx) => {
      const results = await pageTitleProvider.run(alter(ctx));
      const r = results.get(ID);
      if (r === undefined) throw new Error("no result");
      return toObservation(ctx.targetId, definition, effectiveOptions(definition), r, createSanitiser([]));
    },
    { browser },
  );
}

const doc = (head: string, body = "<p>Contenu de la page.</p>"): string =>
  `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
const FRAME_WITH_TITLE = doc("<title>Cadre</title>", "<p>Texte du cadre.</p>");
const FRAME_WITHOUT_TITLE = doc("", "<p>Texte du cadre.</p>");

describe("custom/8-5-page-title-present", () => {
  it("records the blank-looking characters and their list version", () => {
    expect(BLANK_CODE_POINTS).toEqual([0x115f, 0x1160, 0x3164, 0xffa0]);
    expect(definition.defaultOptions).toEqual({ blankCharacters: { version: "1.0.0", codePoints: ["U+115F", "U+1160", "U+3164", "U+FFA0"] } });
  });

  // (1)
  it("step 1: a text file the browser wraps in a page: cannot_tell", async () => {
    const o = await run({ "index.txt": "Bonjour <title>x</title>" }, "index.txt");
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/^Step 1: .*text\/plain/);
  });

  it("step 1: a document served as application/xhtml+xml whose element is not an HTML html element: cannot_tell", async () => {
    // The style sheet keeps Chromium from replacing the document with its XML viewer.
    const o = await run(
      {
        "index.xhtml": `<?xml version="1.0"?><?xml-stylesheet type="text/css" href="s.css"?><html><head><title>x</title></head><body><p>x</p></body></html>`,
        "s.css": "p { display: block }",
      },
      "index.xhtml",
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/^Step 1: .*not an HTML html element/);
  });

  it("step 1: an XML feed served with its own content type: cannot_tell", async () => {
    const o = await run({ "feed.xml": `<?xml version="1.0"?><rss><channel><title>Flux</title></channel></rss>` }, "feed.xml");
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/^Step 1: /);
  });

  it("step 1 (RECORD): an XML document shown in Chromium's XML viewer, a page the browser builds around it: cannot_tell", async () => {
    const o = await run({ "index.xhtml": `<?xml version="1.0"?><html><head><title>x</title></head><body><p>x</p></body></html>` }, "index.xhtml");
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/^Step 1: .*XML viewer/);
  });

  // (2)
  it("step 2: no title element anywhere: fault, located at head", async () => {
    const o = await run({ "index.html": doc("") });
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-5-page-title-present:no-title-element");
    expect(o.evidence[0]?.kind).toBe("dom_node");
    expect(o.evidence[0]?.locator).toBe("html > head");
    expect(o.evidence[0]?.snippet).toBe("<head>");
  });

  it("step 2: an SVG title is not a title element: fault", async () => {
    const o = await run({ "index.html": doc("", `<svg width="10" height="10"><title>Icône</title><circle r="3"/></svg><p>x</p>`) });
    expect(o.outcome).toBe("fault");
  });

  it("step 2: a fault wins over a frame that cannot be read", async () => {
    const o = await runAltered({ "index.html": doc("", `<iframe src="__CROSS_ORIGIN__/frame.html"></iframe>`), "frame.html": FRAME_WITH_TITLE }, (ctx) => ({
      ...ctx,
      frames: ctx.frames.map((f) => (f.parent === null ? f : { ...f, readable: false, unreadableReason: "marked unreadable by the test" })),
    }));
    expect(o.outcome).toBe("fault");
  });

  it("step 2 does not hold: a title only in a template's content gives cannot_tell (step 4)", async () => {
    const o = await run({ "index.html": doc("<template><title>Modèle</title></template>") });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence.at(-1)?.note).toMatch(/^Step 4: the document tree has no title element/);
  });

  it("step 2 does not hold: a title only in an open shadow tree gives cannot_tell", async () => {
    const o = await run({
      "index.html": doc("", `<div id="h"></div><script>document.getElementById("h").attachShadow({ mode: "open" }).innerHTML = "<title>Ombre</title>";</script>`),
    });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("step 2 does not hold: a title only in a closed shadow tree gives cannot_tell", async () => {
    const o = await run({
      "index.html": doc("", `<div id="h"></div><script>document.getElementById("h").attachShadow({ mode: "closed" }).innerHTML = "<title>Ombre</title>";</script>`),
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/closed shadow trees/);
  });

  it("step 2 does not hold: noscript text containing <TITLE in another ASCII case gives cannot_tell", async () => {
    const o = await run({ "index.html": doc("<noscript><TITLE>Sans script</TITLE></noscript>") });
    expect(o.outcome).toBe("cannot_tell");
  });

  // (3)
  it("step 3: a title child of head with a letter: no_fault, with the scope examined", async () => {
    const o = await run({ "index.html": doc("<title>Boulangerie des Tilleuls</title>") });
    expect(o.outcome).toBe("no_fault");
    expect(o.fingerprint).toBe("custom/8-5-page-title-present:no_fault");
    const s = o.evidence.find((e) => e.kind === "scope_examined");
    expect(s?.locator).toBe("html > head > title");
    expect(s?.note).toMatch(/Rendered iframe or frame elements examined: 0/);
  });

  it("step 3: digits qualify (general category N)", async () => {
    const o = await run({ "index.html": doc("<title>404</title>") });
    expect(o.outcome).toBe("no_fault");
  });

  it("step 3: a title set by script after load (document.title creates one in head): no_fault", async () => {
    const o = await run({ "index.html": doc("", `<p>x</p><script>addEventListener("load", () => { document.title = "Titre posé par script"; });</script>`) });
    expect(o.outcome).toBe("no_fault");
  });

  it("step 3: XHTML served as XML, title in head: no_fault", async () => {
    const o = await run(
      {
        "index.xhtml": `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr"><head><title>Page XHTML</title></head><body><p>x</p></body></html>`,
      },
      "index.xhtml",
    );
    expect(o.outcome).toBe("no_fault");
  });

  it("step 3: a cross-site frame with a qualifying title: no_fault", async () => {
    const o = await run({ "index.html": doc("<title>Page</title>", `<iframe src="__CROSS_ORIGIN__/frame.html"></iframe>`), "frame.html": FRAME_WITH_TITLE });
    expect(o.outcome).toBe("no_fault");
    expect(o.evidence[0]?.note).toMatch(/examined: 1,/);
  });

  it("step 3 exception: a cross-site frame with rendered text and no title: cannot_tell", async () => {
    const o = await run({ "index.html": doc("<title>Page</title>", `<iframe src="__CROSS_ORIGIN__/frame.html"></iframe>`), "frame.html": FRAME_WITHOUT_TITLE });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence.at(-1)?.note).toMatch(/^Step 3: .*frame\.html: its document holds rendered or exposed text/);
  });

  it("step 3 exception: a same-origin frame whose only text is exposed but not rendered (canvas fallback): cannot_tell", async () => {
    const o = await run({
      "index.html": doc("<title>Page</title>", `<iframe src="frame.html"></iframe>`),
      "frame.html": doc("", `<canvas width="20" height="20"><p>Texte de repli</p></canvas>`),
    });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("step 3 exception: a cross-site frame whose only text is exposed but not rendered: cannot_tell", async () => {
    const o = await run({
      "index.html": doc("<title>Page</title>", `<iframe src="__CROSS_ORIGIN__/frame.html"></iframe>`),
      "frame.html": doc("", `<canvas width="20" height="20"><p>Texte de repli</p></canvas>`),
    });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("step 3: a frame without title whose text is neither rendered nor exposed: no_fault", async () => {
    const o = await run({
      "index.html": doc("<title>Page</title>", `<iframe src="frame.html"></iframe>`),
      "frame.html": doc("", `<p hidden>Texte caché</p><script>var a = "script text";</script>`),
    });
    expect(o.outcome).toBe("no_fault");
  });

  it("step 3: a frame without title that is not rendered (display:none): no_fault", async () => {
    const o = await run({
      "index.html": doc("<title>Page</title>", `<iframe style="display:none" src="__CROSS_ORIGIN__/frame.html"></iframe>`),
      "frame.html": FRAME_WITHOUT_TITLE,
    });
    expect(o.outcome).toBe("no_fault");
    expect(o.evidence[0]?.note).toMatch(/examined: 0,/);
  });

  it("step 3: an object element is not an iframe or frame", async () => {
    const o = await run({
      "index.html": doc("<title>Page</title>", `<object data="frame.html" type="text/html" width="100" height="50"></object>`),
      "frame.html": FRAME_WITHOUT_TITLE,
    });
    expect(o.outcome).toBe("no_fault");
  });

  it("step 3 exception: a rendered frame whose document cannot be read: cannot_tell", async () => {
    const o = await runAltered(
      { "index.html": doc("<title>Page</title>", `<iframe src="__CROSS_ORIGIN__/frame.html"></iframe>`), "frame.html": FRAME_WITH_TITLE },
      (ctx) => ({ ...ctx, frames: ctx.frames.map((f) => (f.parent === null ? f : { ...f, readable: false, unreadableReason: "marked unreadable by the test" })) }),
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence.at(-1)?.note).toMatch(/cannot be read \(marked unreadable by the test\)/);
  });

  it("step 3 exception: a nested frame (frame in a frame) without title: cannot_tell", async () => {
    const o = await run({
      "index.html": doc("<title>Page</title>", `<iframe src="__CROSS_ORIGIN__/outer.html" width="300" height="200"></iframe>`),
      "outer.html": doc("<title>Externe</title>", `<iframe src="inner.html"></iframe>`),
      "inner.html": FRAME_WITHOUT_TITLE,
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence.at(-1)?.note).toMatch(/inner\.html/);
  });

  it("step 3 exception: a frame inside a shadow tree, without title: cannot_tell", async () => {
    const o = await run({
      "index.html": doc(
        "<title>Page</title>",
        `<div id="h"></div><script>document.getElementById("h").attachShadow({ mode: "open" }).innerHTML = '<iframe src="__CROSS_ORIGIN__/frame.html"></iframe>';</script>`,
      ),
      "frame.html": FRAME_WITHOUT_TITLE,
    });
    expect(o.outcome).toBe("cannot_tell");
  });

  // (4)
  it("step 4: an empty title: cannot_tell", async () => {
    const o = await run({ "index.html": doc("<title></title>") });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence.at(-1)?.note).toMatch(/^Step 4: the first title element is empty/);
  });

  it("step 4: whitespace, punctuation and symbols only: cannot_tell", async () => {
    for (const t of ["   ", "— · —", "★ ☆ →", "&nbsp;"]) {
      const o = await run({ "index.html": doc(`<title>${t}</title>`) });
      expect(o.outcome, t).toBe("cannot_tell");
    }
  });

  it("step 4: blank-looking characters only (U+3164, U+115F, U+1160, U+FFA0): cannot_tell", async () => {
    const o = await run({ "index.html": doc("<title>ㅤᅟᅠﾠ</title>") });
    expect(o.outcome).toBe("cannot_tell");
  });

  it("step 4: the first title is outside head: cannot_tell", async () => {
    const o = await run({ "index.html": doc("", `<title>Titre dans le corps</title><p>x</p>`) });
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence.at(-1)?.note).toMatch(/not a child of head/);
  });

  it("step 4: the first title is empty and a second one is filled: cannot_tell", async () => {
    const o = await run({ "index.html": doc("<title></title><title>Second titre</title>") });
    expect(o.outcome).toBe("cannot_tell");
  });
});

describe("custom/8-5-page-title-present: a title inside an editable box (Q60)", () => {
  it("its text is masked in the snippet and counted as a redaction", async () => {
    const MARKER = "Synthetic private visitor words";
    const o = await run({ "index.html": `<!DOCTYPE html><html lang="fr"><head></head><body><div contenteditable="true"><title>${MARKER}</title></div></body></html>` });
    expect(JSON.stringify(o)).not.toContain(MARKER);
    expect(o.evidence.some((e) => (e.redactions ?? 0) > 0)).toBe(true);
  });
});
