/**
 * Q62: an axe node is resolved in its page (frame chain, shadow-piercing
 * selectors) and its flat-tree ancestors are tested, so a node in the open
 * shadow tree of an editable host is masked and a twin outside any box is not.
 * Asserted on the saved run file, through `runAudit` on locally served pages;
 * the shadow roots are attached by scripts in separate files, so the marker is
 * not in the page's own markup.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import type { AxeResults } from "axe-core";
import { describe, expect, it } from "vitest";
import { allProviders } from "../../../src/checks/index.ts";
import { guardEditableSnippets, UNRESOLVED } from "../../../src/checks/axe/editable.ts";
import { runAudit } from "../../../src/engine/index.ts";
import { serveFixture } from "../../../src/engine/testing/index.ts";
import type { FrameInfo } from "../../../src/checks/types.ts";

const MARKER = "synthetic private marker";
const LINK = `<a href="#"><span aria-hidden="true">${MARKER}</span></a>`;
const page = (body: string, script = ""): string =>
  `<!doctype html><html lang="fr"><title>Fixture</title><body>${body}${script ? `<script src="/${script}"></script>` : ""}</body></html>`;

interface Saved {
  saved: string;
  doc: { observations: Array<{ checkId: string; outcome: string; evidence: Array<{ snippet?: string; note?: string; redactions?: number }> }> };
}

async function savedRun(files: Record<string, string>): Promise<Saved> {
  const server = await serveFixture(files);
  try {
    const dir = mkdtempSync(join(tmpdir(), "rgaa-q62-"));
    const samplePath = join(dir, "sample.json");
    writeFileSync(
      samplePath,
      JSON.stringify({
        project: { name: "Synthetic fixture", ruleset: "rgaa-4.1.2", regime: "to_confirm", reportLanguage: "en" },
        pages: [{ id: "home", url: server.url("index.html"), kinds: ["home"] }],
      }),
    );
    const r = await runAudit({ samplePath, outDir: join(dir, "out"), providers: allProviders() });
    const saved = readFileSync(r.runFilePath ?? "", "utf8");
    return { saved, doc: JSON.parse(saved) as Saved["doc"] };
  } finally {
    await server.close();
  }
}

const redactions = (d: Saved["doc"]): number => d.observations.flatMap((x) => x.evidence).reduce((s, e) => s + (e.redactions ?? 0), 0);

describe("axe snippets inside shadow trees of editable hosts (Q62)", () => {
  it("open shadow root of a role=textbox host, attached by a separate script: marker absent, redaction counted", async () => {
    const { saved, doc } = await savedRun({
      "index.html": page('<div id="editor" role="textbox"></div>', "shadow.js"),
      "shadow.js": `document.getElementById("editor").attachShadow({ mode: "open" }).innerHTML = ${JSON.stringify(LINK)};`,
    });
    expect(doc.observations.find((x) => x.checkId === "axe/link-name")?.outcome).toBe("fault");
    expect(saved).not.toContain(MARKER);
    expect(redactions(doc)).toBeGreaterThanOrEqual(1);
  });

  it("slotted: a link with the marker in the light DOM of a role=textbox host whose shadow root has a slot", async () => {
    const { saved, doc } = await savedRun({
      "index.html": page(`<div id="editor" role="textbox">${LINK}</div>`, "shadow.js"),
      "shadow.js": `document.getElementById("editor").attachShadow({ mode: "open" }).innerHTML = "<slot></slot>";`,
    });
    expect(doc.observations.find((x) => x.checkId === "axe/link-name")?.outcome).toBe("fault");
    expect(saved).not.toContain(MARKER);
    expect(redactions(doc)).toBeGreaterThanOrEqual(1);
  });

  it("nested: a shadow host inside a shadow tree of a contenteditable host", async () => {
    const { saved } = await savedRun({
      "index.html": page('<div id="outer" contenteditable="true"></div>', "shadow.js"),
      "shadow.js": `var a = document.getElementById("outer").attachShadow({ mode: "open" });
a.innerHTML = '<div id="inner"></div>';
a.getElementById("inner").attachShadow({ mode: "open" }).innerHTML = ${JSON.stringify(LINK)};`,
    });
    expect(saved).not.toContain(MARKER);
  });

  it("light-DOM role and contenteditable fixtures still mask", async () => {
    for (const attrs of ['role="textbox"', 'role="searchbox"', 'contenteditable="true"']) {
      const { saved, doc } = await savedRun({ "index.html": page(`<div ${attrs}>${LINK}</div>`) });
      expect(saved, attrs).not.toContain(MARKER);
      expect(redactions(doc), attrs).toBeGreaterThanOrEqual(1);
    }
  });

  it("twin: the same link outside any box keeps its text in axe/link-name, the copy inside a box is masked", async () => {
    const { doc } = await savedRun({ "index.html": page(`<div id="plain">${LINK}</div><div role="textbox">${LINK}</div>`) });
    const snippets = doc.observations.find((x) => x.checkId === "axe/link-name")?.evidence.map((e) => e.snippet ?? "") ?? [];
    expect(snippets.filter((s) => s.includes(MARKER)).length).toBe(1);
    expect(snippets.filter((s) => s.includes("[")).length).toBeGreaterThanOrEqual(1);
    expect(redactions(doc)).toBeGreaterThanOrEqual(1);
  });
});

describe("an unresolvable target is wrapped", () => {
  it("no target, a selector that matches nothing, and an unreadable frame", async () => {
    const browser = await chromium.launch();
    try {
      const p = await browser.newPage();
      await p.setContent("<body><p>x</p></body>");
      const info: FrameInfo = { frame: p.mainFrame(), parent: null, crossOrigin: false, readable: true };
      const mk = (target: unknown) => ({ html: `<a href="#">${MARKER}</a>`, target });
      const nodes = [mk(undefined), mk(["#nope"]), mk(["#nope", "a"]), mk([["#nope", "a"]]), mk(["p"])];
      const results = { violations: [{ nodes }], incomplete: [], passes: [], inapplicable: [] } as unknown as AxeResults;
      await guardEditableSnippets(results, [info]);
      for (const n of nodes.slice(0, 4)) {
        expect(n.html.startsWith('<div contenteditable="true">')).toBe(true);
        expect(n.html.endsWith("</div>")).toBe(true);
        expect(UNRESOLVED.has(n)).toBe(true);
      }
      // resolved and outside any box: untouched
      expect(nodes[4]!.html).toBe(`<a href="#">${MARKER}</a>`);
      expect(UNRESOLVED.has(nodes[4]!)).toBe(false);
    } finally {
      await browser.close();
    }
  });
});
