/**
 * Byte search for the privacy harness (design 4.2).
 *
 * A marker is searched raw, in its escaped forms (HTML text and attribute,
 * numeric HTML, percent, JSON) and by its prefix alone. A hit gives the
 * prefix, the form, the file, the byte offset and the JSON pointer. It never
 * gives the bytes around the hit: nothing here copies page bytes anywhere.
 */
import { closeSync, openSync, readSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface Hit {
  /** The marker's prefix, `qxNNN-`: the only text a diagnostic may carry. */
  prefix: string;
  /** Index of the marker in the searched list (not printed). */
  marker: number;
  /** `raw`, `html`, `html-numeric`, `percent`, `json`, or `prefix` (a cut marker). */
  form: string;
  /** A path relative to the searched root, or `stdout`, `stderr`. */
  file: string;
  offset: number;
  /** For a `.json` file: where in the document. */
  pointer?: string;
}

export function prefixOf(marker: string): string {
  const m = /^qx\d{3}-/.exec(marker);
  if (m === null) throw new Error("a marker starts with qxNNN-");
  return m[0];
}

const htmlText = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const htmlAttr = (s: string): string => htmlText(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const htmlNumeric = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const jsonInner = (s: string): string => JSON.stringify(s).slice(1, -1).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** Every form of `marker` to look for, by label. Forms equal to an earlier one are dropped. */
export function formsOf(marker: string): { form: string; bytes: Buffer }[] {
  const candidates: [string, string][] = [
    ["raw", marker],
    ["html", htmlText(marker)],
    ["html", htmlAttr(marker)],
    ["html-numeric", htmlNumeric(marker)],
    ["percent", encodeURIComponent(marker)],
    ["percent", encodeURIComponent(marker).toLowerCase()],
    ["percent", encodeURI(marker)],
    ["percent", encodeURIComponent(marker).replace(/%20/g, "+")],
    ["json", jsonInner(marker)],
    ["json", JSON.stringify(marker).slice(1, -1)],
    ["json", jsonInner(htmlAttr(marker))],
    ["json", jsonInner(encodeURIComponent(marker))],
  ];
  const seen = new Set<string>();
  const out: { form: string; bytes: Buffer }[] = [];
  for (const [form, text] of candidates) {
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ form, bytes: Buffer.from(text, "utf8") });
  }
  return out;
}

function offsetsOf(haystack: Buffer, needle: Buffer): number[] {
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return found;
    found.push(at);
    from = at + 1;
  }
}

