import { describe, expect, it } from "vitest";
import { MASK, SNIPPET_MAX_LENGTH, TRUNCATION_MARK, createSanitiser, maskTokens } from "../../src/engine/sanitise.ts";
import { sanitiseSample } from "../../src/engine/run-file.ts";
import { SampleFileSchema } from "../../src/schema/index.ts";

// Planted values. None is a real credential.
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwbGFudGVkLXVzZXIifQ.c2lnbmF0dXJlLXBsYW50ZWQtMTIz";
const HEX = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const B64 = "QmFzZTY0UGxhbnRlZFRva2VuVmFsdWUxMjM0NTY3ODkwQUJD";
const B64URL = "dGhpc19pc19hX3BsYW50ZWQtdG9rZW4tVmFsdWUtMTIzNDU2";
const STRIPE = "sk_live_PLANTED1234567890abcdef";
const SK = "sk-plantedPLANTED1234567890";
const GHP = "ghp_PLANTEDplanted1234567890abcdefXYZ";
const AWS = "AKIAPLANTED123456789";
const GOOGLE = "AIzaPLANTEDplanted1234567890_abcdefghij";
const SLACK = "xoxb-123456789012-planted-token";

const s = createSanitiser(["page", "lang"]);

describe("URL rule", () => {
  it("masks query values not marked safe, keeps names and safe values", () => {
    const r = s.url("https://example.test/search?q=jean+dupont&page=2&session=abc123&lang=fr");
    expect(r.value).toBe(`https://example.test/search?q=${MASK}&page=2&session=${MASK}&lang=fr`);
    expect(r.redactions).toBe(2);
  });

  it("masks the fragment", () => {
    const r = s.url("https://example.test/app#access_token=planted");
    expect(r.value).toBe(`https://example.test/app#${MASK}`);
    expect(r.redactions).toBe(1);
  });

  it("masks user information before the host", () => {
    const r = s.url("https://user:planted-password@example.test/");
    expect(r.value).toBe(`https://${MASK}@example.test/`);
    expect(r.redactions).toBe(1);
  });

  it("leaves a URL with nothing to mask unchanged, with zero redactions", () => {
    expect(s.url("https://example.test/a/b")).toEqual({ value: "https://example.test/a/b", redactions: 0 });
    expect(s.url("https://example.test/?empty=")).toEqual({ value: "https://example.test/?empty=", redactions: 0 });
  });

  it("masks a token in the path", () => {
    const r = s.url(`https://example.test/reset/${HEX}`);
    expect(r.value).toBe(`https://example.test/reset/${MASK}`);
    expect(r.redactions).toBe(1);
  });

  it("decodes a parameter name before comparing it with the safe list", () => {
    expect(s.url("https://example.test/?%70age=3").value).toBe("https://example.test/?%70age=3");
  });

  it("is idempotent", () => {
    const once = s.url("https://example.test/?a=1#x");
    const twice = s.url(once.value);
    expect(twice).toEqual({ value: once.value, redactions: 0 });
  });

  it("masks URLs inside free text", () => {
    const r = s.text("navigation failed: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:9/?token=planted#frag");
    expect(r.value).toBe(`navigation failed: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:9/?token=${MASK}#${MASK}`);
    expect(r.redactions).toBe(2);
  });

  it("keeps the sanitised sample valid against the sample schema", () => {
    const sample = SampleFileSchema.parse({
      project: { name: "x", ruleset: "rgaa-4.1.2" },
      pages: [{ id: "home", url: `https://user:pw@example.test/p/${HEX}?utm=1&page=2#top`, kinds: ["home"] }],
      documents: [{ url: "https://example.test/doc.pdf?sig=planted" }],
      safeQueryParams: ["page"],
    });
    const clean = sanitiseSample(sample, createSanitiser(sample.safeQueryParams));
    expect(clean.pages[0]?.url).toBe(`https://${MASK}@example.test/p/${MASK}?utm=${MASK}&page=2#${MASK}`);
    expect(clean.documents[0]?.url).toBe(`https://example.test/doc.pdf?sig=${MASK}`);
    expect(SampleFileSchema.safeParse(clean).success).toBe(true);
    // The original is untouched.
    expect(sample.pages[0]?.url).toContain(HEX);
  });
});

