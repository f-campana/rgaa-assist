/**
 * custom/8-4-default-lang-code-valid, one test per branch of its record
 * (per attribute: absent, empty or padded, in the list, not in it; page
 * result: fault, no_fault, cannot_tell), with the document types of
 * custom/8-3-default-lang-present, XHTML served as XML, and the pinned
 * ISO 639 list derived from the vendored sources.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { launchBrowser } from "../../../../src/engine/index.ts";
import { observe } from "../../../../src/engine/testing/index.ts";
import type { Observation } from "../../../../src/schema/index.ts";
import {
  ID,
  LANGUAGE_CODE_LIST,
  definition,
  inList,
  langCodeValidProvider,
  primaryPart,
} from "../../../../src/checks/custom/8-4-default-lang-code-valid/index.ts";
import { LIST_FILE, SOURCE_DIR, deriveCodeList, serialise } from "../../../../src/checks/custom/8-4-default-lang-code-valid/derive.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

async function run(files: Record<string, string>, page?: string): Promise<Observation> {
  const obs = await observe(langCodeValidProvider, files, { browser, ...(page === undefined ? {} : { page }) });
  expect(obs).toHaveLength(1);
  const o = obs[0];
  if (o === undefined) throw new Error("no observation");
  expect(o.checkId).toBe(ID);
  return o;
}

const html = (attrs: string): Record<string, string> => ({
  "index.html": `<!DOCTYPE html><html${attrs}><head><meta charset="utf-8"><title>Page</title></head><body><p>Bonjour tout le monde.</p></body></html>`,
});
const XHTML10_STRICT = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">`;
const XHTML11 = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">`;
const xhtml10AsHtml = (attrs: string): Record<string, string> => ({
  "index.html": `${XHTML10_STRICT}<html xmlns="http://www.w3.org/1999/xhtml"${attrs}><head><title>Page</title></head><body><p>Bonjour.</p></body></html>`,
});
const asXml = (doctype: string, attrs: string): Record<string, string> => ({
  "index.xhtml": `<?xml version="1.0" encoding="utf-8"?>${doctype}<html xmlns="http://www.w3.org/1999/xhtml"${attrs}><head><title>Page</title></head><body><p>Bonjour.</p></body></html>`,
});

describe("the pinned ISO 639 list", () => {
  it("is exactly what derive.ts gives from the vendored files, whose hashes match SOURCE.md", () => {
    const derived = deriveCodeList();
    expect(readFileSync(LIST_FILE, "utf8")).toBe(serialise(derived));
    const sourceMd = readFileSync(join(SOURCE_DIR, "SOURCE.md"), "utf8");
    for (const f of ["language-subtag-registry.txt", "ISO-639-2_utf-8.txt"]) {
      const sha = createHash("sha256").update(readFileSync(join(SOURCE_DIR, f))).digest("hex");
      expect(sourceMd).toContain(sha);
    }
    expect(derived.sources.ianaRegistry.fileDate).toBe("2026-09-17");
  });

  it("records its version in the check's default options", () => {
    expect(definition.version).toBe("1.0.0");
    expect(LANGUAGE_CODE_LIST.version).toBe("iso639-v1+iana-2026-09-17+loc-42b71885e4dc");
    expect(definition.defaultOptions).toEqual({ languageCodeList: LANGUAGE_CODE_LIST });
  });

  it("holds ISO 639-1, 639-2 B and T, the reserved range and special codes, 639-3, 639-5 and withdrawn codes", () => {
    for (const c of ["fr", "en", "de", "fra", "fre", "ger", "deu", "chi", "zho", "qaa", "qtz", "mis", "mul", "und", "zxx", "yue", "cmn", "gem", "sla", "iw", "in", "ji", "mo"]) {
      expect(inList(c), c).toBe(true);
    }
    for (const c of ["francais", "xx", "zzz", "abcd", "fr_fr", "e", "", "f-r"]) expect(inList(c), c).toBe(false);
  });

  it("compares ignoring ASCII case only", () => {
    expect(inList("FR")).toBe(true);
    expect(inList("Fra")).toBe(true);
    // U+212A KELVIN SIGN lowercases to "k" under Unicode rules; ignoring ASCII case only, "Ka" is not "ka".
    expect(inList("ka")).toBe(true);
    expect(inList("Ka")).toBe(false);
  });

  it("takes the part before the first hyphen", () => {
    expect(primaryPart("fr-FR")).toBe("fr");
    expect(primaryPart("zh-Hant-TW")).toBe("zh");
    expect(primaryPart("fr_FR")).toBe("fr_FR");
    expect(primaryPart("-fr")).toBe("");
  });
});

describe("custom/8-4-default-lang-code-valid", () => {
  it("HTML, code in the list: no_fault with the list version in its scope", async () => {
    const o = await run(html(` lang="fr"`));
    expect(o.outcome).toBe("no_fault");
    expect(o.fingerprint).toBe("custom/8-4-default-lang-code-valid:no_fault");
    const s = o.evidence.find((e) => e.kind === "scope_examined");
    expect(s?.note).toContain(LANGUAGE_CODE_LIST.version);
    expect(s?.locator).toBe("html");
  });

  it("HTML, code with a region, a three-letter code, a bibliographic code, upper case, a withdrawn code: no_fault", async () => {
    for (const v of ["fr-FR", "fra", "fre", "FR-ca", "iw", "qaa-x-private"]) {
      const o = await run(html(` lang="${v}"`));
      expect(o.outcome, v).toBe("no_fault");
    }
  });

  it("HTML, code not in the list: fault on the html element", async () => {
    const o = await run(html(` lang="francais"`));
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-4-default-lang-code-valid:lang=francais");
    expect(o.evidence[0]?.kind).toBe("dom_node");
    expect(o.evidence[0]?.locator).toBe("html");
    expect(o.evidence[0]?.snippet).toBe('<html lang="francais">');
  });

  it("HTML, an underscore instead of a hyphen: the whole value is the code, a fault", async () => {
    const o = await run(html(` lang="fr_FR"`));
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-4-default-lang-code-valid:lang=fr_fr");
  });

  it("HTML, a value starting with a hyphen: the empty code part is not in the list, a fault", async () => {
    const o = await run(html(` lang="-fr"`));
    expect(o.outcome).toBe("fault");
  });

  it("empty value: cannot_tell", async () => {
    const o = await run(html(` lang=""`));
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toContain("empty");
  });

  it("leading or trailing whitespace: cannot_tell", async () => {
    for (const v of [" fr", "fr ", "\tfr", "fr "]) {
      const o = await run(html(` lang="${v}"`));
      expect(o.outcome, JSON.stringify(v)).toBe("cannot_tell");
    }
  });

  it("none of the required attributes: cannot_tell", async () => {
    const o = await run(html(""));
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toMatch(/none of the required attributes/);
  });

  it("HTML: xml:lang is not required and not examined", async () => {
    const o = await run(html(` xml:lang="zz"`));
    expect(o.outcome).toBe("cannot_tell");
    const p = await run(html(` lang="fr" xml:lang="zz"`));
    expect(p.outcome).toBe("no_fault");
  });

  it("XHTML 1.0 as text/html: both required; one present and valid, the other absent: cannot_tell", async () => {
    const o = await run(xhtml10AsHtml(` lang="fr"`));
    expect(o.outcome).toBe("cannot_tell");
    expect(o.evidence[0]?.note).toContain("xml:lang is absent");
  });

  it("XHTML 1.0 as text/html: xml:lang read as the attribute named xml:lang; both valid: no_fault", async () => {
    const o = await run(xhtml10AsHtml(` lang="fr" xml:lang="fr"`));
    expect(o.outcome).toBe("no_fault");
  });

  it("XHTML 1.0 as text/html: a fault on one attribute wins over cannot_tell on the other", async () => {
    const o = await run(xhtml10AsHtml(` lang=" fr" xml:lang="zz"`));
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-4-default-lang-code-valid:xml:lang=zz");
  });

  it("XHTML 1.0 as application/xhtml+xml: xml:lang read in the XML namespace; lang not examined", async () => {
    const o = await run(asXml(XHTML10_STRICT, ` xml:lang="fr" lang="zz"`), "index.xhtml");
    expect(o.outcome).toBe("no_fault");
    const p = await run(asXml(XHTML10_STRICT, ` lang="fr"`), "index.xhtml");
    expect(p.outcome).toBe("cannot_tell");
  });

  it("XHTML 1.1: xml:lang with a code not in the list: fault", async () => {
    const o = await run(asXml(XHTML11, ` xml:lang="english"`), "index.xhtml");
    expect(o.outcome).toBe("fault");
    expect(o.fingerprint).toBe("custom/8-4-default-lang-code-valid:xml:lang=english");
  });

  it("other XML (served as application/xhtml+xml without an XHTML doctype): both required", async () => {
    const both = await run(asXml("", ` lang="fr" xml:lang="fr"`), "index.xhtml");
    expect(both.outcome).toBe("no_fault");
    const one = await run(asXml("", ` xml:lang="fr"`), "index.xhtml");
    expect(one.outcome).toBe("cannot_tell");
  });

  it("only the html element of the top-level document is examined: a cross-site frame and text elements are not", async () => {
    const o = await run({
      "index.html": `<!DOCTYPE html><html lang="fr"><head><title>Page</title></head><body><p lang="zz">x</p><iframe src="__CROSS_ORIGIN__/frame.html"></iframe></body></html>`,
      "frame.html": `<!DOCTYPE html><html lang="zz"><head><title>f</title></head><body><p>f</p></body></html>`,
    });
    expect(o.outcome).toBe("no_fault");
  });

  it("a lang attribute set by script after load is read", async () => {
    const o = await run({
      "index.html": `<!DOCTYPE html><html><head><title>Page</title></head><body><p>x</p><script>addEventListener("load", () => document.documentElement.setAttribute("lang", "xx"));</script></body></html>`,
    });
    expect(o.outcome).toBe("fault");
  });
});