/** The JSON pointer of the token that holds byte `offset` (the buffer is read as latin1, so offsets are bytes). */
export function pointerAt(buf: Buffer, offset: number): string | undefined {
  const t = buf.toString("latin1");
  let i = 0;
  const ws = (): void => {
    while (i < t.length && " \t\r\n".includes(t[i] as string)) i++;
  };
  const esc = (k: string): string => k.replace(/~/g, "~0").replace(/\//g, "~1");
  const str = (): string => {
    const s = i;
    i++;
    while (i < t.length && t[i] !== '"') i += t[i] === "\\" ? 2 : 1;
    i++;
    return t.slice(s, i);
  };
  const value = (path: string): string | undefined => {
    ws();
    const start = i;
    const c = t[i];
    if (c === "{") {
      i++;
      ws();
      while (t[i] !== "}" && i < t.length) {
        ws();
        const ks = i;
        const raw = str();
        let key = raw;
        try {
          key = JSON.parse(Buffer.from(raw, "latin1").toString("utf8")) as string;
        } catch {
          // keep the raw token
        }
        if (offset >= ks && offset < i) return `${path}/${esc(key)}`;
        ws();
        i++; // the colon
        const r = value(`${path}/${esc(key)}`);
        if (r !== undefined) return r;
        ws();
        if (t[i] === ",") i++;
        ws();
      }
      i++;
      return undefined;
    }
    if (c === "[") {
      i++;
      ws();
      let n = 0;
      while (t[i] !== "]" && i < t.length) {
        const r = value(`${path}/${n++}`);
        if (r !== undefined) return r;
        ws();
        if (t[i] === ",") i++;
        ws();
      }
      i++;
      return undefined;
    }
    if (c === '"') str();
    else while (i < t.length && !",]} \t\r\n".includes(t[i] as string)) i++;
    return offset >= start && offset < i ? path : undefined;
  };
  try {
    const r = value("");
    return r === undefined ? undefined : r === "" ? "/" : r;
  } catch {
    return undefined;
  }
}

/** Search one buffer. A prefix hit is reported only where no fuller form starts at the same offset. */
export function searchBuffer(file: string, buf: Buffer, markers: readonly string[]): Hit[] {
  const hits: Hit[] = [];
  const isJson = file.endsWith(".json");
  const covered = new Set<number>();
  for (const [index, marker] of markers.entries()) {
    const prefix = prefixOf(marker);
    for (const { form, bytes } of formsOf(marker)) {
      for (const at of offsetsOf(buf, bytes)) {
        covered.add(at);
        const pointer = isJson ? pointerAt(buf, at) : undefined;
        hits.push({ prefix, marker: index, form, file, offset: at, ...(pointer === undefined ? {} : { pointer }) });
      }
    }
    for (const at of offsetsOf(buf, Buffer.from(prefix, "utf8"))) {
      if (covered.has(at)) continue;
      const pointer = isJson ? pointerAt(buf, at) : undefined;
      hits.push({ prefix, marker: index, form: "prefix", file, offset: at, ...(pointer === undefined ? {} : { pointer }) });
    }
  }
  return hits.sort((a, b) => a.offset - b.offset);
}

/** Every regular file under `root` (or `root` itself if it is a file), as absolute paths. A missing root gives none. */
export function filesUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(p);
    }
  };
  try {
    if (statSync(root).isFile()) return [root];
  } catch {
    return [];
  }
  walk(root);
  return out;
}

/** Search every file under `root`; `file` in a hit is `<label><relative path>`. */
export function searchTree(label: string, root: string, markers: readonly string[]): Hit[] {
  const hits: Hit[] = [];
  for (const p of filesUnder(root)) {
    let buf: Buffer;
    try {
      buf = readFileSync(p);
    } catch {
      continue;
    }
    hits.push(...searchBuffer(`${label}${p.slice(root.length)}`, buf, markers));
  }
  return hits;
}

export interface ImageFinding {
  file: string;
  reason: "extension" | "signature";
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;

function isImageSignature(h: Buffer): boolean {
  if (h.length >= 8 && h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  if (h.length >= 3 && h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return true;
  if (h.length >= 6 && /^GIF8[79]a$/.test(h.subarray(0, 6).toString("latin1"))) return true;
  if (h.length >= 12 && h.subarray(0, 4).toString("latin1") === "RIFF" && h.subarray(8, 12).toString("latin1") === "WEBP") return true;
  return false;
}

/** Files under `root` with an image extension or an image signature (PNG, JPEG, WebP, GIF). */
export function imagesUnder(label: string, root: string): ImageFinding[] {
  const out: ImageFinding[] = [];
  for (const p of filesUnder(root)) {
    const file = `${label}${p.slice(root.length)}`;
    if (IMAGE_EXT.test(p)) out.push({ file, reason: "extension" });
    let head = Buffer.alloc(0);
    try {
      const fd = openSync(p, "r");
      try {
        const b = Buffer.alloc(16);
        head = b.subarray(0, readSync(fd, b, 0, 16, 0));
      } finally {
        closeSync(fd);
      }
    } catch {
      continue;
    }
    if (isImageSignature(head)) out.push({ file, reason: "signature" });
  }
  return out;
}

/** One line per hit, with no surrounding bytes. */
export function describeHit(h: Hit): string {
  return `${h.prefix} (${h.form}) in ${h.file} at byte ${h.offset}${h.pointer === undefined ? "" : `, pointer ${h.pointer}`}`;
}
