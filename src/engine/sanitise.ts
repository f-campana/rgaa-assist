/**
 * The minimal sanitiser of M2 (spec 8.7, the rules that do not depend on a
 * saved session). One sanitiser runs on every string the engine writes. Every
 * function returns the cleaned value and the number of redactions it made.
 *
 * Rules:
 * - **URLs** (`url`): the value of every query-string parameter is replaced by
 *   `MASK` unless the parameter's name is in the sample's `safeQueryParams`;
 *   parameter names are kept. A non-empty fragment becomes `#[redacted]`. User
 *   information before the host (`user:password@`) is masked. Token masking
 *   (below) then runs on what is left, so a token in a path is masked too.
 * - **Free text** (`text`: notes, locators returned by checks, error messages,
 *   fingerprints): every absolute URL in it (`http`, `https`, `ws`, `wss`,
 *   `ftp`) is passed through `url`, then token masking runs on the whole text.
 * - **Snippets** (`snippet`):
 *   1. form-field values: the `value` attribute of `input` and `option`
 *      elements, and the content of `textarea` elements, become `MASK`; so does
 *      the content of every editable box (spec 8.7): an element with a
 *      `contenteditable` attribute whose value is not `false` (empty, `true`,
 *      `plaintext-only` and any other value, any ASCII case), or whose `role`
 *      tokens include `textbox`, `searchbox` or `combobox`. The tag and its
 *      attributes stay (they locate the element); everything between the start
 *      tag and the matching end tag, nested markup included, is replaced by
 *      one `MASK`, and counts as one redaction per outermost editable element
 *      (editable boxes nested inside it vanish with its content and are not
 *      counted again). A snippet may be cut or unbalanced: when the end tag is
 *      missing, everything after the start tag is dropped. This rule runs
 *      first, so a `textarea` or `input` inside an editable box is gone with it;
 *   2. URL attributes (`href`, `src`, `srcset`, `action`, `formaction`,
 *      `poster`, `data`, `cite`, `background`, `longdesc`, `xlink:href`),
 *      relative ones included, are passed through the URL rule. A value that
 *      is only a fragment (`#main`) is an in-page reference to an element id
 *      and is kept (token masking still applies to it);
 *   3. the free-text rule;
 *   4. the length cap: `SNIPPET_MAX_LENGTH` characters, after masking, then
 *      `TRUNCATION_MARK` is appended.
 *
 * Masking is idempotent: a value that is already `MASK` is not masked or
 * counted again.
 *
 * Token-shaped strings (`TOKEN_PATTERNS`, each tested with planted values):
 * JSON Web Tokens; `Bearer`/`Basic` credentials; well-known API-key shapes
 * (Stripe-style `sk_live_`, `sk-…`, GitHub `ghp_`/`github_pat_`, Slack `xox?-`,
 * AWS `AKIA…`, Google `AIza…`); the value of a `key`, `token`, `secret` or
 * `password`-like name followed by `=` or `:`; runs of 32 or more hexadecimal
 * digits; runs of 32 or more base64 or base64url characters that mix upper
 * case, lower case and digits.
 *
 * This is pattern matching. It cannot prove that no secret gets through
 * (spec 8.7); the full channel tests are the M3 gate.
 */

/** The one mask string, used everywhere. */
export const MASK = "[redacted]";
/** Snippets are cut to this many characters, after masking. */
export const SNIPPET_MAX_LENGTH = 1000;
/** Appended to a snippet that was cut. */
export const TRUNCATION_MARK = "…[truncated]";

export interface Sanitised {
  value: string;
  redactions: number;
}

/** A token pattern. `group`, when set, is the capture group to mask; otherwise the whole match. */
interface TokenPattern {
  name: string;
  regex: RegExp;
  /** Mask only this group's text, keeping the rest of the match. */
  keepPrefixGroup?: number;
  /** Extra test the whole match must pass. */
  accept?: (match: string) => boolean;
}

