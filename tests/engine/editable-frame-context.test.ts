/**
 * Q63: a document whose hosting frame element, or any frame element further
 * up the chain, has an editable ancestor is inside that editable box: its
 * snippets are masked and counted. Asserted on the saved run file, through
 * `runAudit` on locally served synthetic pages.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allProviders } from "../../src/checks/index.ts";
import { runAudit } from "../../src/engine/index.ts";
import { serveFixture } from "../../src/engine/testing/index.ts";

const MARKER = "synthetic private marker";
const FRAMED_LINK = `<a href="/"><span aria-hidden="true">${MARKER}</span></a>`;
const page = (body: string, head = "<title>Fixture</title>"): string => `<!doctype html><html lang="fr">${head}<body>${body}</body></html>`;
const frameDoc = `<!doctype html><html lang="fr"><title>Frame</title><body>${FRAMED_LINK}</body></html>`;
const CROSS = "__CROSS_ORIGIN__";

interface Saved {
  saved: string;
  doc: { observations: Array<{ checkId: string; outcome: string; evidence: Array<{ snippet?: string; redactions?: number }> }> };
}

async function savedRun(files: Record<string, string>): Promise<Saved> {
  const server = await serveFixture(files);
  try {
    const dir = mkdtempSync(join(tmpdir(), "rgaa-q63-"));
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

describe("editable context crosses frame boundaries for the custom checks (Q63)", () => {
  const hosts = ['<div role="textbox">', '<div contenteditable="true">', '<div role="searchbox">'];
  for (const host of hosts) {
    for (const [label, origin] of [
      ["cross-origin", CROSS],
      ["same-origin", ""],
    ] as const) {
      it(`${label} iframe under ${host}: marker absent, redaction counted`, async () => {
        const { saved, doc } = await savedRun({
          "index.html": page(`${host}<iframe title="f" src="${origin}/f.html"></iframe></div>`),
          "f.html": frameDoc,
        });
        const o = doc.observations.find((x) => x.checkId === "custom/6-2-link-content-name");
        expect(o?.outcome).toBe("fault");
        expect(saved).not.toContain(MARKER);
        expect(redactions(doc)).toBeGreaterThanOrEqual(1);
      });
    }
  }

  it("nested two-level frame, the outer one inside the editable box", async () => {
    const { saved, doc } = await savedRun({
      "index.html": page(`<div role="textbox"><iframe title="o" src="/outer.html"></iframe></div>`),
      "outer.html": page(`<iframe title="i" src="${CROSS}/f.html"></iframe>`),
      "f.html": frameDoc,
    });
    expect(doc.observations.find((x) => x.checkId === "custom/6-2-link-content-name")?.outcome).toBe("fault");
    expect(saved).not.toContain(MARKER);
    expect(redactions(doc)).toBeGreaterThanOrEqual(1);
  });

  it("nested frames, only the inner frame element inside the editable box", async () => {
    const { saved } = await savedRun({
      "index.html": page(`<iframe title="o" src="/outer.html"></iframe>`),
      "outer.html": page(`<div contenteditable="true"><iframe title="i" src="${CROSS}/f.html"></iframe></div>`),
      "f.html": frameDoc,
    });
    expect(saved).not.toContain(MARKER);
  });

  it("a framed document whose hosting document is in designMode is masked too", async () => {
    const { saved } = await savedRun({
      "index.html": page(`<iframe title="o" src="/outer.html"></iframe>`),
      "outer.html": `<!doctype html><html lang="fr"><title>o</title><body><iframe title="i" src="/f.html"></iframe><script>document.designMode="on"</script></body></html>`,
      "f.html": frameDoc,
    });
    expect(saved).not.toContain(MARKER);
  });

  it("a marker in a framed document's title and text under an editable box reaches no run file", async () => {
    const { saved } = await savedRun({
      "index.html": page(`<div role="textbox"><iframe title="f" src="/f.html"></iframe></div>`),
      "f.html": `<!doctype html><title>${MARKER}</title><body>${MARKER}</body>`,
    });
    expect(saved).not.toContain(MARKER);
  });

  it("control: the same frames outside any editable box keep their text", async () => {
    for (const origin of [CROSS, ""]) {
      const { saved, doc } = await savedRun({
        "index.html": page(`<div><iframe title="f" src="${origin}/f.html"></iframe></div>`),
        "f.html": frameDoc,
      });
      expect(doc.observations.find((x) => x.checkId === "custom/6-2-link-content-name")?.outcome).toBe("fault");
      expect(saved).toContain(MARKER);
    }
  });
});
