/**
 * Q61: a textbox, searchbox or combobox role ancestor is an editable box for
 * every snippet guard, as it is for the sanitiser. Asserted on the saved run
 * file, through `runAudit` on a locally served synthetic page.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { allProviders } from "../../src/checks/index.ts";
import { helpersExpression } from "../../src/checks/custom/family-a/page.ts";
import { runAudit } from "../../src/engine/index.ts";
import { serveFixture } from "../../src/engine/testing/index.ts";
import { MASK, TEXTBOX_ROLE_LIST, isEditableBox } from "../../src/engine/sanitise.ts";

const MARKER = "synthetic private marker";
const link = (inner: string): string => `<a href="/"><span aria-hidden="true">${inner}</span></a>`;
const page = (body: string, lang = ' lang="fr"'): string => `<!doctype html><html${lang}><title>Fixture</title><body>${body}</body></html>`;

interface Saved {
  saved: string;
  doc: { observations: Array<{ checkId: string; outcome: string; evidence: Array<{ snippet?: string; redactions?: number }> }> };
}

async function savedRun(html: string): Promise<Saved> {
  const server = await serveFixture({ "index.html": html });
  try {
    const dir = mkdtempSync(join(tmpdir(), "rgaa-q61-"));
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

const ROLES = ['role="textbox"', 'role="searchbox"', 'role="combobox"', 'role="presentation TextBox"', 'contenteditable="true"'];

describe("role-based editable ancestors never leak into the saved run (Q61)", () => {
  for (const role of ROLES) {
    it(`6.2.1 under <div ${role}>: outcome kept, marker absent, redaction counted`, async () => {
      const { saved, doc } = await savedRun(page(`<div ${role}>${link(MARKER)}</div>`));
      const o = doc.observations.find((x) => x.checkId === "custom/6-2-link-content-name");
      expect(o?.outcome).toBe("fault");
      expect(doc.observations.filter((x) => JSON.stringify(x).includes(MARKER)).map((x) => x.checkId)).toEqual([]);
      expect(saved).not.toContain(MARKER);
      const n = doc.observations.flatMap((x) => x.evidence).reduce((s, e) => s + (e.redactions ?? 0), 0);
      expect(n).toBeGreaterThanOrEqual(1);
      expect((o?.evidence ?? []).some((e) => e.snippet?.includes(MASK) && (e.redactions ?? 0) >= 1)).toBe(true);
    });
  }

  it("control: the same link outside any editable box keeps its text", async () => {
    const { saved, doc } = await savedRun(page(`<div>${link(MARKER)}</div>`));
    expect(doc.observations.find((x) => x.checkId === "custom/6-2-link-content-name")?.outcome).toBe("fault");
    expect(saved).toContain(MARKER);
  });

  it("8.3.1: text under a textbox role is not a witness and reaches no run file", async () => {
    const { saved, doc } = await savedRun(page(`<div role="textbox">${MARKER}</div>`, ""));
    expect(doc.observations.find((x) => x.checkId === "custom/8-3-default-lang-present")?.outcome).not.toBe("fault");
    expect(saved).not.toContain(MARKER);
  });
});

describe("one definition of an editable box", () => {
  it("the family A guard and the sanitiser agree on the same start tags", async () => {
    expect(TEXTBOX_ROLE_LIST).toEqual(["textbox", "searchbox", "combobox"]);
    const cases: Array<[string, boolean]> = [
      ['role="textbox"', true],
      ['role="SearchBox"', true],
      ['role="presentation ComboBox"', true],
      ['role="textbox" role="button"', true],
      ['role="button" role="textbox"', false],
      ['role="slider"', false],
      ["contenteditable", true],
      ['contenteditable=""', true],
      ['contenteditable="false"', false],
      ['CONTENTEDITABLE="FALSE"', false],
      ['contenteditable="false" contenteditable="true"', false],
      ["", false],
    ];
    const browser = await chromium.launch();
    try {
      const p = await browser.newPage();
      for (const [attrs, expected] of cases) {
        expect(isEditableBox(attrs === "" ? "" : ` ${attrs}`), `sanitiser: ${attrs}`).toBe(expected);
        await p.setContent(`<body><div ${attrs}><span id="x">t</span></div></body>`);
        const guarded = await p.evaluate<string>(
          `(function (C) { return C.guardEditable(document.getElementById("x"), "T"); })(${helpersExpression()})`,
        );
        expect(guarded !== "T", `guard: ${attrs}`).toBe(expected);
      }
    } finally {
      await browser.close();
    }
  });
});
