/**
 * Second slice of planted fixtures (design 4.3): boxes by role, shadow and slot
 * rows, frames under boxes, form-field and reflected-value rows, composites
 * (qx037 to qx039, qx215 to qx219) and the tokens row. Written from the design
 * table and the fixture source alone, like `rows.ts`.
 *
 * Not here: rows needing a test provider or the probe (qx040 to qx049), steps
 * and sessions, the redirect case, and qx218's forced timeout (an engine hook;
 * see the `test.todo` in `oracle.privacy.ts`).
 */
import type { Oracle, Row, Variant } from "./types.ts";

const AXE_LINK = "axe/link-name";
const C_FONT = "custom/10-1-presentation-elements";
const C_ID = "custom/8-2-id-duplicate";
const C_FIELD = "custom/11-1-field-label-mechanism";
const C_FRAME = "custom/2-1-frame-title-attribute";
const C_LANG = "custom/8-3-default-lang-present";
const C_LINK = "custom/6-2-link-content-name";

/** Escaping marker for decoded values (qx216): ampersand, quote, non-ASCII. */
export const M216 = 'qx216-a&b"é';

const html = (body: string, head = ""): string =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>qx page</title>${head}</head><body>${body}</body></html>`;
const one = (body: string): Variant[] => [{ name: "page", files: { "index.html": html(body) } }];

/** A faulty link (no accessible name: its text is aria-hidden) carrying a marker in its id and text. */
const badLink = (n: string): string => `<a href="/x.html" id="${n}-linkid"><span aria-hidden="true">${n}-hidden</span></a>`;
const protectedLink = (id: string, open: string): Row => ({
  id,
  title: `faulty link in a box: ${open}`,
  role: "leak",
  table: "4.3 qx004-006",
  via: "audit",
  markers: [`${id}-linkid`, `${id}-hidden`],
  variants: one(`${open}${badLink(id)}</div>`),
  oracle: { checks: [AXE_LINK], pieces: ["snippet", "locator", "note"], items: 1, saved: { kind: "redacted", count: 3 }, allowed: "none" },
  baselineLeakExpected: false,
});

const FONT_ORACLE: Oracle = { checks: [C_FONT], rgaa: "10.1.1", pieces: ["snippet", "locator"], items: 1, saved: { kind: "redacted", count: 2 }, allowed: "none" };
const SLOT_FONT = (n: string): string => `<font title="${n}-title" id="${n}-fontid">${n}-text</font>`;

/** A plain input unlabeled, its live value typed by script. */
const typedInput = (marker: string, tail: string, attrs = ""): string =>
  `<input type="text" id="f" ${attrs}><script>const i=document.getElementById("f");i.value=${JSON.stringify(marker)};${tail}</script>`;

/** A duplicated id (8.2.1) pairs an element with a plain empty twin. */
const twin = (id: string): string => `<div id="${id}"></div>`;

const COMPOSITE_ID: Oracle = {
  checks: [C_ID, "axe/role-img-alt"],
  rgaa: "8.2.1",
  pieces: ["snippet", "fingerprint"],
  items: null,
  saved: { kind: "redacted", count: 1 },
  allowed: "none; the guarded descendant replaced, counted per descendant (whole composite: 1)",
};

export const MORE_ROWS: readonly Row[] = [
  // ---- Boxes by role, designMode (qx004 to qx009) ---------------------------
  protectedLink("qx004", `<div role="textbox">`),
  protectedLink("qx005", `<div role="searchbox">`),
  protectedLink("qx006", `<div role="combobox">`),
  {
    id: "qx007",
    title: "text under html role=textbox, no lang (8.3.1)",
    role: "leak",
    table: "4.3 qx007",
    via: "audit",
    markers: ["qx007-boxtext"],
    variants: [
      {
        name: "page",
        files: { "index.html": `<!doctype html><html role="textbox"><head><meta charset="utf-8"><title>qx page</title></head><body><p>qx007-boxtext</p></body></html>` },
      },
    ],
    oracle: { checks: [C_LANG], rgaa: "8.3.1", pieces: ["snippet", "locator"], items: null, saved: { kind: "redacted", count: 2 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx008",
    title: "framed designMode document holding a faulty link",
    role: "leak",
    table: "4.3 qx008-009",
    via: "audit",
    markers: ["qx008-linkid", "qx008-hidden"],
    variants: [
      {
        name: "page",
        files: {
          "index.html": html(`<iframe title="f" src="/f.html"></iframe>`),
          "f.html": html(`${badLink("qx008")}<script>document.designMode="on"</script>`),
        },
      },
    ],
    oracle: { checks: [AXE_LINK], pieces: ["snippet", "locator"], items: 1, saved: { kind: "redacted", count: 3 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx009",
    title: "plain frame inside a designMode document",
    role: "leak",
    table: "4.3 qx008-009",
    via: "audit",
    markers: ["qx009-linkid", "qx009-hidden"],
    variants: [
      {
        name: "page",
        files: {
          "index.html": html(`<script>document.designMode="on"</script><iframe title="f" src="/f.html"></iframe>`),
          "f.html": html(badLink("qx009")),
        },
      },
    ],
    oracle: { checks: [AXE_LINK], pieces: ["snippet", "locator"], items: 1, saved: { kind: "redacted", count: 3 }, allowed: "none" },
    baselineLeakExpected: false,
  },

  // ---- Shadow, slot and manual slot under boxes (qx010, qx012, qx013) -------
  {
    id: "qx010",
    title: "open shadow root under a box",
    role: "leak",
    table: "4.3 qx010-013",
    via: "audit",
    markers: ["qx010-title", "qx010-text", "qx010-fontid"],
    variants: one(
      `<div contenteditable="true"><div id="h"></div></div><script>document.getElementById("h").attachShadow({mode:"open"}).innerHTML=${JSON.stringify(SLOT_FONT("qx010"))}</script>`,
    ),
    oracle: FONT_ORACLE,
    baselineLeakExpected: false,
  },
  {
    id: "qx012",
    title: "light-DOM child slotted into a shadow root under a box",
    role: "leak",
    table: "4.3 qx010-013",
    via: "audit",
    markers: ["qx012-title", "qx012-text", "qx012-fontid"],
    variants: one(
      `<div contenteditable="true"><div id="h">${SLOT_FONT("qx012")}</div></div><script>document.getElementById("h").attachShadow({mode:"open"}).innerHTML="<slot></slot>"</script>`,
    ),
    oracle: FONT_ORACLE,
    baselineLeakExpected: false,
  },
  {
    id: "qx013",
    title: "manually assigned slot under a box",
    role: "leak",
    table: "4.3 qx010-013",
    via: "audit",
    markers: ["qx013-title", "qx013-text", "qx013-fontid"],
    variants: one(
      `<div contenteditable="true"><div id="h">${SLOT_FONT("qx013")}</div></div>` +
        `<script>const h=document.getElementById("h");const r=h.attachShadow({mode:"open",slotAssignment:"manual"});const s=document.createElement("slot");r.appendChild(s);s.assign(h.firstElementChild)</script>`,
    ),
    oracle: FONT_ORACLE,
    baselineLeakExpected: false,
  },

  // ---- Frames under boxes (qx014 to qx016) and an axe frame gap (qx018) -----
  {
    id: "qx014",
    title: "same-origin frame under a box",
    role: "leak",
    table: "4.3 qx014-016",
    via: "audit",
    markers: ["qx014-frameid", "qx014-urlq", "qx014-title", "qx014-text"],
    variants: [
      {
        name: "page",
        files: {
          "index.html": html(`<div contenteditable="true"><iframe id="qx014-frameid" src="/f.html?k=qx014-urlq"></iframe></div>`),
          "f.html": html(SLOT_FONT("qx014")),
        },
      },
    ],
    oracle: { checks: [C_FRAME, C_FONT], pieces: ["snippet", "locator", "note"], items: null, saved: { kind: "redacted", count: 3 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx015",
    title: "cross-origin frame under a box",
    role: "leak",
    table: "4.3 qx014-016",
    via: "audit",
    markers: ["qx015-frameid", "qx015-urlq", "qx015-title", "qx015-text"],
    variants: [
      {
        name: "page",
        files: {
          "index.html": html(`<div contenteditable="true"><iframe id="qx015-frameid" src="__CROSS_ORIGIN__/f.html?k=qx015-urlq"></iframe></div>`),
          "f.html": html(SLOT_FONT("qx015")),
        },
      },
    ],
    oracle: { checks: [C_FRAME, C_FONT], pieces: ["snippet", "locator", "note"], items: null, saved: { kind: "redacted", count: 3 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx016",
    title: "nested frames under a box: same-origin, then cross-origin",
    role: "leak",
    table: "4.3 qx014-016",
    via: "audit",
    markers: ["qx016-frameid", "qx016-innerid", "qx016-urlq", "qx016-title", "qx016-text"],
    variants: [
      {
        name: "page",
        files: {
          "index.html": html(`<div contenteditable="true"><iframe id="qx016-frameid" src="/outer.html"></iframe></div>`),
          "outer.html": html(`<iframe id="qx016-innerid" src="__CROSS_ORIGIN__/f.html?k=qx016-urlq"></iframe>`),
          "f.html": html(SLOT_FONT("qx016")),
        },
      },
    ],
    oracle: { checks: [C_FRAME, C_FONT], pieces: ["snippet", "locator", "note"], items: null, saved: { kind: "redacted", count: 3 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx018",
    title: "protected frame element whose document cannot be loaded (an axe frame gap)",
    role: "leak",
    table: "4.3 qx018",
    via: "audit",
    markers: ["qx018-frameid", "qx018-frametitle"],
    variants: one(`<div contenteditable="true"><iframe id="qx018-frameid" title="qx018-frametitle" src="http://127.0.0.1:1/gap.html"></iframe></div>`),
    oracle: { checks: [AXE_LINK], pieces: ["locator", "snippet"], items: null, saved: { kind: "redacted", count: 2 }, allowed: "none" },
    baselineLeakExpected: false,
  },

  // ---- Form fields (qx020, qx021, qx027 to qx029, qx033, qx034, qx036) ------
  {
    id: "qx020",
    title: "input value attribute",
    role: "leak",
    table: "4.3 qx020-021",
    via: "audit",
    markers: ["qx020-inputvalue"],
    variants: one(`<input type="text" value="qx020-inputvalue">`),
    oracle: { checks: [C_FIELD, "axe/label"], rgaa: "11.1.1", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 1 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx021",
    title: "textarea text",
    role: "leak",
    table: "4.3 qx020-021",
    via: "audit",
    markers: ["qx021-areatext"],
    variants: one(`<textarea>qx021-areatext</textarea>`),
    oracle: { checks: [C_FIELD, "axe/label"], rgaa: "11.1.1", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 1 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx027",
    title: "a value inside a link, as the link's accessible name",
    role: "leak",
    table: "4.3 qx027",
    via: "audit",
    markers: ["qx027-linkvalue"],
    variants: one(`<a href="/x.html"><input type="text" value="qx027-linkvalue"></a>`),
    oracle: { checks: [AXE_LINK, C_LINK], rgaa: "6.2.1", pieces: ["snippet", "locator", "note"], items: null, saved: { kind: "redacted", count: 0 }, allowed: "none; per piece" },
    baselineLeakExpected: false,
  },
  {
    id: "qx028",
    title: "aria-valuetext on a combobox box",
    role: "leak",
    table: "4.3 qx028",
    via: "audit",
    markers: ["qx028-valuetext", "qx028-hidden"],
    variants: one(`<div role="combobox" aria-valuetext="qx028-valuetext"><a href="/x.html"><span aria-hidden="true">qx028-hidden</span></a></div>`),
    oracle: { checks: [AXE_LINK], pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 3 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx029",
    title: "placeholder inside a box",
    role: "leak",
    table: "4.3 qx029",
    via: "audit",
    markers: ["qx029-placeholder"],
    variants: one(`<div contenteditable="true"><input type="text" placeholder="qx029-placeholder"></div>`),
    oracle: { checks: [C_FIELD], rgaa: "11.1.1", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 3 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx033",
    title: "live value reflected into an allow-listed title",
    role: "leak",
    table: "4.3 qx033",
    via: "audit",
    markers: ["qx033-livetitle"],
    variants: one(typedInput("qx033-livetitle", `i.title=i.value;`)),
    oracle: { checks: [C_FIELD], rgaa: "11.1.1", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 1 }, allowed: "none (live-value match)" },
    baselineLeakExpected: false,
  },
  {
    id: "qx034",
    title: "2-character live value inside a class and a title: both withheld",
    role: "leak",
    table: "4.3 qx034",
    via: "audit",
    markers: ["qx034-wrapper", "qx034-hint"],
    variants: one(
      `<input type="text" id="f" class="qx034-wrapper" title="qx034-hint"><script>document.getElementById("f").value="qx"</script>`,
    ),
    oracle: { checks: [C_FIELD], rgaa: "11.1.1", pieces: ["snippet", "locator"], items: null, saved: { kind: "redacted", count: 2 }, allowed: "none: no short-value exception (Q71)" },
    baselineLeakExpected: false,
  },
  {
    id: "qx036",
    title: "1-character live value inside an allow-listed title: value withheld",
    role: "leak",
    table: "4.3 qx036",
    via: "audit",
    markers: ["qx036-zebra"],
    variants: one(`<input type="text" id="f" title="qx036-zebra"><script>document.getElementById("f").value="z"</script>`),
    oracle: { checks: [C_FIELD], rgaa: "11.1.1", pieces: ["snippet"], items: null, saved: { kind: "redacted", count: 1 }, allowed: "none" },
    baselineLeakExpected: false,
  },
  {
    id: "qx063",
    title: "browser error with the marker in the page URL query: a not-established target",
    role: "leak",
    table: "4.3 qx063",
    via: "audit",
    markers: ["qx063-badurl"],
    variants: [{ name: "page", files: { "index.html": html("<p>unused</p>") }, pageUrl: "http://127.0.0.1:1/p?q=qx063-badurl" }],
    oracle: { checks: [], pieces: ["note", "console"], items: null, saved: { kind: "none" }, allowed: "none; a fixed message" },
    baselineLeakExpected: false,
  },

  // ---- Composites (qx037 to qx039, qx215 to qx219) --------------------------
  {
    id: "qx037",
    title: "composite: a plain link around a plain input, the live value reflected into the input and the link title",
    role: "leak",
    table: "4.3 qx037",
    via: "audit",
    markers: ["qx037-typedvalue"],
    variants: one(
      `<a href="/x.html" id="lk"><input type="text" id="f"></a>` +
        `<script>const i=document.getElementById("f");i.value="qx037-typedvalue";i.setAttribute("data-current",i.value);document.getElementById("lk").title=i.value</script>`,
    ),
    oracle: { checks: [AXE_LINK, C_LINK], rgaa: "6.2.1", pieces: ["snippet", "fingerprint"], items: null, saved: { kind: "redacted", count: 0 }, allowed: "none; per piece" },
    baselineLeakExpected: false,
  },
  {
    id: "qx038s",
    title: "composite: a plain element with a duplicated id, around a contenteditable descendant",
    role: "leak",
    table: "4.3 qx038",
    via: "audit",
    markers: ["qx038-boxtext"],
    variants: one(`<div role="img" id="cmp-outer"><span contenteditable="true">qx038-boxtext</span></div>${twin("cmp-outer")}`),
    oracle: { checks: [C_ID, "axe/role-img-alt"], pieces: ["snippet", "fingerprint"], items: null, saved: { kind: "redacted", count: 1 }, allowed: "none; the descendant replaced whole: 1 per descendant" },
    baselineLeakExpected: false,
  },
  {
    id: "qx039",
    title: "composite whose subtree changes during the walk (a script mutates a descendant continuously)",
    role: "leak",
    table: "4.3 qx039",
    via: "audit",
    markers: ["qx039-first", "qx039-second"],
    variants: one(
      `<div role="img" id="cmp-outer"><span id="m">qx039-first</span></div>${twin("cmp-outer")}` +
        `<script>const m=document.getElementById("m");let k=0;setInterval(()=>{m.textContent=(k++%2)?"qx039-first":"qx039-second"},1)</script>`,
    ),
    oracle: { checks: [C_ID, "axe/role-img-alt"], pieces: ["snippet", "fingerprint"], items: null, saved: { kind: "redacted", count: 1 }, allowed: "none; the whole composite withheld, counted 1" },
    baselineLeakExpected: false,
  },
  {
    id: "qx215s",
    title: "template content: an input value and a contenteditable inside a template in a plain composite",
    role: "leak",
    table: "4.3 qx215",
    via: "audit",
    markers: ["qx215-v", "qx215-b"],
    variants: one(
      `<div role="img" id="cmp-outer"><template><input type="text" value="qx215-v"><div contenteditable="true">qx215-b</div></template></div>${twin("cmp-outer")}`,
    ),
    oracle: { ...COMPOSITE_ID, allowed: "none; per node (the detached or unsupported template case is not built here)" },
    baselineLeakExpected: false,
  },
  {
    id: "qx216",
    title: "decoded value with ampersand, quote and non-ASCII, reflected into its own title and a neighbour link's title (HTML and XHTML variants)",
    role: "leak",
    table: "4.3 qx216",
    via: "audit",
    markers: [M216],
    variants: [
      ...one(

      `<div role="img" id="cmp-outer"><input type="text" id="f"><a href="/x.html" id="lk">n</a></div>${twin("cmp-outer")}` +
        `<script>const i=document.getElementById("f");i.value=${JSON.stringify(M216)};i.title=i.value;document.getElementById("lk").title=i.value</script>`,
      ),
      {
        name: "xhtml",
        page: "index.xhtml",
        files: {
          "index.xhtml":
            `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="fr"><head><title>qx page</title></head><body>` +
            `<div role="img" id="cmp-outer"><input type="text" id="f"/><a href="/x.html" id="lk">n</a></div><div role="img" id="cmp-outer"></div>` +
            `<script>//<![CDATA[\nconst i=document.getElementById("f");i.value=${JSON.stringify(M216)};i.title=i.value;document.getElementById("lk").title=i.value;\n//]]></script></body></html>`,
        },
      },
    ],
    oracle: { ...COMPOSITE_ID, allowed: "none, raw or escaped" },
    baselineLeakExpected: false,
  },
  {
    id: "qx217s",
    title: "noscript content that looks like input markup, inside a plain composite",
    role: "leak",
    table: "4.3 qx217",
    via: "audit",
    markers: ["qx217-n"],
    variants: one(`<div role="img" id="cmp-outer"><noscript><input type="text" value="qx217-n"></noscript></div>${twin("cmp-outer")}`),
    oracle: { ...COMPOSITE_ID, allowed: "none; the fragment or the whole composite withheld" },
    baselineLeakExpected: false,
  },
  {
    id: "qx218",
    title: "nested field two levels down in a plain composite (the forced-timeout case needs an engine hook: test.todo)",
    role: "leak",
    table: "4.3 qx218",
    via: "audit",
    markers: ["qx218-attr", "qx218-live"],
    variants: one(
      `<div role="img" id="cmp-outer"><div><div><input type="text" id="f" value="qx218-attr"></div></div></div>${twin("cmp-outer")}` +
        `<script>document.getElementById("f").value="qx218-live"</script>`,
    ),
    oracle: { ...COMPOSITE_ID, allowed: "none; the nested field withheld when the walk completes" },
    baselineLeakExpected: false,
  },
  {
    id: "qx219",
    title: "control for qx215 to qx218: a plain composite with text only",
    role: "control",
    table: "4.3 qx219",
    via: "audit",
    markers: ["qx219-plain"],
    variants: one(`<div role="img" id="cmp-outer">qx219-plain</div>${twin("cmp-outer")}`),
    oracle: {
      expect: [{ check: "axe/role-img-alt", piece: "snippet", contains: `<div role="img" id="cmp-outer">qx219-plain</div>` }],
      checks: [C_ID, "axe/role-img-alt"],
      rgaa: "8.2.1",
      pieces: ["snippet", "fingerprint"],
      items: null,
      saved: { kind: "text", present: ["qx219-plain"] },
      allowed: "present",
    },
    baselineLeakExpected: false,
  },

  // ---- Tokens: page text outside any box ------------------------------------
  {
    id: "tokens",
    title: "token-shaped text outside any box: Bearer value and a secret assignment",
    role: "leak",
    table: "4.3 tokens",
    via: "audit",
    markers: ["qx990-tokenvalue", "qx991-secretvalue"],
    variants: one(
      `<a href="/x.html" id="tok-link"><span aria-hidden="true">Bearer qx990-tokenvalue api_key=qx991-secretvalue</span></a>`,
    ),
    oracle: { checks: [AXE_LINK], pieces: ["snippet", "note", "locator"], items: 1, saved: { kind: "redacted", count: 0 }, allowed: "none; the sanitiser counts, and the guard changes nothing" },
    baselineLeakExpected: false,
  },
];
