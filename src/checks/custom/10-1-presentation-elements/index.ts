/**
 * `custom/10-1-presentation-elements` (RGAA test 10.1.1), as its record in
 * `src/rulesets/rgaa-4.1.2/checks.json` states it. The page is read by the
 * family B provider (`../family-b/`); this module decides from that reading,
 * in the record's order: (1) fault, (2) cannot tell, (3) no fault. Never
 * inapplicable.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckDefinition, CheckResult } from "../../types.ts";
import { REGION_LABEL, cannotTellResult, faultResult, nestedLabel, noFaultResult } from "../family-b/evidence.ts";
import type { Abstention, Fault, Sample } from "../family-b/evidence.ts";
import type { PageReading } from "../family-b/read.ts";
import { totalsKey } from "../family-b/scan.ts";
import type { Hit, HitCategory, Region, ScanOutput } from "../family-b/scan.ts";

export const ELEMENTS_CHECK_ID = "custom/10-1-presentation-elements";

export interface ElementLists {
  version: string;
  presentationElements: string[];
  otherObsoleteElements: string[];
  html5Doctype: { name: string; publicId: string; systemIds: string[] };
  earlierDoctypePublicIds: Record<string, string[]>;
}

// RECORD: "a doctype whose public identifier is that of HTML 3.2, HTML 4.0 or
// 4.01 ..., XHTML 1.0 ... or XHTML 1.1": `lists.json` pins the W3C formal public
// identifiers and compares them exactly. A public identifier in another case
// or form (for example "-//W3C//DTD HTML 3.2//EN") is not recognised, so a u
// element under it gives cannot_tell, never a fault.
export const ELEMENT_LISTS = JSON.parse(readFileSync(join(import.meta.dirname, "lists.json"), "utf8")) as ElementLists;

export const elementsDefinition: CheckDefinition = {
  id: ELEMENTS_CHECK_ID,
  version: "1.0.0",
  defaultOptions: Object.freeze({
    listsVersion: ELEMENT_LISTS.version,
    /** Instances listed per abstention (and locators in a no_fault scope). */
    sampleCap: 20,
    // RECORD: the record says to name each faulty element; past this cap the
    // evidence gives the total instead, to keep the run file bounded on old
    // table layouts. The outcome is unaffected.
    /** Faulty elements named; beyond it the evidence gives the total. */
    faultCap: 1000,
    /** Time allowed to read one document. */
    frameTimeoutMs: 15000,
  }),
};

export type DoctypeKind = "html5" | "earlier" | "none" | "other";

/** The record's "HTML 5 doctype" and "earlier doctype", compared exactly. */
export function doctypeKind(doctype: ScanOutput["doctype"], lists: ElementLists = ELEMENT_LISTS): DoctypeKind {
  if (doctype === null) return "none";
  const h = lists.html5Doctype;
  if (doctype.name === h.name && doctype.publicId === h.publicId && h.systemIds.includes(doctype.systemId)) return "html5";
  if (Object.values(lists.earlierDoctypePublicIds).some((ids) => ids.includes(doctype.publicId))) return "earlier";
  return "other";
}

const WHAT =
  "HTML elements named basefont, big, blink, center, font, marquee, s, strike, tt or u, case variants of these names and of multicol, nobr and spacer, " +
  "these names in other namespaces, and HTML multicol, nobr and spacer elements";

const BRANCH: Readonly<Record<HitCategory, string>> = {
  listed: "a listed element",
  u: "a u element",
  "case-variant": "a case variant (an HTML element whose name becomes a listed name, multicol, nobr or spacer when ASCII-lowercased)",
  "other-namespace": "an element with a listed local name in another namespace",
  "obsolete-element": "an HTML multicol, nobr or spacer element (obsolete presentational elements RGAA does not name)",
  // Not 10.1.1 categories.
  fault: "",
  excepted: "",
  "dimension-pair": "",
  "undefined-pair": "",
  namespaced: "",
  obsolete: "",
};

const E_CATEGORIES: readonly HitCategory[] = ["listed", "u", "case-variant", "other-namespace", "obsolete-element"];
const REGIONS: readonly Region[] = ["tree", "tree-noscript", "shadow", "template", "noscript-text"];

function samples(scan: ScanOutput, region: Region, category: HitCategory, cap: number): Sample[] {
  return scan.hits
    .filter((h) => h.check === "E" && h.region === region && h.category === category)
    .slice(0, cap)
    .map((h) => ({ locator: h.locator, snippet: h.snippet }));
}

function total(scan: ScanOutput, region: Region, category: HitCategory): number {
  return scan.totals[totalsKey("E", region, category)] ?? 0;
}

