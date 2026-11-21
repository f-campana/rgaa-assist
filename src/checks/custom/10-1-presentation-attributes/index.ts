/**
 * `custom/10-1-presentation-attributes` (RGAA test 10.1.2), as its record in
 * `src/rulesets/rgaa-4.1.2/checks.json` states it. The page is read by the
 * family B provider (`../family-b/`); this module decides from that reading,
 * in the record's order: (1) fault, (2) cannot tell, (3) no fault. Never
 * inapplicable.
 *
 * Q49: a defined pair on an `iframe` element is a fault whoever inserted the
 * element (frameborder on a third-party badge). The document inside the
 * frame is a nested browsing context, where (2) applies.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckDefinition, CheckResult } from "../../types.ts";
import { REGION_LABEL, cannotTellResult, faultResult, nestedLabel, noFaultResult } from "../family-b/evidence.ts";
import type { Abstention, Fault, Sample } from "../family-b/evidence.ts";
import type { PageReading } from "../family-b/read.ts";
import { totalsKey } from "../family-b/scan.ts";
import type { HitCategory, Region, ScanOutput } from "../family-b/scan.ts";

export const ATTRIBUTES_CHECK_ID = "custom/10-1-presentation-attributes";

export interface AttributeLists {
  version: string;
  presentationAttributes: string[];
  exceptedPairs: Record<string, string[]>;
  dimensionPairs: Record<string, string[]>;
  obsoleteAttributes: Record<string, string[] | null>;
  definedPairs: Record<string, string[]>;
}

// RECORD: the record defines a "defined pair" by reference to HTML 4.01 and the
// HTML standard and gives examples. `lists.json` pins the full table: every
// example, completed from those two texts as the builder knew them, with no
// source downloaded to confirm the additions (align on embed,
// background on thead, tbody and tfoot, align, hspace, vspace and width on
// applet, which Chromium treats as unknown anyway). A pair missing from the
// table gives cannot_tell, never a fault. "Case variant": a name that "becomes
// one" when ASCII-lowercased is read as becoming a listed attribute or one of
// the obsolete attributes of (2), as the parallel wording of 10.1.1 says.
export const ATTRIBUTE_LISTS = JSON.parse(readFileSync(join(import.meta.dirname, "lists.json"), "utf8")) as AttributeLists;

export const attributesDefinition: CheckDefinition = {
  id: ATTRIBUTES_CHECK_ID,
  version: "1.0.3",
  defaultOptions: Object.freeze({
    listsVersion: ATTRIBUTE_LISTS.version,
    /** Instances listed per abstention (and locators in a no_fault scope). */
    sampleCap: 20,
    // RECORD: the record says to name each faulty element and attribute; past this cap the
    // evidence gives the total instead, to keep the run file bounded on old
    // table layouts. The outcome is unaffected.
    /** Faulty attributes named; beyond it the evidence gives the total. */
    faultCap: 1000,
    /** Time allowed to read one document. */
    frameTimeoutMs: 15000,
  }),
};

const WHAT =
  "the attributes align, alink, background, bgcolor, border, cellpadding, cellspacing, char, charoff, clear, color, compact, frameborder, hspace, link, " +
  "marginheight, marginwidth, text, valign, vlink, vspace, size, width and height, their case variants and namespaced forms, and the obsolete attributes " +
  "bordercolor, face, frame on table, rules, nowrap, noshade, scrolling, leftmargin, rightmargin, topmargin and bottommargin";

const BRANCH: Readonly<Record<HitCategory, string>> = {
  fault: "a defined pair outside the exceptions",
  excepted: "a listed attribute on an excepted element (size on select; width or height on img, object, embed, canvas or svg)",
  "dimension-pair": "width or height on iframe, video, input or source",
  "undefined-pair": "a listed attribute on an HTML element that defines no such attribute (a custom element, an unknown element, or a standard element without it)",
  "other-namespace": "a listed attribute on an element in another namespace (SVG, MathML), other than width and height on the svg element itself",
  namespaced: "an attribute in a namespace whose local name is a listed attribute",
  "case-variant": "a case variant (an attribute in no namespace whose name becomes a listed or obsolete attribute when ASCII-lowercased)",
  obsolete: "an HTML element carrying an obsolete presentational attribute that the HTML standard lists and RGAA does not name",
  // Not 10.1.2 categories.
  listed: "",
  u: "",
  "obsolete-element": "",
};

const A_CATEGORIES: readonly HitCategory[] = ["fault", "excepted", "dimension-pair", "undefined-pair", "other-namespace", "namespaced", "case-variant", "obsolete"];
const REGIONS: readonly Region[] = ["tree", "tree-noscript", "shadow", "template", "noscript-text"];

function samples(scan: ScanOutput, region: Region, category: HitCategory, cap: number): Sample[] {
  return scan.hits
    .filter((h) => h.check === "A" && h.region === region && h.category === category)
    .slice(0, cap)
    .map((h) => ({ locator: h.locator, snippet: h.snippet }));
}

function total(scan: ScanOutput, region: Region, category: HitCategory): number {
  return scan.totals[totalsKey("A", region, category)] ?? 0;
}

/**
 * Whether a hit abstains, by region, in the top-level document.
 *
 * - Document tree (with or without a noscript ancestor: (1) excludes only
 *   shadow trees): every category but `fault` (decided by step 1) and
 *   `excepted` (allowed).
 * - Shadow tree: "a listed attribute on an element inside a shadow tree",
 *   with no exception, so `excepted` too.
 * - Template content and noscript text: "an element with a listed attribute
 *   that would be a fault or an abstention by these rules", so not `excepted`.
 */
