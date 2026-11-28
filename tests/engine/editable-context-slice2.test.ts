/**
 * The engine guard, second slice: closed shadow roots, locator, accname,
 * accvalue, frameUrl, note templates and locatorList (M3 privacy design 2.1,
 * 3.2 to 3.4a). Markers are `zz`-prefixed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Frame } from "playwright";
import type { CheckContext, DeclaredText, Derivation } from "../../src/checks/types.ts";
import { launchBrowser } from "../../src/engine/index.ts";
import { deriveEvidence, deriveNote, derivePiece, PROTECTED_NOTE, UndeclaredTextError } from "../../src/engine/editable-context.ts";
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
const mainFrame = (ctx: CheckContext): Frame => {
  const f = ctx.frames[0]?.frame;
  if (f === undefined) throw new Error("no frame");
  return f;
};
const run = <T>(body: string, fn: (ctx: CheckContext, frame: Frame) => Promise<T>): Promise<T> =>
  withTarget({ "index.html": page(body) }, (ctx) => fn(ctx, mainFrame(ctx)), { browser });
async function src(frame: Frame, selector: string): Promise<Derivation["source"]> {
  const handle = await frame.$(selector);
  if (handle === null) throw new Error(`no ${selector}`);
  return { node: { frame: { frame }, handle } };
}
async function backendSrc(ctx: CheckContext, frame: Frame, selector: string): Promise<Derivation["source"]> {
  const cdp = await ctx.cdpFor(frame);
  const { root } = (await cdp.send("DOM.getDocument", { depth: 0 })) as { root: { nodeId: number } };
  const { nodeId } = (await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector })) as { nodeId: number };
  const { node } = (await cdp.send("DOM.describeNode", { nodeId })) as { node: { backendNodeId: number } };
  return { node: { frame: { frame }, backendNodeId: node.backendNodeId } };
}

const closed = (editable: boolean): string => `
  <div id="w"><zz-host id="h"><a id="slotted" href="#x">zzclosed link</a></zz-host><p>zzafter</p></div>
  <script>
    const root = document.getElementById("h").attachShadow({ mode: "closed" });
    root.innerHTML = '<div ${editable ? 'contenteditable="true"' : ""}><slot></slot></div>';
  </script>`;

describe("closed shadow roots", () => {
  it("withholds a light-DOM child slotted into an editable element inside a closed root", async () => {
    const [own, host] = await run(closed(true), async (ctx, f) => [
      await derivePiece({ source: await src(f, "#slotted"), kind: "snippet", shape: "outer" }, ctx, sanitiser),
      await derivePiece({ source: await src(f, "#w"), kind: "snippet", shape: "outer" }, ctx, sanitiser),
    ]);
    expect(own).toMatchObject({ value: MASK, redactions: 1, withheld: true, reason: "protected" });
    expect(host).toEqual({ value: `<div id="w"><zz-host id="h">${MASK}</zz-host><p>zzafter</p></div>`, redactions: 1, withheld: false });
  });

  it("keeps it when the closed root's element is not editable (control)", async () => {
    const own = await run(closed(false), async (ctx, f) =>
      derivePiece({ source: await src(f, "#slotted"), kind: "snippet", shape: "outer" }, ctx, sanitiser),
    );
    expect(own).toEqual({ value: `<a id="slotted" href="#x">zzclosed link</a>`, redactions: 0, withheld: false });
  });
});

describe("locator, accname, accvalue, frameUrl", () => {
  it("builds the engine-syntax locator, with >> into shadow roots and >>> into frames", async () => {
    const plain = await run(`<main><p>a</p><p><a id="l" href="#">zz</a></p></main>`, async (ctx, f) =>
      derivePiece({ source: await src(f, "#l"), kind: "locator" }, ctx, sanitiser),
    );
    expect(plain).toEqual({
      value: "html:nth-of-type(1) > body:nth-of-type(1) > main:nth-of-type(1) > p:nth-of-type(2) > a:nth-of-type(1)",
      redactions: 0,
      withheld: false,
    });
    const files = {
      "index.html": page(`<div><iframe src="f.html"></iframe></div>`),
      "f.html": page(`<zz-h id="h"></zz-h><script>document.getElementById("h").attachShadow({ mode: "open" }).innerHTML = "<b>zz</b>";</script>`),
    };
    const framed = await withTarget(
      files,
      async (ctx) => {
        const frame = ctx.frames[1]?.frame;
        if (frame === undefined) throw new Error("no child frame");
        const b = await frame.evaluateHandle(`document.getElementById("h").shadowRoot.querySelector("b")`);
        return derivePiece({ source: { node: { frame: { frame }, handle: b } }, kind: "locator" }, ctx, sanitiser);
      },
      { browser },
    );
    expect(framed.value).toBe(
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > iframe:nth-of-type(1) >>> html:nth-of-type(1) > body:nth-of-type(1) > zz-h:nth-of-type(1) >> b:nth-of-type(1)",
    );
  });

  it("withholds a locator in protected context", async () => {
    const p = await run(`<div contenteditable><a id="l" href="#">zz</a></div>`, async (ctx, f) =>
      derivePiece({ source: await src(f, "#l"), kind: "locator" }, ctx, sanitiser),
    );
    expect(p).toMatchObject({ value: MASK, redactions: 1, reason: "protected" });
  });

  it("reads accname and accvalue through CDP, and withholds them when the node is or contains a field or box", async () => {
    const [name, contains, isField] = await run(
      `<button id="b">zzname</button><label id="lab">zzlab <input id="i" value="zzval"></label>`,
      async (ctx, f) => [
        await derivePiece({ source: await backendSrc(ctx, f, "#b"), kind: "accname" }, ctx, sanitiser),
        await derivePiece({ source: await backendSrc(ctx, f, "#lab"), kind: "accname" }, ctx, sanitiser),
        await derivePiece({ source: await backendSrc(ctx, f, "#i"), kind: "accvalue" }, ctx, sanitiser),
      ],
    );
    expect(name).toEqual({ value: "zzname", redactions: 0, withheld: false });
    expect(contains).toMatchObject({ value: MASK, redactions: 1, reason: "contains-field-or-box" });
    expect(isField).toMatchObject({ value: MASK, redactions: 1, reason: "contains-field-or-box" });
  });

  it("passes a frame URL through Sanitiser.url, and withholds it for a frame in a box", async () => {
    const files = (box: boolean): Record<string, string> => ({
      "index.html": page(
        box ? `<div contenteditable><iframe src="f.html?zzq=zzsecret#zzfrag"></iframe></div>` : `<iframe src="f.html?zzq=zzsecret#zzfrag"></iframe>`,
      ),
      "f.html": page("<p>zz</p>"),
    });
    const urlOf = (ctx: CheckContext): Promise<{ value: string; redactions: number; reason?: string }> => {
      const frame = ctx.frames[1]?.frame;
      if (frame === undefined) throw new Error("no child frame");
      return derivePiece({ source: { frame: { frame } }, kind: "frameUrl" }, ctx, sanitiser);
    };
    const plain = await withTarget(files(false), urlOf, { browser });
    expect(plain.value).toMatch(/\/f\.html\?zzq=\[redacted\]#\[redacted\]$/);
    expect(plain.redactions).toBe(2);
    expect(await withTarget(files(true), urlOf, { browser })).toMatchObject({ value: MASK, reason: "protected-frame" });
  });
});

const declared: DeclaredText = { templates: ["zz {0} of {1}: {2}", "zz scope {0}"], enumerations: { zzkind: ["zzlink", "zzbutton"] } };

describe("notes and evidence", () => {
  it("fills declared templates with declared enumeration values, numbers and derived slots", async () => {
    const n = await run(`<p id="p" lang="zzfr">zz</p><div contenteditable><p id="q" lang="zzhidden">x</p></div>`, async (ctx, f) =>
      deriveNote(
        {
          template: "zz {0} of {1}: {2}",
          slots: [{ enumeration: "zzkind", value: "zzlink" }, 3, { source: await src(f, "#q"), kind: "attr", name: "lang" }],
        },
        declared,
        ctx,
        sanitiser,
      ),
    );
    expect(n).toEqual({ value: `zz zzlink of 3: ${MASK}`, redactions: 1 });
  });

  it("refuses undeclared templates, undeclared enumeration values and wrong slot kinds", async () => {
    await run(`<p id="p">zz</p>`, async (ctx, f) => {
      const s = await src(f, "#p");
      await expect(deriveNote({ template: "zz undeclared {0}", slots: [1] }, declared, ctx, sanitiser)).rejects.toBeInstanceOf(UndeclaredTextError);
      await expect(
        deriveNote({ template: "zz scope {0}", slots: [{ enumeration: "zzkind", value: "zzother" }] }, declared, ctx, sanitiser),
      ).rejects.toBeInstanceOf(UndeclaredTextError);
      await expect(
        deriveNote({ template: "zz scope {0}", slots: [{ source: s, kind: "snippet", shape: "outer" }] }, declared, ctx, sanitiser),
      ).rejects.toBeInstanceOf(UndeclaredTextError);
      await expect(deriveNote({ template: "zz scope {0}", slots: ["zzraw" as unknown as number] }, declared, ctx, sanitiser)).rejects.toBeInstanceOf(
        UndeclaredTextError,
      );
      await expect(deriveNote({ template: "zz scope {0}", slots: [1, 2] }, declared, ctx, sanitiser)).rejects.toBeInstanceOf(UndeclaredTextError);
    });
  });

  it("withholds every piece of an item whose snippet source is protected, with the fixed engine note", async () => {
    const d = await run(`<div contenteditable><a id="a" href="#">zzbox</a></div><a id="b" href="#">zzok</a>`, async (ctx, f) => {
      const a = await src(f, "#a");
      return deriveEvidence(
        {
          kind: "dom_node",
          snippet: { source: a, kind: "snippet", shape: "outer" },
          locator: { source: await src(f, "#b"), kind: "locator" },
          note: { template: "zz scope {0}", slots: [{ source: a, kind: "id" }] },
        },
        declared,
        ctx,
        sanitiser,
      );
    });
    expect(d).toEqual({ evidence: { kind: "dom_node", snippet: MASK, locator: MASK, note: PROTECTED_NOTE, redactions: 3 } });
  });

  it("guards locatorList member by member; a withheld member keeps the list's length", async () => {
    const d = await run(`<a id="a" href="#">zz</a><div contenteditable><a id="b" href="#">zzb</a></div><a id="c" href="#">zz</a>`, async (ctx, f) =>
      deriveEvidence(
        {
          kind: "scope_examined",
          note: { template: "zz scope {0}", slots: [3] },
          locatorList: [
            { source: await src(f, "#a"), kind: "locator" },
            { source: await src(f, "#b"), kind: "locator" },
            { source: await src(f, "#c"), kind: "locator" },
          ],
        },
        declared,
        ctx,
        sanitiser,
      ),
    );
    expect(d.evidence).toEqual({ kind: "scope_examined", note: "zz scope 3", redactions: 1 });
    expect(d.locatorList).toEqual([
      "html:nth-of-type(1) > body:nth-of-type(1) > a:nth-of-type(1)",
      MASK,
      "html:nth-of-type(1) > body:nth-of-type(1) > a:nth-of-type(2)",
    ]);
  });
});