/** Exported for documentation and tests. Order matters: earlier patterns win. */
export const TOKEN_PATTERNS: readonly TokenPattern[] = [
  { name: "jwt", regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g },
  { name: "authorization", regex: /\b((?:Bearer|Basic)\s+)[A-Za-z0-9._~+/=-]{8,}/gi, keepPrefixGroup: 1 },
  {
    name: "api_key_prefix",
    regex:
      /\b(?:(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})/g,
  },
  {
    name: "secret_assignment",
    regex:
      /([\w-]*(?:api[_-]?key|apikey|secret|token|passw(?:or)?d|pwd|auth[_-]?key|access[_-]?key|client[_-]?secret)[\w-]*["']?\s*[:=]\s*["']?)([^\s"'&<>,;)#[\]]{6,})/gi,
    keepPrefixGroup: 1,
  },
  { name: "hex", regex: /\b[0-9a-fA-F]{32,}\b/g },
  {
    name: "base64",
    regex: /[A-Za-z0-9+_-]{32,}={0,2}/g,
    accept: (m) => /[0-9]/.test(m) && /[a-z]/.test(m) && /[A-Z]/.test(m),
  },
];

/** Mask token-shaped strings in any text. */
export function maskTokens(text: string): Sanitised {
  let value = text;
  let redactions = 0;
  for (const p of TOKEN_PATTERNS) {
    value = value.replace(p.regex, (match: string, ...groups: unknown[]) => {
      if (p.accept !== undefined && !p.accept(match)) return match;
      if (p.keepPrefixGroup !== undefined) {
        const prefix = groups[p.keepPrefixGroup - 1];
        if (typeof prefix !== "string") return match;
        const rest = match.slice(prefix.length);
        if (rest === MASK) return match;
        redactions += 1;
        return prefix + MASK;
      }
      redactions += 1;
      return MASK;
    });
  }
  return { value, redactions };
}

/** True when a parameter name, decoded, is in the safe list. */
function isSafeName(rawName: string, safe: ReadonlySet<string>): boolean {
  let name = rawName;
  try {
    name = decodeURIComponent(rawName.replace(/\+/g, " "));
  } catch {
    // keep the raw name
  }
  return safe.has(name);
}

/**
 * Mask query values, fragment and user information of one URL, absolute or
 * relative, as written. No token masking here.
 */
function maskUrlParts(url: string, safe: ReadonlySet<string>, keepBareFragment: boolean): Sanitised {
  let redactions = 0;
  let rest = url;

  // Fragment.
  let fragment = "";
  const hash = rest.indexOf("#");
  if (hash >= 0) {
    const frag = rest.slice(hash + 1);
    rest = rest.slice(0, hash);
    if (frag.length === 0 || frag === MASK || (keepBareFragment && rest.length === 0)) {
      fragment = `#${frag}`;
    } else {
      fragment = `#${MASK}`;
      redactions += 1;
    }
  }

  // Query.
  let query = "";
  const q = rest.indexOf("?");
  if (q >= 0) {
    const raw = rest.slice(q + 1);
    rest = rest.slice(0, q);
    const parts = raw.split("&").map((part) => {
      const eq = part.indexOf("=");
      if (eq < 0) return part; // a name alone carries no value; token masking still applies
      const name = part.slice(0, eq);
      const value = part.slice(eq + 1);
      if (value.length === 0 || value === MASK || isSafeName(name, safe)) return part;
      redactions += 1;
      return `${name}=${MASK}`;
    });
    query = `?${parts.join("&")}`;
  }

  // User information.
  const userinfo = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/?#@]*)@/.exec(rest);
  if (userinfo !== null && userinfo[2] !== undefined && userinfo[2].length > 0 && userinfo[2] !== MASK) {
    rest = `${userinfo[1] ?? ""}${MASK}@${rest.slice(userinfo[0].length)}`;
    redactions += 1;
  }

  return { value: rest + query + fragment, redactions };
}

const ABSOLUTE_URL = /\b(?:https?|wss?|ftp):\/\/[^\s"'<>`]+/gi;

const URL_ATTRIBUTE =
  /(\s(?:href|src|srcset|action|formaction|poster|data|cite|background|longdesc|xlink:href)\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi;

const FORM_VALUE_TAG = /<(?:input|option)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const VALUE_ATTRIBUTE = /(\svalue\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi;
const TEXTAREA = /(<textarea\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/textarea\s*>|$)/gi;

const START_TAG = /<([a-zA-Z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTRIBUTE = /[\s/]([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const TEXTBOX_ROLES = new Set(["textbox", "searchbox", "combobox"]);

/** True when the start tag's attributes make the element an editable box. */
function isEditableBox(attributes: string): boolean {
  let editable = false;
  let seenEditable = false;
  let roleSeen = false;
  ATTRIBUTE.lastIndex = 0;
  for (let m = ATTRIBUTE.exec(attributes); m !== null; m = ATTRIBUTE.exec(attributes)) {
    const name = (m[1] ?? "").toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    // The first occurrence of an attribute wins, as in HTML parsing.
    if (name === "contenteditable" && !seenEditable) {
      seenEditable = true;
      if (value.trim().toLowerCase() !== "false") editable = true;
    } else if (name === "role" && !roleSeen) {
      roleSeen = true;
      if (value.split(/[\t\n\f\r ]+/).some((t) => TEXTBOX_ROLES.has(t.toLowerCase()))) editable = true;
    }
  }
  return editable;
}

/** Where the content of the element whose start tag ends at `from` stops, and where its end tag ends; null when there is no end tag. */
function findContentEnd(s: string, name: string, from: number): { contentEnd: number; after: number } | null {
  const escaped = name.replace(/[^a-zA-Z0-9]/g, "\\$&");
  const re = new RegExp(`<(/?)${escaped}(?=[\\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>`, "gi");
  re.lastIndex = from;
  let depth = 1;
  for (let m = re.exec(s); m !== null; m = re.exec(s)) {
    if (m[1] === "/") depth -= 1;
    else if (!m[0].endsWith("/>")) depth += 1;
    if (depth === 0) return { contentEnd: m.index, after: m.index + m[0].length };
  }
  return null;
}

/** Replace the content of editable boxes by MASK. Returns the cleaned markup and the redactions made. */
function maskEditableBoxes(s: string): Sanitised {
  let redactions = 0;
  let out = "";
  let pos = 0;
  START_TAG.lastIndex = 0;
  for (let m = START_TAG.exec(s); m !== null; m = START_TAG.exec(s)) {
    const name = (m[1] ?? "").toLowerCase();
    if (VOID_ELEMENTS.has(name) || m[0].endsWith("/>") || !isEditableBox(m[2] ?? "")) continue;
    const start = m.index + m[0].length;
    const end = findContentEnd(s, m[1] ?? "", start);
    const contentEnd = end === null ? s.length : end.contentEnd;
    const content = s.slice(start, contentEnd);
    out += s.slice(pos, start);
    if (content.length === 0 || content === MASK) out += content;
    else {
      out += MASK;
      redactions += 1;
    }
    pos = contentEnd;
    START_TAG.lastIndex = contentEnd;
  }
  return { value: out + s.slice(pos), redactions };
}

function unquote(v: string): { quote: string; inner: string } {
  if (v.length >= 2 && (v.startsWith('"') || v.startsWith("'")) && v.endsWith(v[0] ?? "")) {
    return { quote: v[0] ?? "", inner: v.slice(1, -1) };
  }
  return { quote: "", inner: v };
}

export interface Sanitiser {
  /** The sample's safe parameter names. */
  readonly safeQueryParams: readonly string[];
  /** One URL: query values, fragment, user information, then tokens. */
  url(url: string): Sanitised;
  /** Free text: absolute URLs, then tokens. For notes, locators, error messages. */
  text(text: string): Sanitised;
  /** A snippet of markup: form values, URL attributes, free-text rule, then the cap. */
  snippet(snippet: string): Sanitised;
}

export function createSanitiser(safeQueryParams: readonly string[] = []): Sanitiser {
  const safe = new Set(safeQueryParams);

  const url = (u: string): Sanitised => {
    const parts = maskUrlParts(u, safe, false);
    const tokens = maskTokens(parts.value);
    return { value: tokens.value, redactions: parts.redactions + tokens.redactions };
  };

  const urlsInText = (text: string): Sanitised => {
    let redactions = 0;
    const value = text.replace(ABSOLUTE_URL, (m) => {
      const r = maskUrlParts(m, safe, false);
      redactions += r.redactions;
      return r.value;
    });
    return { value, redactions };
  };

  const text = (t: string): Sanitised => {
    const a = urlsInText(t);
    const b = maskTokens(a.value);
    return { value: b.value, redactions: a.redactions + b.redactions };
  };

  const snippet = (s: string): Sanitised => {
    // 1. Content of editable boxes, then form-field values.
    const editable = maskEditableBoxes(s);
    let redactions = editable.redactions;
    let value = editable.value.replace(FORM_VALUE_TAG, (tag) =>
      tag.replace(VALUE_ATTRIBUTE, (_m, prefix: string, raw: string) => {
        const { quote, inner } = unquote(raw);
        if (inner.length === 0 || inner === MASK) return `${prefix}${raw}`;
        redactions += 1;
        const q = quote === "" ? '"' : quote;
        return `${prefix}${q}${MASK}${q}`;
      }),
    );
    value = value.replace(TEXTAREA, (_m, open: string, content: string, close: string) => {
      if (content.length === 0 || content === MASK) return `${open}${content}${close}`;
      redactions += 1;
      return `${open}${MASK}${close}`;
    });
    // 2. URL attributes, relative ones included.
    value = value.replace(URL_ATTRIBUTE, (_m, prefix: string, raw: string) => {
      const { quote, inner } = unquote(raw);
      const isSrcset = /srcset/i.test(prefix);
      const urls = isSrcset ? inner.split(",") : [inner];
      const masked = urls.map((candidate) => {
        if (!isSrcset) {
          const r = maskUrlParts(candidate, safe, true);
          redactions += r.redactions;
          return r.value;
        }
        // `url descriptor`
        const m = /^(\s*)(\S+)(.*)$/s.exec(candidate);
        if (m === null) return candidate;
        const r = maskUrlParts(m[2] ?? "", safe, true);
        redactions += r.redactions;
        return `${m[1] ?? ""}${r.value}${m[3] ?? ""}`;
      });
      return `${prefix}${quote}${masked.join(",")}${quote}`;
    });
    // 3. Free text.
    const t = text(value);
    redactions += t.redactions;
    value = t.value;
    // 4. Cap.
    if (value.length > SNIPPET_MAX_LENGTH) value = value.slice(0, SNIPPET_MAX_LENGTH) + TRUNCATION_MARK;
    return { value, redactions };
  };

  return { safeQueryParams: [...safeQueryParams], url, text, snippet };
}
