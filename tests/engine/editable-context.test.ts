/**
 * The engine guard, first slice (M3 privacy design 2.1, 3.4a, 3.5, 3.6), on
 * small synthetic pages through `withTarget`. Markers are `zz`-prefixed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import type { CheckContext, Derivation } from "../../src/checks/types.ts";
import { launchBrowser } from "../../src/engine/index.ts";
import {
  attributeFingerprintWithholding,
  buildFingerprint,
  derivePiece,
  fingerprintNote,
  WITHHELD_PART,
} from "../../src/engine/editable-context.ts";
import type { DeriveOptions, Piece } from "../../src/engine/editable-context.ts";
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

type Shape = "outer" | "startTag" | "startTagAndText";

/** Derive one snippet from the element `selector` finds in the main frame (or its first text node, for startTagAndText). */
async function snippetOf(ctx: CheckContext, selector: string, shape: Shape, options: DeriveOptions = {}): Promise<Piece> {
  const frame = ctx.frames[0]?.frame;
  if (frame === undefined) throw new Error("no frame");
  const el = await frame.$(selector);
  if (el === null) throw new Error(`no ${selector}`);
  const handle = shape === "startTagAndText" ? await el.evaluateHandle("(e) => e.firstChild" as never) : el;
  const d: Derivation = { source: { node: { frame: { frame }, handle } }, kind: "snippet", shape };
  return derivePiece(d, ctx, sanitiser, options);
}

async function deriveOn(ctx: CheckContext, selector: string, make: (src: Derivation["source"]) => Derivation): Promise<Piece> {
  const frame = ctx.frames[0]?.frame;
  if (frame === undefined) throw new Error("no frame");
  const handle = await frame.$(selector);
  if (handle === null) throw new Error(`no ${selector}`);
  return derivePiece(make({ node: { frame: { frame }, handle } }), ctx, sanitiser);
}

const run = <T>(body: string, fn: (ctx: CheckContext) => Promise<T>, extra = ""): Promise<T> =>
  withTarget({ "index.html": page(body) + extra }, fn, { browser });

describe("editable-context: plain and fields", () => {
  it("keeps a plain control's text", async () => {
    const p = await run(`<div id="w"><p class="zzc">zzplain text</p><a href="#top">zzlink</a></div>`, (ctx) => snippetOf(ctx, "#w", "outer"));
    expect(p).toEqual({ value: `<div id="w"><p class="zzc">zzplain text</p><a href="#top">zzlink</a></div>`, redactions: 0, withheld: false });
  });

  it("serialises a field inside a plain ancestor under the field rule", async () => {
    const p = await run(
      `<div id="w"><label for="f">zzlabel</label><input id="f" name="zzname" value="zzsecretvalue" data-x="zzdata" aria-label="zzaria"></div>`,
      (ctx) => snippetOf(ctx, "#w", "outer"),
    );
    expect(p.withheld).toBe(false);
    expect(p.value).toBe(
      `<div id="w"><label for="f">zzlabel</label><input id="f" name="zzname" value="${MASK}" data-x="${MASK}" aria-label="zzaria"></div>`,
    );
    expect(p.redactions).toBe(2);
    expect(p.value).not.toContain("zzsecretvalue");
  });

  it("withholds a live value reflected into the field's title and into a neighbour", async () => {
    const p = await run(
      `<div id="w"><input id="f" title="you typed zzlive" value="x"><span data-echo="zzlive">echo zzLIVE here</span></div>`,
      async (ctx) => {
        await ctx.page.fill("#f", "zzlive");
        return snippetOf(ctx, "#w", "outer");
      },
    );
    expect(p.value).not.toMatch(/zzlive/i);
    // title (allow-listed, contains the value), value attribute (not allow-listed), data-echo, the neighbour's text.
    expect(p.value).toBe(`<div id="w"><input id="f" title="${MASK}" value="${MASK}"><span data-echo="${MASK}">${MASK}</span></div>`);
    expect(p.redactions).toBe(4);
  });

  it("withholds a one-character value's reflection, and the field's own attribute piece", async () => {
    const p = await run(`<input id="f" placeholder="zz a b" value="a">`, (ctx) => snippetOf(ctx, "#f", "startTag"));
    expect(p.value).toBe(`<input id="f" placeholder="${MASK}" value="${MASK}">`);
    const a = await run(`<input id="f" placeholder="zz a b" value="a">`, (ctx) =>
      deriveOn(ctx, "#f", (source) => ({ source, kind: "attr", name: "placeholder" })),
    );
    expect(a).toMatchObject({ value: MASK, redactions: 1, withheld: true, reason: "value-match" });
    const kept = await run(`<input id="f" placeholder="zzhint" value="">`, (ctx) =>
      deriveOn(ctx, "#f", (source) => ({ source, kind: "attr", name: "placeholder" })),
    );
    expect(kept).toEqual({ value: "zzhint", redactions: 0, withheld: false });
  });

  it("drops checked and selected, and withholds option contents", async () => {
    const p = await run(
      `<div id="w"><input id="c" type="checkbox" checked><select name="s"><option value="zzo1" selected>zzopt1</option><option>zzopt2</option></select></div>`,
      (ctx) => snippetOf(ctx, "#w", "outer"),
    );
    expect(p.value).toBe(`<div id="w"><input id="c" type="checkbox"><select name="s">${MASK}${MASK}</select></div>`);
    expect(p.value).not.toMatch(/checked|selected|zzopt|zzo1/);
    expect(p.redactions).toBe(2);
  });

  it("withholds a textarea's content", async () => {
    const p = await run(`<div id="w"><textarea name="t">zzprivate text</textarea></div>`, (ctx) => snippetOf(ctx, "#w", "outer"));
    expect(p.value).toBe(`<div id="w"><textarea name="t">${MASK}</textarea></div>`);
    expect(p.redactions).toBe(1);
  });
});

