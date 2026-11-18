/**
 * Family B (presentation, RGAA 10.1.1 and 10.1.2): the in-page reading.
 *
 * `scanDocument` runs inside one frame through `frame.evaluate`. It walks the
 * frame's document once and classifies every element (for 10.1.1) and every
 * attribute (for 10.1.2) by the categories of the two check records. It
 * decides nothing: the decision, which depends on where a hit sits and on the
 * doctype, belongs to each check (`../10-1-presentation-*`).
 *
 * The function is serialised by Playwright, so it must not reference anything
 * outside its own body: every list arrives in `input`. It reads only. The one
 * thing it builds is a detached template in a fresh inert HTML document, to
 * parse the text of a `noscript` element; nothing is inserted in the page.
 *
 * Regions (where a hit sits):
 * - `tree`: the document tree, outside shadow trees, with no `noscript` ancestor;
 * - `tree-noscript`: the document tree, outside shadow trees, under a `noscript` element whose content was parsed as elements;
 * - `shadow`: inside an open shadow tree (closed ones are read through CDP, `closed-shadow.ts`);
 * - `template`: inside the content of a `template` element;
 * - `noscript-text`: inside the text of a `noscript` element, parsed as HTML.
 * A region nested in another keeps the outer one when the outer one is
 * `shadow`, so that everything under a shadow root is `shadow`.
 */

export type Region = "tree" | "tree-noscript" | "shadow" | "template" | "noscript-text";

/** Which check a hit is for: `E` 10.1.1 (elements), `A` 10.1.2 (attributes). */
export type HitCheck = "E" | "A";

/**
 * Categories.
 * - 10.1.1: `listed` (a listed element other than u), `u`, `case-variant`,
 *   `other-namespace` (a listed local name outside the HTML namespace),
 *   `obsolete-element` (multicol, nobr, spacer).
 * - 10.1.2: `fault` (a defined pair outside the exceptions and the abstained
 *   pairs), `excepted`, `dimension-pair` (width or height on iframe, video,
 *   input, source), `undefined-pair` (a listed attribute on an HTML element that
 *   defines no such attribute, unknown and custom elements included),
 *   `other-namespace`, `namespaced`, `case-variant`, `obsolete`.
 */
export type HitCategory =
  | "listed"
  | "u"
  | "case-variant"
  | "other-namespace"
  | "obsolete-element"
  | "fault"
  | "excepted"
  | "dimension-pair"
  | "undefined-pair"
  | "namespaced"
  | "obsolete";

export interface Hit {
  check: HitCheck;
  region: Region;
  category: HitCategory;
  /** 10.1.1: the element's qualified name. 10.1.2: `element@attribute`, both qualified names. */
  detail: string;
  locator: string;
  /** The element's start tag. */
  snippet: string;
}

export interface ScanInput {
  presentationElements: string[];
  otherObsoleteElements: string[];
  presentationAttributes: string[];
  /** Attribute → HTML elements it is allowed on (the RGAA exceptions). */
  exceptedPairs: Record<string, string[]>;
  /** Attribute → HTML elements on which the record abstains although the pair may be defined. */
  dimensionPairs: Record<string, string[]>;
  /** Attribute → HTML elements for which HTML 4.01 or the HTML standard defines it. */
  definedPairs: Record<string, string[]>;
  /** Obsolete attribute → HTML elements it counts on, or `null` for any HTML element. */
  obsoleteAttributes: Record<string, string[] | null>;
  /** Hits kept per key (check, region, category) for categories that cannot fault. */
  sampleCap: number;
  /** Hits kept per key for `listed`, `u` and `fault`. */
  faultCap: number;
}

export interface ScanOutput {
  url: string;
  contentType: string;
  doctype: { name: string; publicId: string; systemId: string } | null;
  /** Elements visited, by region. */
  elements: Record<Region, number>;
  shadowRoots: number;
  templates: number;
  noscriptTexts: number;
  /** Hits kept, in document order within each region. */
  hits: Hit[];
  /** Every hit counted, kept or not, by `check|region|category`. */
  totals: Record<string, number>;
  /** `noscript` text that could not be parsed (for example under Trusted Types). */
  unparsedNoscript: { locator: string; reason: string }[];
}

