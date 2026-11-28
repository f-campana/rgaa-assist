/**
 * The shape of a privacy row (design 4.2, 4.3). The oracle of a row comes from
 * its fixture source alone: it never comes from the engine, a provider's
 * references or a probe.
 */

/** A piece of evidence a row's oracle speaks about. `fingerprint` is the observation's, not an evidence item's. */
export type Piece = "snippet" | "locator" | "note" | "fingerprint" | "scope_examined" | "console";

export type Saved =
  /** Protected pieces: each saved as exactly `[redacted]`; every evidence item of the check carries `count` redactions (the table's W, n, per item). */
  | { kind: "redacted"; count: number; fingerprintCount?: number }
  /** Plain pieces: the exact text is present in the saved evidence (a control). */
  | { kind: "text"; present: readonly string[] }
  /** Absent everywhere, nothing else stated (sample, console and error rows). */
  | { kind: "none" }
  /** Differential pair: the fingerprints of the named checks, run on the two variants. */
  | { kind: "fingerprints"; relation: "identical" | "differ" };

/**
 * One expected plain value, stated from the fixture source. It names the check, the piece and the text, and is
 * matched only against that piece of that check's evidence (`scope_examined`: the locator or note of a
 * scope_examined item; `fingerprint`: the observation's). A marker found anywhere else in the run never counts.
 */
export interface PieceExpect {
  check: string;
  piece: "snippet" | "locator" | "note" | "scope_examined" | "fingerprint";
  /** Present in that piece as a substring. */
  contains?: string;
  /** Or: that piece is exactly this. */
  equals?: string;
}

export interface Oracle {
  /** Plain pieces expected, per piece and element (controls). Required for every row whose `saved` is `text`. */
  expect?: readonly PieceExpect[];
  /** Ids of the checks that must report the planted element. Empty for console rows. */
  checks: readonly string[];
  rgaa?: string;
  pieces: readonly Piece[];
  /** Evidence items expected on the planted element's check. `null` where the table does not fix it. */
  items: number | null;
  saved: Saved;
  /** Where a marker may appear, in words (design 4.3 "Allowed"). */
  allowed: string;
  /** Literal tokens that must not appear in any saved snippet (the names `selected` and `checked`, qx025). */
  forbiddenInSnippets?: readonly string[];
}

export interface Variant {
  name: string;
  /** Files served on both origins. `__CROSS_ORIGIN__` is replaced by the cross origin. The page is `index.html`. */
  files: Readonly<Record<string, string>>;
  /** The page to load, default `index.html`. */
  page?: string;
  /** A full page URL for the sample, instead of the fixture server's (qx063). */
  pageUrl?: string;
  /** Appended to the page URL in the sample (query and fragment). */
  urlSuffix?: string;
}

export type Via = "audit" | "cli" | "child";

export interface Row {
  id: string;
  title: string;
  /** `leak`: markers must be absent. `control`: markers must be present. `pair`: fingerprints compared. */
  role: "leak" | "control" | "pair";
  /** Where the design table puts it. */
  table: string;
  via: Via;
  /** The markers that the row plants, raw. Escaping markers (qx101 to qx103) hold punctuation after the prefix. */
  markers: readonly string[];
  variants: readonly Variant[];
  oracle: Oracle;
  /** A sample file written as given instead of the usual one (qx060). It is an input, so it is not searched. */
  rawSample?: string;
  /** `child`: the output directory is placed under a regular file whose name carries the marker (qx064). */
  badOut?: boolean;
  /** At baseline, the design expects this row to show a leak. */
  baselineLeakExpected: boolean;
}