describe("editable-context: protected context", () => {
  it("replaces an editable descendant whole", async () => {
    const p = await run(
      `<div id="w"><p>zzkeep</p><div contenteditable="true"><b>zzbox</b> text</div><div role="textbox">zzrole</div></div>`,
      (ctx) => snippetOf(ctx, "#w", "outer"),
    );
    expect(p.value).toBe(`<div id="w"><p>zzkeep</p>${MASK}${MASK}</div>`);
    expect(p.redactions).toBe(2);
  });

  it("withholds the whole piece when the source itself is in an editable box", async () => {
    const p = await run(`<div contenteditable><p id="in">zzinside</p></div>`, (ctx) => snippetOf(ctx, "#in", "outer"));
    expect(p).toEqual({ value: MASK, redactions: 1, withheld: true, reason: "protected" });
  });

  it("withholds in a designMode document", async () => {
    const p = await run(`<p id="p">zzdesign</p><script>document.designMode = "on";</script>`, (ctx) => snippetOf(ctx, "#p", "outer"));
    expect(p).toMatchObject({ value: MASK, withheld: true, reason: "protected" });
  });

  const shadow = (editable: boolean): string => `
    <div id="w"><zz-host id="h"><a id="slotted" href="#x">zzslotted link</a></zz-host></div>
    <script>
      const root = document.getElementById("h").attachShadow({ mode: "open" });
      root.innerHTML = '<div ${editable ? 'contenteditable="true"' : ""}><slot></slot></div>';
    </script>`;

  it("withholds a light-DOM child slotted under an editable shadow element", async () => {
    const own = await run(shadow(true), (ctx) => snippetOf(ctx, "#slotted", "outer"));
    expect(own).toMatchObject({ value: MASK, withheld: true, reason: "protected" });
    const host = await run(shadow(true), (ctx) => snippetOf(ctx, "#w", "outer"));
    expect(host.value).toBe(`<div id="w"><zz-host id="h">${MASK}</zz-host></div>`);
    expect(host.redactions).toBe(1);
  });

  it("keeps the slotted child when the shadow element is not editable (control)", async () => {
    const own = await run(shadow(false), (ctx) => snippetOf(ctx, "#slotted", "outer"));
    expect(own).toEqual({ value: `<a id="slotted" href="#x">zzslotted link</a>`, redactions: 0, withheld: false });
    const host = await run(shadow(false), (ctx) => snippetOf(ctx, "#w", "outer"));
    expect(host.value).toBe(`<div id="w"><zz-host id="h"><a id="slotted" href="#x">zzslotted link</a></zz-host></div>`);
  });

  it("walks template content and applies the box and field rules there", async () => {
    const p = await run(
      `<div id="w"><template><p>zztpl plain</p><div contenteditable>zztplbox</div><input value="zztplval"></template></div>`,
      (ctx) => snippetOf(ctx, "#w", "outer"),
    );
    expect(p.value).toBe(`<div id="w"><template><p>zztpl plain</p>${MASK}<input value="${MASK}"></template></div>`);
    expect(p.redactions).toBe(2);
  });

  it("withholds a frame's content when its frame element is in an editable box, and keeps it otherwise", async () => {
    const files = (editable: boolean): Record<string, string> => ({
      "index.html": page(editable ? `<div contenteditable><iframe src="f.html"></iframe></div>` : `<div><iframe src="f.html"></iframe></div>`),
      "f.html": page(`<p id="p">zzframed</p>`),
    });
    const inFrame = async (ctx: CheckContext): Promise<Piece> => {
      const frame = ctx.frames[1]?.frame;
      if (frame === undefined) throw new Error("no child frame");
      const handle = await frame.$("#p");
      if (handle === null) throw new Error("no #p");
      return derivePiece({ source: { node: { frame: { frame }, handle } }, kind: "snippet", shape: "outer" }, ctx, sanitiser);
    };
    const prot = await withTarget(files(true), inFrame, { browser });
    expect(prot).toMatchObject({ value: MASK, withheld: true, reason: "protected-frame" });
    const plain = await withTarget(files(false), inFrame, { browser });
    expect(plain).toEqual({ value: `<p id="p">zzframed</p>`, redactions: 0, withheld: false });
  });
});