describe("token rule", () => {
  it.each([
    ["a JSON Web Token", JWT],
    ["a long hex run", HEX],
    ["a long base64 run", B64],
    ["a long base64url run", B64URL],
    ["a Stripe-style key", STRIPE],
    ["an sk- key", SK],
    ["a GitHub token", GHP],
    ["an AWS key id", AWS],
    ["a Google API key", GOOGLE],
    ["a Slack token", SLACK],
  ])("masks %s", (_name, token) => {
    const r = maskTokens(`before ${token} after`);
    expect(r.value).toBe(`before ${MASK} after`);
    expect(r.redactions).toBe(1);
  });

  it("masks Bearer and Basic credentials, keeping the scheme word", () => {
    expect(maskTokens("Authorization: Bearer abcdefgh12345678").value).toBe(`Authorization: Bearer ${MASK}`);
    expect(maskTokens("Basic dXNlcjpwbGFudGVk").value).toBe(`Basic ${MASK}`);
  });

  it("masks the value of a secret-looking name", () => {
    expect(maskTokens('{"apiKey": "planted-value-1"}').value).toBe(`{"apiKey": "${MASK}"}`);
    expect(maskTokens("password=hunter22").value).toBe(`password=${MASK}`);
    expect(maskTokens('data-auth-token="abcdef123"').value).toBe(`data-auth-token="${MASK}"`);
  });

  it("leaves ordinary text, ids, short hex and lowercase words alone", () => {
    for (const t of [
      "Formulaire de contact",
      'id="formulaire"',
      "#ff00aa",
      "color: #1a2b3c",
      "a-very-long-lowercase-css-class-name-without-digits",
      'type="password" autocomplete="current-password"',
      "role=button[name='Menu']",
    ]) {
      expect(maskTokens(t)).toEqual({ value: t, redactions: 0 });
    }
  });
});

describe("snippet rule: editable boxes", () => {
  const s = createSanitiser();
  it("masks the content of contenteditable elements, whatever the value except false", () => {
    for (const attr of ["contenteditable", 'contenteditable=""', 'contenteditable="true"', "contenteditable=plaintext-only", 'CONTENTEDITABLE="TRUE"', "contenteditable='Plaintext-Only'"]) {
      const r = s.snippet(`<div ${attr} class="x">private words<b>more</b></div><p>kept</p>`);
      expect(r.value, attr).toBe(`<div ${attr} class="x">${MASK}</div><p>kept</p>`);
      expect(r.redactions, attr).toBe(1);
    }
  });
  it("keeps the content of contenteditable=false", () => {
    const r = s.snippet('<div contenteditable="false">public</div><div contenteditable=" False ">public</div>');
    expect(r.value).toBe('<div contenteditable="false">public</div><div contenteditable=" False ">public</div>');
    expect(r.redactions).toBe(0);
  });
  it("masks the content of textbox, searchbox and combobox roles, any case, among other tokens", () => {
    for (const role of ["textbox", "SearchBox", "combobox", "presentation TextBox", "  combobox  "]) {
      const r = s.snippet(`<div role="${role}">private words</div>`);
      expect(r.value, role).toBe(`<div role="${role}">${MASK}</div>`);
      expect(r.redactions, role).toBe(1);
    }
    const other = s.snippet('<div role="button textboxes">public</div>');
    expect(other.value).toBe('<div role="button textboxes">public</div>');
    expect(other.redactions).toBe(0);
  });
  it("drops nested markup, handles nested editable boxes and same-name nesting, one redaction for the outermost", () => {
    const r = s.snippet('<div contenteditable><div><div role="textbox">inner</div>mid</div>tail</div><div>after</div>');
    expect(r.value).toBe(`<div contenteditable>${MASK}</div><div>after</div>`);
    expect(r.redactions).toBe(1);
  });
  it("counts one redaction per element for sibling editable boxes", () => {
    const r = s.snippet('<span contenteditable>a</span><span contenteditable>b</span>');
    expect(r.value).toBe(`<span contenteditable>${MASK}</span><span contenteditable>${MASK}</span>`);
    expect(r.redactions).toBe(2);
  });
  it("drops everything after the start tag when the end tag is missing (a cut or unbalanced snippet)", () => {
    const r = s.snippet('<p>x</p><div role="textbox" contenteditable="true">private visitor wo');
    expect(r.value).toBe(`<p>x</p><div role="textbox" contenteditable="true">${MASK}`);
    expect(r.redactions).toBe(1);
    const cut = s.snippet(`<div contenteditable><b>${"a".repeat(2000)}`);
    expect(cut.value).toBe(`<div contenteditable>${MASK}`);
  });
  it("is idempotent and leaves empty boxes alone", () => {
    const once = s.snippet('<div contenteditable>private</div><div contenteditable></div>');
    const twice = s.snippet(once.value);
    expect(twice.value).toBe(once.value);
    expect(twice.redactions).toBe(0);
    expect(once.redactions).toBe(1);
  });
  it("is not fooled by a '>' in a quoted attribute or by an editable-looking attribute value", () => {
    const r = s.snippet('<div data-x="a>b" contenteditable>secret</div><div title=" contenteditable role=textbox ">public</div>');
    expect(r.value).toBe(`<div data-x="a>b" contenteditable>${MASK}</div><div title=" contenteditable role=textbox ">public</div>`);
  });
});