export function totalsKey(check: HitCheck, region: Region, category: HitCategory): string {
  return `${check}|${region}|${category}`;
}

/** Runs in the page. Self-contained: no reference to module scope. */
export function scanDocument(input: ScanInput): ScanOutput {
  const g = globalThis as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const doc = g.document;
  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const toMap = (o: Record<string, string[] | null>): Map<string, Set<string> | null> => {
    const m = new Map<string, Set<string> | null>();
    for (const k of Object.keys(o)) {
      const v = o[k];
      m.set(k, v === null || v === undefined ? null : new Set(v));
    }
    return m;
  };
  const pElems = new Set(input.presentationElements);
  const oElems = new Set(input.otherObsoleteElements);
  const pAttrs = new Set(input.presentationAttributes);
  const excepted = toMap(input.exceptedPairs);
  const dimension = toMap(input.dimensionPairs);
  const defined = toMap(input.definedPairs);
  const obsolete = toMap(input.obsoleteAttributes);

  const asciiLower = (s: string): string => s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
  const has = (m: Map<string, Set<string> | null>, attr: string, el: string): boolean => {
    const s = m.get(attr);
    return s !== undefined && s !== null && s.has(el);
  };
  const qname = (n: any): string => (n.prefix ? `${n.prefix}:${n.localName}` : n.localName);

  const out: ScanOutput = {
    url: String(g.location?.href ?? ""),
    contentType: String(doc.contentType ?? ""),
    doctype: doc.doctype ? { name: doc.doctype.name, publicId: doc.doctype.publicId, systemId: doc.doctype.systemId } : null,
    elements: { tree: 0, "tree-noscript": 0, shadow: 0, template: 0, "noscript-text": 0 },
    shadowRoots: 0,
    templates: 0,
    noscriptTexts: 0,
    hits: [],
    totals: {},
    unparsedNoscript: [],
  };
  const isHtmlDocument = out.contentType === "text/html";

  const segment = (el: any): string => {
    const name = qname(el);
    let index = 0;
    let same = 0;
    const parent = el.parentNode;
    if (parent) {
      for (let s = parent.firstElementChild; s; s = s.nextElementSibling) {
        if (s.localName === el.localName && s.namespaceURI === el.namespaceURI) {
          same++;
          if (s === el) index = same;
        }
      }
    }
    return same > 1 ? `${name}:nth-of-type(${index})` : name;
  };
  const locatorOf = (el: any, prefix: string): string => {
    const parts: string[] = [];
    for (let e = el; e; e = e.parentElement) parts.unshift(segment(e));
    return prefix + parts.join(" > ");
  };
  const startTag = (el: any): string => {
    let s = `<${qname(el)}`;
    const attrs = el.attributes;
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i];
      let v = String(a.value);
      if (v.length > 80) v = `${v.slice(0, 80)}…`;
      s += ` ${a.name}="${v.replace(/"/g, "&quot;")}"`;
    }
    return `${s}>`;
  };

  const record = (check: HitCheck, region: Region, category: HitCategory, detail: string, el: any, prefix: string): void => {
    const key = `${check}|${region}|${category}`;
    const n = (out.totals[key] ?? 0) + 1;
    out.totals[key] = n;
    const cap = category === "listed" || category === "u" || category === "fault" ? input.faultCap : input.sampleCap;
    if (n <= cap) out.hits.push({ check, region, category, detail, locator: locatorOf(el, prefix), snippet: startTag(el) });
  };

  const classifyElement = (ns: string | null, local: string): HitCategory | null => {
    if (ns === HTML_NS) {
      if (pElems.has(local)) return local === "u" ? "u" : "listed";
      if (oElems.has(local)) return "obsolete-element";
      const lower = asciiLower(local);
      if (lower !== local && (pElems.has(lower) || oElems.has(lower))) return "case-variant";
      return null;
    }
    return pElems.has(local) ? "other-namespace" : null;
  };

  const classifyAttribute = (elNs: string | null, elLocal: string, recognised: boolean, a: any): HitCategory | null => {
    const ln: string = a.localName;
    if (a.namespaceURI !== null) return pAttrs.has(ln) ? "namespaced" : null;
    if (pAttrs.has(ln)) {
      if (elNs === HTML_NS) {
        if (has(excepted, ln, elLocal)) return "excepted";
        if (has(dimension, ln, elLocal)) return "dimension-pair";
        if (recognised && has(defined, ln, elLocal)) return "fault";
        return "undefined-pair";
      }
      if (elNs === SVG_NS && elLocal === "svg" && (ln === "width" || ln === "height")) return "excepted";
      return "other-namespace";
    }
    if (obsolete.has(ln)) {
      const els = obsolete.get(ln);
      if (elNs === HTML_NS && (els === null || els === undefined || els.has(elLocal))) return "obsolete";
      return null;
    }
    const lower = asciiLower(ln);
    if (lower !== ln && (pAttrs.has(lower) || obsolete.has(lower))) return "case-variant";
    return null;
  };

  let inert: any = null;
  const parseNoscriptText = (text: string): any => {
    if (inert === null) inert = doc.implementation.createHTMLDocument("");
    const t = inert.createElement("template");
    t.innerHTML = text;
    return t.content;
  };

  type Item = { node: any; region: Region; prefix: string };
  const walk = (root: any, region: Region, prefix: string): void => {
    const stack: Item[] = [];
    const pushChildren = (parent: any, r: Region, p: string): void => {
      for (let c = parent.lastElementChild; c; c = c.previousElementSibling) stack.push({ node: c, region: r, prefix: p });
    };
    pushChildren(root, region, prefix);
    while (stack.length > 0) {
      const { node: el, region: r, prefix: p } = stack.pop() as Item;
      out.elements[r]++;
      const ns: string | null = el.namespaceURI;
      const local: string = el.localName;

      const e = classifyElement(ns, local);
      if (e !== null) record("E", r, e, qname(el), el, p);

      const attrs = el.attributes;
      if (attrs.length > 0) {
        const recognised = Object.prototype.toString.call(el) !== "[object HTMLUnknownElement]";
        for (let i = 0; i < attrs.length; i++) {
          const a = attrs[i];
          const c = classifyAttribute(ns, local, recognised, a);
          if (c !== null) record("A", r, c, `${qname(el)}@${a.name}`, el, p);
        }
      }

      let childRegion = r;
      if (ns === HTML_NS && local === "noscript") {
        if (r === "tree") childRegion = "tree-noscript";
        if (isHtmlDocument) {
          let text = "";
          for (let t = el.firstChild; t; t = t.nextSibling) if (t.nodeType === 3) text += t.data;
          if (text.includes("<")) {
            out.noscriptTexts++;
            const where = locatorOf(el, p);
            try {
              const fragment = parseNoscriptText(text);
              walk(fragment, r === "shadow" ? "shadow" : "noscript-text", `${where} >> noscript-text >> `);
            } catch (err) {
              out.unparsedNoscript.push({ locator: where, reason: String((err as Error)?.message ?? err) });
            }
          }
        }
      }
      if (ns === HTML_NS && local === "template" && el.content) {
        out.templates++;
        walk(el.content, r === "shadow" ? "shadow" : "template", `${locatorOf(el, p)} >> template-content >> `);
      }
      const shadow = el.shadowRoot;
      if (shadow) {
        out.shadowRoots++;
        walk(shadow, "shadow", `${locatorOf(el, p)} >> shadow-root >> `);
      }
      pushChildren(el, childRegion, p);
    }
  };

  walk(doc, "tree", "");
  return out;
}
