/**
 * Composite pairs (design 4.3 qx038, qx215, qx217 and 4.5). The snippet channel of these composites is masked by
 * today's sanitiser, so the snippet rows (`qx038s`, `qx215s`, `qx217s` in rows2.ts) are not reached at baseline. The
 * fingerprint is built from the raw composite, so a pair that differs only inside the protected subtree shows a leak
 * there. After the build the expectation is identical fingerprints.
 */
import type { Row, Variant } from "./types.ts";

const C_ID = "custom/8-2-id-duplicate";
const AXE_IMG = "axe/role-img-alt";

const html = (body: string): string =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>qx page</title></head><body>${body}</body></html>`;
const twin = (id: string): string => `<div id="${id}"></div>`;

const compositePair = (id: string, title: string, body: (m: string) => string, allowed: string, xhtml = false): Row => {
  const variant = (name: string, m: string): Variant =>
    xhtml
      ? {
          name,
          page: "index.xhtml",
          files: {
            "index.xhtml":
              `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="fr"><head><title>qx page</title></head><body>` +
              `${body(m)}${twin("cmp-outer")}</body></html>`,
          },
        }
      : { name, files: { "index.html": html(`${body(m)}${twin("cmp-outer")}`) } };
  return {
    id,
    title,
    role: "pair",
    table: `4.3 ${id.slice(0, 5)}, 4.5`,
    via: "audit",
    markers: [`${id.slice(0, 5)}-${id.slice(5)}aaaa`, `${id.slice(0, 5)}-${id.slice(5)}bbbb`],
    variants: [variant("a", `${id.slice(0, 5)}-${id.slice(5)}aaaa`), variant("b", `${id.slice(0, 5)}-${id.slice(5)}bbbb`)],
    oracle: { checks: [C_ID, AXE_IMG], rgaa: "8.2.1", pieces: ["fingerprint"], items: null, saved: { kind: "fingerprints", relation: "identical" }, allowed },
    baselineLeakExpected: true,
  };
};

export const COMPOSITE_PAIRS: readonly Row[] = [
  compositePair(
    "qx038",
    "composite pair: a contenteditable descendant whose text differs across the pair",
    (m) => `<div role="img" id="cmp-outer"><span contenteditable="true">${m}</span></div>`,
    "identical across the pair (the descendant replaced whole)",
  ),
  compositePair(
    "qx215",
    "template pair: template content (an input value, a contenteditable, a nested template) differs across the pair",
    (m) =>
      `<div role="img" id="cmp-outer"><template><input type="text" value="${m}"><div contenteditable="true">${m}</div><template><div contenteditable="true">${m}</div></template></template></div>`,
    "identical across the pair (per node). A detached template-content case cannot be planted from a fixture: it needs engine support",
  ),
  compositePair(
    "qx215x",
    "template pair in an XHTML document (template content under the XML serialiser)",
    (m) => `<div role="img" id="cmp-outer"><template><input type="text" value="${m}"/><div contenteditable="true">${m}</div></template></div>`,
    "identical across the pair (or the whole composite withheld)",
    true,
  ),
  compositePair(
    "qx217",
    "noscript pair: input-like markup inside noscript differs across the pair",
    (m) => `<div role="img" id="cmp-outer"><noscript><input type="text" title="${m}" value="${m}"></noscript></div>`,
    "identical across the pair (the fragment or the whole composite withheld)",
  ),
  {
    id: "qx219p",
    title: "control for the composite pairs: a plain composite whose text differs, fingerprints must differ",
    role: "pair",
    table: "4.3 qx219, 4.5",
    via: "audit",
    markers: ["qx219-paaaa", "qx219-pbbbb"],
    variants: [
      { name: "a", files: { "index.html": html(`<div role="img" id="cmp-outer">qx219-paaaa</div>${twin("cmp-outer")}`) } },
      { name: "b", files: { "index.html": html(`<div role="img" id="cmp-outer">qx219-pbbbb</div>${twin("cmp-outer")}`) } },
    ],
    oracle: { checks: [C_ID, AXE_IMG], rgaa: "8.2.1", pieces: ["fingerprint"], items: null, saved: { kind: "fingerprints", relation: "differ" }, allowed: "differs" },
    baselineLeakExpected: false,
  },
];