describe("snippet rule", () => {
  it("drops the value of input and option elements and the content of textarea", () => {
    const html =
      '<form><input type="text" name="nom" value="Jean Dupont"><input type=hidden value=planted42>' +
      '<select><option value="fr" selected>Français</option></select>' +
      "<textarea name=msg>Mon message privé</textarea></form>";
    const r = s.snippet(html);
    expect(r.value).toBe(
      `<form><input type="text" name="nom" value="${MASK}"><input type=hidden value="${MASK}">` +
        `<select><option value="${MASK}" selected>Français</option></select>` +
        `<textarea name=msg>${MASK}</textarea></form>`,
    );
    expect(r.redactions).toBe(4);
  });

  it("handles '>' inside a quoted attribute and an empty value", () => {
    const r = s.snippet('<input data-x="a>b" value="planted secret"><input value="">');
    expect(r.value).toBe(`<input data-x="a>b" value="${MASK}"><input value="">`);
    expect(r.redactions).toBe(1);
  });

  it("masks query values and fragments in URL attributes, relative ones too, and keeps in-page references", () => {
    const html =
      '<a href="/account?user=jean&page=2#details">x</a><a href="#contenu">skip</a>' +
      "<img src='https://cdn.test/i.png?sig=planted' srcset=\"/a.png?w=1 1x, /b.png?w=2 2x\">";
    const r = s.snippet(html);
    expect(r.value).toBe(
      `<a href="/account?user=${MASK}&page=2#${MASK}">x</a><a href="#contenu">skip</a>` +
        `<img src='https://cdn.test/i.png?sig=${MASK}' srcset="/a.png?w=${MASK} 1x, /b.png?w=${MASK} 2x">`,
    );
    expect(r.redactions).toBe(5);
  });

  it("masks tokens anywhere in the markup", () => {
    const r = s.snippet(`<div data-state="${JWT}">${HEX}</div>`);
    expect(r.value).toBe(`<div data-state="${MASK}">${MASK}</div>`);
    expect(r.redactions).toBe(2);
  });

  it("caps the length after masking and marks the cut", () => {
    const long = `<p>${"mot ".repeat(600)}</p>`;
    const r = s.snippet(long);
    expect(r.value.length).toBe(SNIPPET_MAX_LENGTH + TRUNCATION_MARK.length);
    expect(r.value.endsWith(TRUNCATION_MARK)).toBe(true);
    expect(r.redactions).toBe(0);
  });

  it("masks a textarea whose closing tag was cut off", () => {
    expect(s.snippet("<textarea>planted text").value).toBe(`<textarea>${MASK}`);
  });
});
