/**
 * Canonical serialisation and the hashes built on it (spec 6.3, 8.6, 8.8).
 *
 * Canonical form of a JSON value:
 * - objects: keys sorted by UTF-16 code unit order (JavaScript's default
 *   `sort()`), properties whose value is `undefined` omitted;
 * - arrays: in their stored order. Reordering an array is an edit;
 * - strings: exactly as stored, with no Unicode or whitespace normalisation,
 *   written with `JSON.stringify`'s escaping;
 * - numbers: `JSON.stringify` form; non-finite numbers are refused;
 * - `true`, `false`, `null` as JSON;
 * - no whitespace anywhere outside strings.
 *
 * A hash is the lowercase hex sha256 of the UTF-8 bytes of that form.
 */
import { createHash } from "node:crypto";
import { compareDottedIds } from "./common.ts";
import type { CoverageEntry } from "./coverage.ts";

/** The canonical JSON text of a value. Throws on values JSON cannot hold. */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new Error(`cannot serialise ${value}`);
      return JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
      const proto = Object.getPrototypeOf(value) as unknown;
      if (proto !== Object.prototype && proto !== null) throw new Error("only plain objects can be serialised");
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
    }
    default:
      throw new Error(`cannot serialise a value of type ${typeof value}`);
  }
}

/** sha256 of a string's UTF-8 bytes, lowercase hex. */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** sha256 of the canonical form of a value. */
export function canonicalHash(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

/**
 * The entry hash (6.3, Q36): sha256 over the canonical form of every field of
 * the entry except `enabled`. It covers `test`, `requirements`, `links`,
 * `candidate`, `applicability`, `needs` and `rationale`, in full.
 */
export function entryHash(entry: CoverageEntry): string {
  const { enabled: _enabled, ...content } = entry;
  return canonicalHash(content);
}

/**
 * The hash of a coverage map, recorded in the run file (6.3, 8.8): the
 * canonical hash of the list of entries sorted by test id in official order,
 * each entry whole, `enabled` included, so the hash says what the map allowed.
 */
export function coverageMapHash(entries: readonly CoverageEntry[]): string {
  const sorted = [...entries].sort((a, b) => compareDottedIds(a.test, b.test));
  return canonicalHash(sorted);
}
