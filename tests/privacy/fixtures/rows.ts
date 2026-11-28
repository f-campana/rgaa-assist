/**
 * Planted fixtures and oracle for the baseline slice of the privacy harness
 * (design 4.3). Written from the design table and the fixture source alone;
 * nothing here reads the engine's output to decide what is expected.
 *
 * Every marker is `qxNNN-` plus lowercase letters, under 32 characters, except
 * the three escaping markers (4.2), which hold punctuation after the prefix.
 * The fixtures are synthetic: no real site, no download, no saved session.
 *
 * Not in this slice (later): composite rows qx037 to qx039 and qx215 to qx219,
 * adversarial providers (4.4), the probe, step and session rows (4.9), the
 * static check (4.6).
 */
import { MORE_ROWS } from "./rows2.ts";
import { COMPOSITE_PAIRS } from "./rows3.ts";
import type { Row, Variant } from "./types.ts";

/** Escaping markers (4.2). */
export const M101 = `qx101-a&b<c>"d'`;
export const M102 = "qx102-a b/é?&=#";
export const M103 = 'qx103-a"b\\c\u2028\t';

const html = (body: string, head = ""): string =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>qx page</title>${head}</head><body>${body}</body></html>`;
const one = (body: string, head = ""): Variant[] => [{ name: "page", files: { "index.html": html(body, head) } }];
/** HTML-escaped as a text node or an attribute value, for planting a marker. */
const asText = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const asAttr = (s: string): string => asText(s).replace(/"/g, "&quot;");

const AXE_LINK = "axe/link-name";
const AXE_SELECT = "axe/select-name";
const C_FONT = "custom/10-1-presentation-elements";
const C_ID = "custom/8-2-id-duplicate";
const C_FIELD = "custom/11-1-field-label-mechanism";
const C_OPTGROUP = "custom/11-8-optgroup-label-attribute";
const C_FRAME = "custom/2-1-frame-title-attribute";

/** A script that types a live value into the first input and reflects it into attributes, as a page might. */
const typed = (marker: string, reflect: string): string =>
  `<script>const i=document.getElementById("f");i.value=${JSON.stringify(marker)};${reflect}</script>`;

const BASE_ROWS: readonly Row[] = [
  // ---- Baseline leak rows -------------------------------------------------
  {
    id: "qx001",
    title: "link text and id in a contenteditable box (axe link-name, 6.2.1)",
    role: "leak",
    table: "4.3 qx001",
    via: "audit",
    markers: ["qx001-hiddentext", "qx001-linkid"],
    variants: one(`<div contenteditable="true"><a href="/x.html" id="qx001-linkid"><span aria-hidden="true">qx001-hiddentext</span></a></div>`),
    oracle: { checks: [AXE_LINK], rgaa: "6.2.1", pieces: ["snippet", "locator", "note"], items: 1, saved: { kind: "redacted", count: 3 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx002",
    title: "title on a font element in a box (10.1.1)",
    role: "leak",
    table: "4.3 qx002",
    via: "audit",
    markers: ["qx002-fonttitle", "qx002-fontid"],
    variants: one(`<div contenteditable="true"><font title="qx002-fonttitle" id="qx002-fontid">x</font></div>`),
    oracle: { checks: [C_FONT], rgaa: "10.1.1", pieces: ["snippet", "locator"], items: 1, saved: { kind: "redacted", count: 2 }, allowed: "none" },
    baselineLeakExpected: true,
  },
  {
    id: "qx003",
    title: "duplicated id in a box (8.2.1)",
    role: "leak",
    table: "4.3 qx003",
    via: "audit",
    markers: ["qx003-dupid"],
    variants: one(`<div contenteditable="true"><p id="qx003-dupid">a</p><p id="qx003-dupid">b</p></div>`),
    oracle: {
      checks: [C_ID],
      rgaa: "8.2.1",
      pieces: ["snippet", "locator", "note", "fingerprint"],
      items: 2,
      saved: { kind: "redacted", count: 3, fingerprintCount: 1 },
      allowed: "none",
    },
    baselineLeakExpected: true,
  },
  {
    id: "qx011",
    title: "closed shadow root under a box (10.1.1)",
    role: "leak",
    table: "4.3 qx010-013",
    via: "audit",
    markers: ["qx011-shadowtitle", "qx011-shadowtext"],
    variants: one(
      `<div contenteditable="true"><div id="h"></div></div><script>document.getElementById("h").attachShadow({mode:"closed"}).innerHTML='<font title="qx011-shadowtitle">qx011-shadowtext</font>'</script>`,
    ),
    oracle: { checks: [C_FONT], rgaa: "10.1.1", pieces: ["snippet", "locator"], items: 1, saved: { kind: "redacted", count: 2 }, allowed: "none" },
    baselineLeakExpected: true,
  },
  {
    id: "qx017",
    title: "protected members of pass lists (axe and family C scope_examined)",
    role: "leak",
    table: "4.3 qx017",
    via: "audit",
    markers: ["qx017-passlink", "qx017-passfield"],
    variants: one(
      `<div contenteditable="true"><a href="/x.html" id="qx017-passlink">fine</a><label for="qx017-passfield">Nom</label><input type="text" id="qx017-passfield"></div>`,
    ),
    oracle: {
      checks: [AXE_LINK, C_FIELD],
      pieces: ["scope_examined"],
      items: null,
      saved: { kind: "redacted", count: 2 },
      allowed: "none; one withheld member per protected member",
    },
    baselineLeakExpected: true,
  },
  {
    id: "qx019",
    title: "classes on a protected faulty element (family C fingerprint)",
    role: "leak",
    table: "4.3 qx019",
    via: "audit",
    markers: ["qx019-clsone", "qx019-clstwo"],
    variants: one(`<div contenteditable="true"><input type="text" class="qx019-clsone qx019-clstwo"></div>`),
    oracle: { checks: [C_FIELD], rgaa: "11.1.1", pieces: ["fingerprint"], items: null, saved: { kind: "redacted", count: 0, fingerprintCount: 1 }, allowed: "none" },
    baselineLeakExpected: true,
  },
  {
    id: "qx022",
    title: "option text in a select (11.8.2 and axe select-name)",
    role: "leak",
    table: "4.3 qx022-025",
    via: "audit",
    markers: ["qx022-opttext"],
    variants: one(`<select><optgroup><option>qx022-opttext</option></optgroup></select>`),
    oracle: { checks: [C_OPTGROUP, AXE_SELECT], rgaa: "11.8.2", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 1 }, allowed: "none" },
    baselineLeakExpected: true,
  },
  {
    id: "qx023",
    title: "option label attribute",
    role: "leak",
    table: "4.3 qx022-025",
    via: "audit",
    markers: ["qx023-optlabel"],
    variants: one(`<select><optgroup><option label="qx023-optlabel">x</option></optgroup></select>`),
    oracle: { checks: [C_OPTGROUP, AXE_SELECT], rgaa: "11.8.2", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 1 }, allowed: "none" },
    baselineLeakExpected: true,
  },
  {
    id: "qx024",
    title: "option value attribute",
    role: "leak",
    table: "4.3 qx022-025",
    via: "audit",
    markers: ["qx024-optvalue"],
    variants: one(`<select><optgroup><option value="qx024-optvalue">x</option></optgroup></select>`),
    oracle: { checks: [C_OPTGROUP, AXE_SELECT], rgaa: "11.8.2", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 1 }, allowed: "none" },
    baselineLeakExpected: true,
  },
  {
    id: "qx025",
    title: "selected option and checked checkbox: state and value",
    role: "leak",
    table: "4.3 qx022-025",
    via: "audit",
    markers: ["qx025-selvalue", "qx025-chkvalue"],
    variants: one(
      `<select><optgroup><option value="qx025-selvalue" selected>x</option></optgroup></select><input type="checkbox" checked value="qx025-chkvalue">`,
    ),
    oracle: {
      checks: [C_OPTGROUP, AXE_SELECT, C_FIELD],
      rgaa: "11.8.2",
      pieces: ["snippet"],
      items: null,
      saved: { kind: "redacted", count: 1 },
      allowed: "none; the names selected and checked are absent from the snippets too",
      forbiddenInSnippets: ["selected", "checked"],
    },
    baselineLeakExpected: true,
  },
  {
    id: "qx030",
    title: "8.2.1 differential pair, protected id differs",
    role: "pair",
    table: "4.3 qx030, 4.5",
    via: "audit",
    markers: ["qx030-aaaa", "qx030-bbbb"],
    variants: [
      { name: "a", files: { "index.html": html(`<div contenteditable="true"><p id="qx030-aaaa">a</p><p id="qx030-aaaa">b</p></div>`) } },
      { name: "b", files: { "index.html": html(`<div contenteditable="true"><p id="qx030-bbbb">a</p><p id="qx030-bbbb">b</p></div>`) } },
    ],
    oracle: { checks: [C_ID], rgaa: "8.2.1", pieces: ["fingerprint"], items: null, saved: { kind: "fingerprints", relation: "identical" }, allowed: "identical across the pair" },
    baselineLeakExpected: true,
  },
  {
    id: "qx035",
    title: "axe and family C differential pair, protected values differ",
    role: "pair",
    table: "4.3 qx035, 4.5",
    via: "audit",
    markers: ["qx035-aaaa", "qx035-bbbb"],
    variants: [
      {
        name: "a",
        files: { "index.html": html(`<div contenteditable="true"><a href="/x.html" class="qx035-aaaa"></a><input type="text" class="qx035-aaaa"></div>`) },
      },
      {
        name: "b",
        files: { "index.html": html(`<div contenteditable="true"><a href="/x.html" class="qx035-bbbb"></a><input type="text" class="qx035-bbbb"></div>`) },
      },
    ],
    oracle: { checks: [AXE_LINK, C_FIELD], pieces: ["fingerprint"], items: null, saved: { kind: "fingerprints", relation: "identical" }, allowed: "identical across the pair" },
    baselineLeakExpected: true,
  },
  {
    id: "qx031",
    title: "plain input, live value typed by script, reflected into aria-valuetext and data-current",
    role: "leak",
    table: "4.3 qx031",
    via: "audit",
    markers: ["qx031-typedvalue"],
    variants: one(
      `<input type="text" id="f">` +
        typed("qx031-typedvalue", `i.setAttribute("aria-valuetext",i.value);i.setAttribute("data-current",i.value);`),
    ),
    oracle: { checks: [C_FIELD, "axe/label"], rgaa: "11.1.1", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 2 }, allowed: "none" },
    baselineLeakExpected: true,
  },
  {
    id: "qx032",
    title: "plain input, live value reflected into id and class (a duplicate id too)",
    role: "leak",
    table: "4.3 qx032",
    via: "audit",
    markers: ["qx032-livevalue"],
    variants: one(
      `<input type="text" id="f"><div id="d">dup</div>` +
        `<script>const i=document.getElementById("f");i.value="qx032-livevalue";i.id=i.value;i.className=i.value;document.getElementById("d").id=i.value;</script>`,
    ),
    oracle: {
      checks: [C_FIELD, C_ID],
      pieces: ["locator", "fingerprint"],
      items: null,
      saved: { kind: "redacted", count: 1, fingerprintCount: 1 },
      allowed: "none",
    },
    baselineLeakExpected: true,
  },
  {
    id: "qx060",
    title: "invalid sample JSON (V8 quotes an excerpt of the input)",
    role: "leak",
    table: "4.3 qx060",
    via: "cli",
    markers: ["qx060-badjson"],
    variants: one(`<p>unused</p>`),
    rawSample: "qx060-badjson is not json",
    oracle: { checks: [], pieces: ["console"], items: null, saved: { kind: "none" }, allowed: "none" },
    baselineLeakExpected: true,
  },
  {
    id: "qx062",
    title: "page-patched DOM method throwing a marked message",
    role: "leak",
    table: "4.3 qx062",
    via: "audit",
    markers: ["qx062-thrown"],
    variants: one(
      `<a href="/x.html" id="qx062-linkid"></a><input type="text">` +
        `<script>Element.prototype.getAttribute=function(){throw new Error("qx062-thrown")};Element.prototype.querySelectorAll=function(){throw new Error("qx062-thrown")};</script>`,
    ),
    oracle: { checks: [], pieces: ["note", "console"], items: null, saved: { kind: "none" }, allowed: "none; a fixed message" },
    baselineLeakExpected: true,
  },
  {
    id: "qx064",
    title: "engine error from the CLI child process: message and path carry the marker",
    role: "leak",
    table: "4.3 qx064",
    via: "child",
    markers: ["qx064-failpath"],
    variants: one(`<p>ok</p>`),
    badOut: true,
    oracle: { checks: [], pieces: ["console"], items: null, saved: { kind: "none" }, allowed: "none; a fixed class and code" },
    baselineLeakExpected: true,
  },

  // ---- Escaping markers (4.2) --------------------------------------------
  {
    id: "qx101",
    title: "HTML escaping marker, as text and as an attribute value, planted in the qx001 shape",
    role: "leak",
    table: "4.3 qx101 in qx001",
    via: "audit",
    markers: [M101],
    variants: one(
      `<div contenteditable="true"><a href="/x.html" data-note="${asAttr(M101)}"><span aria-hidden="true">${asText(M101)}</span></a></div>`,
    ),
    oracle: { checks: [AXE_LINK], rgaa: "6.2.1", pieces: ["snippet", "locator", "note"], items: 1, saved: { kind: "redacted", count: 3 }, allowed: "none, raw or escaped" },
    baselineLeakExpected: false,
  },
  {
    id: "qx102",
    title: "percent-encoded marker in the page query, in the fragment and in an iframe src, planted in the qx050 shape",
    role: "leak",
    table: "4.3 qx102 in qx050",
    via: "cli",
    markers: [M102, "qx050-query", "qx050-frag", "qx050-srcquery"],
    variants: [
      {
        name: "page",
        files: {
          "index.html": html(`<iframe src="f.html?s=${encodeURIComponent(M102)}&amp;t=qx050-srcquery"></iframe><p>qx050 page</p>`),
          "f.html": html(`<p>frame</p>`),
        },
        urlSuffix: `?q=${encodeURIComponent(M102)}&t=qx050-query#qx050-frag`,
      },
    ],
    oracle: { checks: [], pieces: ["note", "console"], items: null, saved: { kind: "none" }, allowed: "none; query values are masked" },
    baselineLeakExpected: false,
  },
  {
    id: "qx103",
    title: "JSON escaping marker (quote, backslash, U+2028, tab) as a live value, planted in the qx031 shape",
    role: "leak",
    table: "4.3 qx103 in qx031",
    via: "audit",
    markers: [M103],
    variants: one(
      `<input type="text" id="f">` + typed(M103, `i.setAttribute("aria-valuetext",i.value);i.setAttribute("data-current",i.value);`),
    ),
    oracle: { checks: [C_FIELD, "axe/label"], rgaa: "11.1.1", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 2 }, allowed: "none, raw or escaped" },
    baselineLeakExpected: true,
  },

  // ---- Controls (a plain page: the exact text must be present) -----------
  {
    id: "qx200",
    title: "control: plain faulty link, text and id kept",
    role: "control",
    table: "4.3 qx200",
    via: "audit",
    markers: ["qx200-hiddentext", "qx200-linkid"],
    variants: one(`<a href="/x.html" id="qx200-linkid"><span aria-hidden="true">qx200-hiddentext</span></a>`),
    oracle: { expect: [{ check: AXE_LINK, piece: "snippet", contains: `<a href="/x.html" id="qx200-linkid"><span aria-hidden="true">qx200-hiddentext</span></a>` }, { check: AXE_LINK, piece: "locator", contains: "qx200-linkid" }], checks: [AXE_LINK], rgaa: "6.2.1", pieces: ["snippet", "locator"], items: 1, saved: { kind: "text", present: ["qx200-hiddentext", "qx200-linkid"] }, allowed: "present" },
    baselineLeakExpected: false,
  },
  {
    id: "qx201",
    title: "control: plain duplicated id, fingerprint kept",
    role: "control",
    table: "4.3 qx201",
    via: "audit",
    markers: ["qx201-dupid"],
    variants: one(`<p id="qx201-dupid">a</p><p id="qx201-dupid">b</p>`),
    oracle: { expect: [{ check: C_ID, piece: "snippet", contains: `<p id="qx201-dupid">` }, { check: C_ID, piece: "note", contains: "qx201-dupid" }, { check: C_ID, piece: "fingerprint", contains: "qx201-dupid" }], checks: [C_ID], rgaa: "8.2.1", pieces: ["snippet", "locator", "note", "fingerprint"], items: 2, saved: { kind: "text", present: ["qx201-dupid"] }, allowed: "present" },
    baselineLeakExpected: false,
  },
  {
    id: "qx202",
    title: "control: plain frame without a title, cross-origin src",
    role: "control",
    table: "4.3 qx202",
    via: "audit",
    markers: ["qx202-frameid"],
    variants: [
      {
        name: "page",
        files: {
          "index.html": html(`<iframe id="qx202-frameid" src="__CROSS_ORIGIN__/f.html"></iframe>`),
          "f.html": html(`<p>frame</p>`),
        },
      },
    ],
    oracle: { expect: [{ check: C_FRAME, piece: "snippet", contains: `id="qx202-frameid"` }, { check: C_FRAME, piece: "locator", contains: "qx202-frameid" }], checks: [C_FRAME], rgaa: "2.1.1", pieces: ["snippet", "locator"], items: 1, saved: { kind: "text", present: ["qx202-frameid"] }, allowed: "present" },
    baselineLeakExpected: false,
  },
  {
    id: "qx203",
    title: "control: plain font with a title",
    role: "control",
    table: "4.3 qx203",
    via: "audit",
    markers: ["qx203-fonttitle"],
    variants: one(`<font title="qx203-fonttitle" id="qx203-fontid">x</font>`),
    oracle: { expect: [{ check: C_FONT, piece: "snippet", contains: `<font title="qx203-fonttitle" id="qx203-fontid">` }], checks: [C_FONT], rgaa: "10.1.1", pieces: ["snippet", "locator"], items: 1, saved: { kind: "text", present: ["qx203-fonttitle"] }, allowed: "present" },
    baselineLeakExpected: false,
  },
  {
    id: "qx204",
    title: "control: plain pass list member",
    role: "control",
    table: "4.3 qx204",
    via: "audit",
    markers: ["qx204-passlink"],
    variants: one(`<a href="/x.html" id="qx204-passlink">fine</a>`),
    oracle: { expect: [{ check: AXE_LINK, piece: "scope_examined", contains: "qx204-passlink" }], checks: [AXE_LINK], pieces: ["scope_examined"], items: null, saved: { kind: "text", present: ["qx204-passlink"] }, allowed: "present" },
    baselineLeakExpected: false,
  },
  {
    id: "qx205",
    title: "control: benign placeholder on a plain input",
    role: "control",
    table: "4.3 qx205",
    via: "audit",
    markers: ["qx205-samplehint"],
    variants: one(`<input type="text" placeholder="qx205-samplehint" id="qx205-fieldid">`),
    oracle: { expect: [{ check: C_FIELD, piece: "snippet", contains: `placeholder="qx205-samplehint"` }], checks: [C_FIELD], rgaa: "11.1.1", pieces: ["snippet"], items: 1, saved: { kind: "text", present: ["qx205-samplehint"] }, allowed: "present" },
    baselineLeakExpected: false,
  },
  {
    id: "qx206",
    title: "control: plain differential pair, fingerprints must differ",
    role: "pair",
    table: "4.3 qx206, 4.5",
    via: "audit",
    markers: ["qx206-aaaa", "qx206-bbbb"],
    variants: [
      { name: "a", files: { "index.html": html(`<p id="qx206-aaaa">a</p><p id="qx206-aaaa">b</p>`) } },
      { name: "b", files: { "index.html": html(`<p id="qx206-bbbb">a</p><p id="qx206-bbbb">b</p>`) } },
    ],
    oracle: { checks: [C_ID], rgaa: "8.2.1", pieces: ["fingerprint"], items: null, saved: { kind: "fingerprints", relation: "differ" }, allowed: "differs" },
    baselineLeakExpected: false,
  },
  {
    id: "qx207",
    title: "control: plain input with no live value, benign title",
    role: "control",
    table: "4.3 qx207-208",
    via: "audit",
    markers: ["qx207-hinttitle"],
    variants: one(`<input type="text" title="qx207-hinttitle" id="qx207-fieldid">`),
    oracle: { expect: [{ check: C_FIELD, piece: "snippet", contains: `title="qx207-hinttitle"` }], checks: [C_FIELD], rgaa: "11.1.1", pieces: ["snippet", "locator"], items: null, saved: { kind: "text", present: ["qx207-hinttitle"] }, allowed: "present" },
    baselineLeakExpected: false,
  },
  {
    id: "qx208",
    title: "control: plain input with no live value, benign name",
    role: "control",
    table: "4.3 qx207-208",
    via: "audit",
    markers: ["qx208-fieldname"],
    variants: one(`<input type="text" name="qx208-fieldname" id="qx208-fieldid">`),
    oracle: { expect: [{ check: C_FIELD, piece: "snippet", contains: `name="qx208-fieldname"` }], checks: [C_FIELD], rgaa: "11.1.1", pieces: ["snippet", "locator"], items: null, saved: { kind: "text", present: ["qx208-fieldname"] }, allowed: "present" },
    baselineLeakExpected: false,
  },
  {
    id: "qx209",
    title: "cost: plain input with a benign data-testid (value withheld by the allow-list after the build)",
    role: "control",
    table: "4.3 qx209",
    via: "audit",
    markers: ["qx209-testid"],
    variants: one(`<input type="text" data-testid="qx209-testid" id="qx209-fieldid">`),
    oracle: { expect: [{ check: C_FIELD, piece: "snippet", contains: `data-testid="qx209-testid"` }], checks: [C_FIELD], rgaa: "11.1.1", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 1 }, allowed: "baseline: present (a control); after the build: withheld by the allow-list, a cost" },
    baselineLeakExpected: false,
  },
  {
    id: "qx210",
    title: "control and cost: empty value with a class; then a live value not present in any attribute",
    role: "control",
    table: "4.3 qx210",
    via: "audit",
    markers: ["qx210-plain"],
    variants: [
      { name: "empty", files: { "index.html": html(`<input type="text" class="qx210-plain" id="f">`) } },
      { name: "livevalue", files: { "index.html": html(`<input type="text" class="qx210-plain" id="f"><script>document.getElementById("f").value="xy"</script>`) } },
    ],
    oracle: { expect: [{ check: C_FIELD, piece: "snippet", contains: `class="qx210-plain"` }], checks: [C_FIELD], rgaa: "11.1.1", pieces: ["snippet", "locator"], items: null, saved: { kind: "text", present: ["qx210-plain"] }, allowed: "present in both variants" },
    baselineLeakExpected: false,
  },
  {
    id: "qx211",
    title: "control for composites: a plain link containing a plain input with no value, benign text",
    role: "control",
    table: "4.3 qx211-212",
    via: "audit",
    markers: ["qx211-benign"],
    variants: one(`<a href="/x.html" id="qx211-linkid"><input type="text"><span aria-hidden="true">qx211-benign</span></a>`),
    oracle: { expect: [{ check: AXE_LINK, piece: "snippet", contains: `<span aria-hidden="true">qx211-benign</span>` }], checks: [AXE_LINK, "custom/6-2-link-content-name"], rgaa: "6.2.1", pieces: ["snippet", "locator"], items: null, saved: { kind: "text", present: ["qx211-benign"] }, allowed: "present" },
    baselineLeakExpected: false,
  },
  {
    id: "qx212",
    title: "control for composites: a plain div with plain text, no box",
    role: "control",
    table: "4.3 qx211-212",
    via: "audit",
    markers: ["qx212-divid"],
    variants: one(`<div id="qx212-divid">qx212-plaintext</div><div id="qx212-divid">b</div>`),
    oracle: { expect: [{ check: C_ID, piece: "snippet", contains: `<div id="qx212-divid">` }], checks: [C_ID], rgaa: "8.2.1", pieces: ["snippet", "fingerprint"], items: 2, saved: { kind: "text", present: ["qx212-divid"] }, allowed: "present" },
    baselineLeakExpected: false,
  },

  // ---- Q72 condition 1: slots ---------------------------------------------
  {
    id: "qx213",
    title: "slot: a light-DOM child assigned to a slot inside a contenteditable element of the host's open shadow root",
    role: "leak",
    table: "4.3 qx213",
    via: "audit",
    markers: ["qx213-slottext", "qx213-slotdata"],
    variants: one(
      `<div id="host" role="img"><span data-note="qx213-slotdata">qx213-slottext</span></div><div id="host"></div>` +
        `<script>document.querySelector("div#host").attachShadow({mode:"open"}).innerHTML='<div contenteditable="true"><slot></slot></div>'</script>`,
    ),
    oracle: {
      checks: [C_ID, "axe/role-img-alt"],
      rgaa: "8.2.1",
      pieces: ["snippet", "fingerprint"],
      items: null,
      saved: { kind: "redacted", count: 1, fingerprintCount: 1 },
      allowed: "none: the slotted child is withheld in the saved composite and in the fingerprint",
    },
    baselineLeakExpected: true,
  },
  {
    id: "qx214",
    title: "control for qx213: the same host and child with no shadow root",
    role: "control",
    table: "4.3 qx214",
    via: "audit",
    markers: ["qx214-slottext"],
    variants: one(`<div id="host" role="img"><span data-note="qx214-slotdata">qx214-slottext</span></div><div id="host"></div>`),
    oracle: { expect: [{ check: "axe/role-img-alt", piece: "snippet", contains: `data-note="qx214-slotdata">qx214-slottext</span>` }], checks: [C_ID, "axe/role-img-alt"], rgaa: "8.2.1", pieces: ["snippet", "fingerprint"], items: null, saved: { kind: "text", present: ["qx214-slottext"] }, allowed: "present" },
    baselineLeakExpected: false,
  },
];

export const ROWS: readonly Row[] = [...BASE_ROWS, ...MORE_ROWS, ...COMPOSITE_PAIRS];

export function rowById(id: string): Row {
  const r = ROWS.find((x) => x.id === id);
  if (r === undefined) throw new Error(`no row ${id}`);
  return r;
}