describe("editable-context: decoding, escaping, failure", () => {
  it("matches decoded values with ampersand, quote and non-ASCII, then escapes at serialisation", async () => {
    const value = `zz Ä&"é`;
    const p = await run(
      `<div id="w"><input id="f" title="zz-plain &amp; &quot;ok&quot; é"><span data-v="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">zz ä&amp;"É</span></div>`,
      async (ctx) => {
        await ctx.page.fill("#f", value);
        return snippetOf(ctx, "#w", "outer");
      },
    );
    // The title has no current value: kept, escaped at serialisation. The span's attribute and text match after normalisation.
    expect(p.value).toBe(`<div id="w"><input id="f" title="zz-plain &amp; &quot;ok&quot; é" value="${MASK}"><span data-v="${MASK}">${MASK}</span></div>`);
    expect(p.redactions).toBe(3);
  });

  it("withholds the whole composite with count 1 on a forced failure", async () => {
    const p = await run(
      `<div id="w"><input value="zzv"><p>zzpartial</p><div contenteditable>zzbox</div></div>`,
      (ctx) => snippetOf(ctx, "#w", "outer", { failAt: 3 }),
    );
    expect(p).toEqual({ value: MASK, redactions: 1, withheld: true, reason: "evaluation-failed" });
  });

  it("guards startTagAndText: the parent's start tag and one text node", async () => {
    const p = await run(`<p id="p" lang="zz">zztext &amp; more</p>`, (ctx) => snippetOf(ctx, "#p", "startTagAndText"));
    expect(p).toEqual({ value: `<p id="p" lang="zz">zztext &amp; more`, redactions: 0, withheld: false });
    const t = await run(`<textarea id="t" name="zzn">zzsecret</textarea>`, (ctx) => snippetOf(ctx, "#t", "startTagAndText"));
    expect(t.value).toBe(`<textarea id="t" name="zzn">${MASK}`);
  });

  it("withholds an unparsed noscript raw fragment inside a composite", async () => {
    const p = await run(`<div id="w"><noscript><a href="#a">zzns</a></noscript><p>zzafter</p></div>`, (ctx) => snippetOf(ctx, "#w", "outer"));
    expect(p.value).toBe(`<div id="w"><noscript>${MASK}</noscript><p>zzafter</p></div>`);
    expect(p.redactions).toBe(1);
  });

  it("withholds an unsupported derivation kind", async () => {
    const p = await run(`<p id="p">zz</p>`, (ctx) => deriveOn(ctx, "#p", (source) => ({ source, kind: "accname" })));
    expect(p).toMatchObject({ value: MASK, redactions: 1, withheld: true, reason: "unsupported-kind" });
  });
});

describe("editable-context: fingerprints and counts", () => {
  it("builds a fingerprint from plain parts and [withheld] parts", async () => {
    const fp = await run(`<p id="a">zzA</p><div contenteditable><p id="b">zzB</p></div>`, async (ctx) => {
      const frame = ctx.frames[0]?.frame;
      if (frame === undefined) throw new Error("no frame");
      const a = await frame.$("#a");
      const b = await frame.$("#b");
      if (a === null || b === null) throw new Error("missing");
      return buildFingerprint(
        "custom/zz",
        { label: "zzlabel", parts: [{ source: { node: { frame: { frame }, handle: a } }, kind: "id" }, { source: { node: { frame: { frame }, handle: b } }, kind: "id" }] },
        ["zzlabel"],
        ctx,
        sanitiser,
      );
    });
    expect(fp).toEqual({ value: `custom/zz:zzlabel:a|${WITHHELD_PART}`, withheldParts: 1 });
  });

  it("attributes withheld fingerprint parts once to evidence[0]", () => {
    const ev = attributeFingerprintWithholding(
      [
        { id: "e001", kind: "dom_node", locator: "#a", snippet: "<p>", note: "zznote", redactions: 2 },
        { id: "e002", kind: "dom_node", locator: "#b", snippet: "<p>", redactions: 0 },
      ],
      3,
      "e003",
    );
    expect(ev[0]).toMatchObject({ redactions: 5, note: `zznote ${fingerprintNote(3)}` });
    expect(ev[1]).toMatchObject({ redactions: 0 });
    expect(attributeFingerprintWithholding([], 2, "e001")).toEqual([{ id: "e001", kind: "text", note: fingerprintNote(2), redactions: 2 }]);
  });
});