/** Why a hit in a region other than the plain document tree abstains. */
function regionBranch(region: Region, category: HitCategory): string {
  switch (region) {
    case "tree-noscript":
      return `${BRANCH[category]} that has a noscript element among its ancestors`;
    case "shadow":
      return `${BRANCH[category]} inside a shadow tree`;
    case "template":
    case "noscript-text":
      return `${REGION_LABEL[region]} holding ${BRANCH[category]}`;
    default:
      return BRANCH[category];
  }
}

export function decideElements(reading: PageReading, options: Readonly<Record<string, unknown>>): CheckResult {
  const sampleCap = positive(options["sampleCap"], 20);
  const top = reading.top;
  const doctype = doctypeKind(top.doctype);

  // (1) Fault: in the top-level document tree, outside shadow trees, with no
  // noscript ancestor: a listed element other than u, or u under an earlier doctype.
  const faultHits: Hit[] = top.hits.filter(
    (h) => h.check === "E" && h.region === "tree" && (h.category === "listed" || (h.category === "u" && doctype === "earlier")),
  );
  const faultTotal = total(top, "tree", "listed") + (doctype === "earlier" ? total(top, "tree", "u") : 0);

  // (2) Cannot tell.
  // RECORD: two clauses of (2) name no place: "an element with a listed local
  // name in another namespace" and "an HTML-namespace multicol, nobr or spacer
  // element". They are applied wherever the check reads (document tree, under
  // noscript, shadow trees, template content, noscript text, nested documents),
  // not only in the top-level document tree.
  const abstentions: Abstention[] = [];
  const where = "the top-level document";
  for (const region of REGIONS) {
    for (const category of E_CATEGORIES) {
      const count = total(top, region, category);
      if (count === 0) continue;
      if (region === "tree") {
        if (category === "listed") continue; // a fault
        if (category === "u") {
          if (doctype === "html5" || doctype === "earlier") continue; // allowed, or a fault
          abstentions.push({
            branch: `a u element while the document has ${doctype === "none" ? "no doctype" : "a doctype that is neither the HTML 5 doctype nor an earlier one"}`,
            where,
            count,
            samples: samples(top, region, category, sampleCap),
          });
          continue;
        }
      }
      abstentions.push({ branch: regionBranch(region, category), where, count, samples: samples(top, region, category, sampleCap) });
    }
  }
  for (const u of top.unparsedNoscript) {
    // RECORD: the record abstains on noscript text holding a listed element; when
    // the text cannot be parsed (Trusted Types forbid it in some pages), what it
    // holds is unknown, so the check abstains as on a document it cannot read.
    abstentions.push({ branch: `the text of a noscript element, which could not be parsed as HTML (${u.reason})`, where: u.locator, count: 0, samples: [] });
  }
  for (const n of reading.nested) {
    if (n.scan === undefined) {
      abstentions.push({ branch: `a nested browsing context whose document the check cannot read (${n.unreadable ?? "unknown"})`, where: nestedLabel(n), count: 0, samples: [] });
      continue;
    }
    for (const region of REGIONS) {
      for (const category of E_CATEGORIES) {
        const count = total(n.scan, region, category);
        if (count === 0) continue;
        abstentions.push({
          branch: `${BRANCH[category]} in the document of a nested browsing context (${REGION_LABEL[region]})`,
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
  const closedE = reading.closed.hits.filter((h) => h.check === "E");
  if (reading.closed.totals.E > 0) {
    abstentions.push({
      branch: "a listed element, a case variant, or multicol, nobr or spacer, inside a closed shadow tree",
      where: "a closed shadow root",
      count: reading.closed.totals.E,
      samples: closedE.slice(0, sampleCap).map((h) => ({ locator: h.locator, snippet: h.snippet })),
    });
  }
  for (const u of reading.closed.unreadable) {
    abstentions.push({ branch: "shadow roots the check cannot read (the DOM, closed shadow roots included, could not be read through CDP)", where: u, count: 0, samples: [] });
  }

  if (faultHits.length > 0) {
    const faults: Fault[] = faultHits.map((h) => ({
      detail: h.detail,
      locator: h.locator,
      snippet: h.snippet,
      note:
        h.category === "u"
          ? `(1) Fault: u element in the top-level document, whose doctype is an earlier one (public identifier ${JSON.stringify(top.doctype?.publicId ?? "")}).`
          : `(1) Fault: ${h.detail} element in the top-level document.`,
    }));
    return faultResult(ELEMENTS_CHECK_ID, faults, faultTotal, abstentions);
  }
  if (abstentions.length > 0) return cannotTellResult(ELEMENTS_CHECK_ID, reading, WHAT, abstentions);

  // (3) No fault, the document having been examined.
  const uAllowed = samples(top, "tree", "u", sampleCap);
  const note =
    uAllowed.length > 0
      ? `${total(top, "tree", "u")} u element(s) under the HTML 5 doctype, allowed; their locators are listed (cap ${sampleCap}), as a JSON array.`
      : "";
  return noFaultResult(ELEMENTS_CHECK_ID, reading, WHAT, uAllowed, note);
}

function positive(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}