function abstainsInTop(region: Region, category: HitCategory): boolean {
  switch (region) {
    case "tree":
    case "tree-noscript":
      return category !== "fault" && category !== "excepted";
    case "shadow":
      // RECORD: "a listed attribute on an element inside a shadow tree" names no
      // exception, unlike the template clause ("that would be a fault or an
      // abstention"), so an excepted pair (width on img) inside a shadow tree
      // abstains. Implemented as written.
      return true;
    case "template":
    case "noscript-text":
      return category !== "excepted";
  }
}

function regionBranch(region: Region, category: HitCategory): string {
  switch (region) {
    case "tree":
      return BRANCH[category];
    case "tree-noscript":
      return `${BRANCH[category]}, under a noscript element`;
    case "shadow":
      return `${BRANCH[category]}, inside a shadow tree`;
    case "template":
    case "noscript-text":
      return `${REGION_LABEL[region]} holding ${BRANCH[category]}`;
  }
}

export function decideAttributes(reading: PageReading, options: Readonly<Record<string, unknown>>): CheckResult {
  const sampleCap = positive(options["sampleCap"], 20);
  const top = reading.top;

  // (1) Fault: in the top-level document tree, outside any shadow tree, on any
  // element, hidden or not, a defined pair outside the exceptions and the abstained pairs.
  const faultHits = top.hits.filter((h) => h.check === "A" && h.category === "fault" && (h.region === "tree" || h.region === "tree-noscript"));
  const faultTotal = total(top, "tree", "fault") + total(top, "tree-noscript", "fault");

  // (2) Cannot tell.
  // RECORD: the clauses of (2) that name no place (case variant, undefined pair,
  // dimension pair, other namespace, namespaced, obsolete attribute) are applied
  // wherever the check reads: the document tree, shadow trees, template content,
  // noscript text and nested documents. Each of those places already abstains on
  // a listed attribute by its own clause, so this widens the abstention only to
  // case variants and obsolete attributes found there.
  const abstentions: Abstention[] = [];
  const where = "the top-level document";
  for (const region of REGIONS) {
    for (const category of A_CATEGORIES) {
      const count = total(top, region, category);
      if (count === 0 || !abstainsInTop(region, category)) continue;
      abstentions.push({ branch: regionBranch(region, category), where, count, samples: samples(top, region, category, sampleCap) });
    }
  }
  for (const u of top.unparsedNoscript) {
    // RECORD: see the same point in custom/10-1-presentation-elements.
    abstentions.push({ branch: `the text of a noscript element, which could not be parsed as HTML (${u.reason})`, where: u.locator, count: 0, samples: [] });
  }
  for (const n of reading.nested) {
    if (n.scan === undefined) {
      abstentions.push({ branch: `a nested browsing context whose document the check cannot read (${n.unreadable ?? "unknown"})`, where: nestedLabel(n), count: 0, samples: [] });
      continue;
    }
    // RECORD: "a listed attribute in the document of a nested browsing context"
    // names no exception, so an excepted pair (width on img) in a framed
    // document abstains too. Implemented as written.
    for (const region of REGIONS) {
      for (const category of A_CATEGORIES) {
        const count = total(n.scan, region, category);
        if (count === 0) continue;
        abstentions.push({
          branch: `${BRANCH[category]}, in the document of a nested browsing context (${REGION_LABEL[region]})`,
          where: nestedLabel(n),
          count,
          samples: samples(n.scan, region, category, sampleCap),
        });
      }
    }
    for (const u of n.scan.unparsedNoscript) {
      abstentions.push({ branch: `the text of a noscript element, which could not be parsed as HTML (${u.reason})`, where: `${nestedLabel(n)}: ${u.locator}`, count: 0, samples: [] });
    }
  }
  if (reading.closed.totals.A > 0) {
    abstentions.push({
      branch: "a listed attribute (or a case variant, namespaced form or obsolete attribute) on an element inside a closed shadow tree",
      where: "a closed shadow root",
      count: reading.closed.totals.A,
      samples: reading.closed.hits
        .filter((h) => h.check === "A")
        .slice(0, sampleCap)
        .map((h) => ({ locator: h.locator, snippet: h.snippet })),
    });
  }
  for (const u of reading.closed.unreadable) {
    abstentions.push({ branch: "shadow roots the check cannot read (the DOM, closed shadow roots included, could not be read through CDP)", where: u, count: 0, samples: [] });
  }

  if (faultHits.length > 0) {
    const faults: Fault[] = faultHits.map((h) => {
      const [element, attribute] = h.detail.split("@");
      return {
        detail: h.detail,
        locator: h.locator,
        snippet: h.snippet,
        note: `(1) Fault: ${attribute ?? h.detail} on ${element ?? "?"}, in ${REGION_LABEL[h.region]} of the top-level document.`,
      };
    });
    return faultResult(ATTRIBUTES_CHECK_ID, faults, faultTotal, abstentions);
  }
  if (abstentions.length > 0) return cannotTellResult(ATTRIBUTES_CHECK_ID, reading, WHAT, abstentions);

  // (3) No fault, the document having been examined.
  const excepted = [...samples(top, "tree", "excepted", sampleCap), ...samples(top, "tree-noscript", "excepted", sampleCap)].slice(0, sampleCap);
  const exceptedTotal = total(top, "tree", "excepted") + total(top, "tree-noscript", "excepted");
  const note =
    excepted.length > 0
      ? `${exceptedTotal} listed attribute(s) on excepted elements, allowed; the elements' locators are listed (cap ${sampleCap}), as a JSON array.`
      : "";
  return noFaultResult(ATTRIBUTES_CHECK_ID, reading, WHAT, excepted, note);
}

function positive(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}
