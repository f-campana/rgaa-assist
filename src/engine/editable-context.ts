/**
 * The engine guard, first slice (M3 privacy design 3.1 to 3.6, build part 4).
 * Not yet wired into `run-checks.ts`: that comes with part 5, when providers
 * emit sources.
 *
 * Two halves:
 * - **In the page** (`IN_PAGE_BODY`), one evaluation per piece: the node's
 *   protected-context verdict (flat-tree ancestry through `assignedSlot` and
 *   shadow hosts, `designMode`; 2.2, 2.3, 3.4a), the field rule (2.1:
 *   allow-list, contents withheld, live-value match on decoded values with
 *   normalisation), and, for composites, the guarded serialisation of 3.4a:
 *   a walk over the emitted nodes only, template content entered explicitly,
 *   `noscript` by its parsed form, all or nothing. Escaping happens only at
 *   serialisation. Any failure or unknown case gives "withheld" with a reason
 *   code.
 * - **In Node**: source resolution (Playwright handle or CDP backend id), the
 *   hosting frame chain read before and after the evaluation, then the pieces:
 *   `[redacted]` replacements and counts (3.5), fingerprints (3.6). Every page
 *   string goes through the existing sanitiser afterwards.
 *
 * The page-side code is plain JavaScript in a string: the TypeScript
 * configuration has no DOM library.
 */
import { createHash } from "node:crypto";
import type { CDPSession, Frame } from "playwright";
import type { CheckContext, DeclaredText, Derivation, FrameKey, NodeRef, NoteSlot, SourcedEvidence, SourcedFingerprint, SourcedNote } from "../checks/types.ts";
import type { Evidence } from "../schema/index.ts";
import { MASK, TEXTBOX_ROLE_LIST } from "./sanitise.ts";
import type { Sanitiser } from "./sanitise.ts";

/** Fingerprint text for a part that is not plain (3.6). */
export const WITHHELD_PART = "[withheld]";

/** Attributes whose values a form field keeps (2.1). Every other attribute keeps its name only. */
export const FIELD_ATTRIBUTE_ALLOW_LIST: readonly string[] = [
  "type", "name", "id", "class", "form", "list", "autocomplete", "inputmode", "required", "disabled", "readonly", "multiple",
  "size", "minlength", "maxlength", "min", "max", "step", "pattern", "accept", "alt", "src", "width", "height", "title",
  "placeholder", "role", "tabindex", "hidden", "lang", "dir", "aria-label", "aria-labelledby", "aria-describedby",
  "aria-required", "aria-invalid", "aria-hidden", "aria-autocomplete", "aria-controls", "aria-expanded",
];

/** Most nodes a composite walk visits before it withholds the whole composite (3.4a, size cap before the cap). */
export const WALK_NODE_CAP = 5000;

/** Reason codes for a withheld piece. Fixed strings, no page text. */
export type WithheldReason =
  | "protected"
  | "protected-frame"
  | "value-match"
  | "not-element"
  | "detached"
  | "unsupported-document"
  | "unsupported-namespace"
  | "unsupported-kind"
  | "unsupported-source"
  | "unparsed-raw-text"
  | "template-unreachable"
  | "too-large"
  | "stale-frame"
  | "frame-chain"
  | "frame-chain-changed"
  | "resolution-failed"
  | "evaluation-failed"
  | "bad-range"
  | "closed-shadow"
  | "timeout"
  | "contains-field-or-box";

/** What the in-page evaluation returns. `probe` is the resolved node's `data-probe` value, only when asked (tests). */
export type InPageResult =
  | { readonly ok: true; readonly value: string; readonly count: number; readonly probe?: string | null }
  | { readonly ok: false; readonly reason: WithheldReason; readonly probe?: string | null };

/** A path from the document to one node, as the in-page code resolves it. */
export type PathStep = { readonly e: number } | { readonly t: number } | { readonly s: 1 };

/** The in-page request: what to derive from the node. */
export interface InPageRequest {
  readonly op: "verdict" | "outer" | "startTag" | "startTagAndText" | "textRange" | "attr" | "id" | "locator" | "accguard";
  readonly name?: string;
  readonly start?: number;
  readonly end?: number;
  readonly roles: readonly string[];
  readonly allow: readonly string[];
  readonly cap: number;
  /** Nodes slotted into a protected slot inside a closed shadow root, found through CDP. */
  readonly closed?: readonly { readonly path: readonly PathStep[]; readonly name: string }[];
  /** Test-only probe hook: a forced failure, or a forced timeout of `ms`, at the walk's n-th node. */
  readonly hook?: { readonly at: number; readonly kind: "failure" | "timeout"; readonly ms: number };
  /** Test-only: return the resolved node's `data-probe` value. */
  readonly probe?: boolean;
}

/**
 * The in-page function body. Arguments: `node`, `req` (an `InPageRequest`).
 * Returns an `InPageResult`. Every exception becomes `{ ok: false }`.
 */
export const IN_PAGE_BODY = String.raw`
var MASK = "[redacted]";
var HTML_NS = "http://www.w3.org/1999/xhtml", SVG_NS = "http://www.w3.org/2000/svg", MATH_NS = "http://www.w3.org/1998/Math/MathML";
var VOID = { area:1, base:1, basefont:1, bgsound:1, br:1, col:1, embed:1, frame:1, hr:1, img:1, input:1, keygen:1, link:1, meta:1, param:1, source:1, track:1, wbr:1 };
var RAW = { style:1, script:1, xmp:1, iframe:1, noembed:1, noframes:1, plaintext:1 };
var FIELD = { input:1, textarea:1, select:1 };
var allow = {}; for (var i = 0; i < req.allow.length; i++) allow[req.allow[i]] = 1;
function Fail(reason) { this.reason = reason; }
function lower(s) { return String(s).replace(/[A-Z]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 32); }); }
function isHtml(el) { return el.namespaceURI === HTML_NS; }
function local(el) { return isHtml(el) ? lower(el.localName) : el.localName; }
function attrOf(el, name) {
  for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (a.namespaceURI === null && lower(a.name) === name) return a.value; }
  return null;
}
function isBox(el) {
  var ce = attrOf(el, "contenteditable");
  if (ce !== null && lower(ce.trim()) !== "false") return true;
  var role = attrOf(el, "role");
  if (role === null) return false;
  var toks = role.split(/[\t\n\f\r ]+/);
  for (var i = 0; i < toks.length; i++) if (toks[i] !== "" && req.roles.indexOf(lower(toks[i])) !== -1) return true;
  return false;
}
function isField(el) { return el.nodeType === 1 && isHtml(el) && FIELD[local(el)] === 1; }
function isOption(el) { return el.nodeType === 1 && isHtml(el) && (local(el) === "option" || local(el) === "optgroup"); }
/* Flat-tree parent: the assigned slot, else the parent, a shadow root's host. */
function flatParent(n) {
  var p = n.assignedSlot ? n.assignedSlot : n.parentNode;
  if (p && p.nodeType === 11) { if (p.host) return p.host; return { fragment: p }; }
  return p;
}
/* The verdict of a node: "plain", "protected", or throws Fail. The node itself
   counts when it is a box or an option; a field element itself is not protected
   (2.1), but its contents are. Template content resolves to its template. */
function verdict(n, templateOf) {
  var self = n;
  var cur = n, first = true;
  while (cur) {
    if (cur.fragment) {
      var t = templateOf ? templateOf(cur.fragment) : null;
      if (!t) throw new Fail("detached");
      cur = t; first = false; continue;
    }
    if (cur.nodeType === 9) break;
    if (closedNodes.indexOf(cur) !== -1) return "protected";
    if (cur.nodeType === 1) {
      if (isBox(cur)) return "protected";
      if (isOption(cur)) return "protected";
      if (!first && isField(cur)) return "protected";
    }
    first = false;
    cur = flatParent(cur);
  }
  if (!cur) throw new Fail("detached");
  if (lower(String(cur.designMode)) === "on") return "protected";
  return "plain";
}
function documentOf(n) { return n.ownerDocument || n; }
function checkDocument(doc) {
  if (doc.contentType !== "text/html") throw new Fail("unsupported-document");
}
/* 2.1 normalisation: NFC, case-folded, whitespace runs collapsed, trimmed. */
function norm(s) { return String(s).normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim(); }
function addValue(vals, v) { if (typeof v === "string") { var n = norm(v); if (n !== "") vals.push(n); } }
function fieldValues(el, vals) {
  var name = local(el);
  if (name === "input" || name === "textarea") { addValue(vals, el.value); addValue(vals, el.defaultValue); }
  if (name === "select") { for (var i = 0; i < el.options.length; i++) optionValues(el.options[i], vals); }
  if (name === "input" && el.list) { for (var j = 0; j < el.list.options.length; j++) optionValues(el.list.options[j], vals); }
}
function optionValues(o, vals) { addValue(vals, o.text); addValue(vals, o.label); addValue(vals, o.value); }
function matches(vals, s) { var n = norm(s); if (n === "") return false; for (var i = 0; i < vals.length; i++) if (n.indexOf(vals[i]) !== -1) return true; return false; }
/* Serialisation escapes (HTML fragment serialisation algorithm). */
function escText(s) { return s.replace(/&/g, "&amp;").replace(/ /g, "&nbsp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escAttr(s) { return s.replace(/&/g, "&amp;").replace(/ /g, "&nbsp;").replace(/"/g, "&quot;"); }
function attrName(a) {
  if (a.namespaceURI === null) return a.localName;
  if (a.namespaceURI === "http://www.w3.org/XML/1998/namespace") return "xml:" + a.localName;
  if (a.namespaceURI === "http://www.w3.org/2000/xmlns/") return a.localName === "xmlns" ? "xmlns" : "xmlns:" + a.localName;
  if (a.namespaceURI === "http://www.w3.org/1999/xlink") return "xlink:" + a.localName;
  throw new Fail("unsupported-namespace");
}
function tagName(el) {
  if (el.namespaceURI === HTML_NS || el.namespaceURI === SVG_NS || el.namespaceURI === MATH_NS) return local(el);
  throw new Fail("unsupported-namespace");
}
/* One start tag under the field rule when the element is a field, and the
   live-value match of vals on every attribute value. */
function startTag(el, vals, st) {
  var field = isField(el);
  var out = "<" + tagName(el);
  for (var i = 0; i < el.attributes.length; i++) {
    var a = el.attributes[i], name = attrName(a), ln = lower(name);
    if (field && (ln === "checked" || ln === "selected")) continue;
    if ((field && allow[ln] !== 1) || matches(vals, a.value)) {
      out += " " + name + '="' + MASK + '"';
      if (a.value !== "") st.count++;
      else out = out.slice(0, out.length - MASK.length - 1) + '"';
      continue;
    }
    out += " " + name + '="' + escAttr(a.value) + '"';
  }
  return out + ">";
}
function templateResolver(root) {
  /* Map each template content fragment met in the walk to its template. */
  var map = [];
  return {
    add: function (t) { map.push([t.content, t]); },
    of: function (frag) { for (var i = 0; i < map.length; i++) if (map[i][0] === frag) return map[i][1]; return null; },
  };
}
/* The guarded walk (3.4a). Emits exactly what outerHTML would emit for the
   node, with protected nodes replaced whole, fields under the field rule, and
   the live-value match of every contained field on every attribute and text. */
function walkOuter(root, vals, st) {
  var out = "";
  function visit(n, parentRaw) {
    st.nodes++;
    if (st.nodes > req.cap) throw new Fail("too-large");
    probeHook(st);
    if (n.nodeType === 3) {
      if (verdict(n, st.templates.of) === "protected") { if (n.data !== "") { out += MASK; st.count++; } return; }
      if (matches(vals, n.data)) { out += MASK; st.count++; return; }
      out += parentRaw ? n.data : escText(n.data);
      return;
    }
    if (n.nodeType === 8) {
      if (matches(vals, n.data)) { out += "<!--" + MASK + "-->"; st.count++; return; }
      out += "<!--" + n.data + "-->"; return;
    }
    if (n.nodeType === 7) throw new Fail("unsupported-document");
    if (n.nodeType !== 1) throw new Fail("not-element");
    if (verdict(n, st.templates.of) === "protected") { out += MASK; st.count++; return; }
    var name = local(n);
    out += startTag(n, vals, st);
    if (isHtml(n) && VOID[name] === 1) return;
    if (isHtml(n) && name === "template") {
      if (!n.content) throw new Fail("template-unreachable");
      st.templates.add(n);
      var tc = n.content.childNodes;
      for (var t = 0; t < tc.length; t++) visit(tc[t], false);
    } else if (isHtml(n) && name === "textarea") {
      if (n.textContent !== "") { out += MASK; st.count++; }
    } else if (isHtml(n) && name === "noscript" && n.childNodes.length === 1 && n.firstChild.nodeType === 3 && /[<&]/.test(n.firstChild.data)) {
      /* noscript parsed with scripting on: one raw text node whose markup this guard does not parse. */
      out += MASK; st.count++;
    } else {
      var raw = isHtml(n) && (RAW[name] === 1 || name === "noscript");
      var cs = n.childNodes;
      for (var c = 0; c < cs.length; c++) visit(cs[c], raw);
    }
    out += "</" + tagName(n) + ">";
  }
  visit(root, false);
  return out;
}
/* Every live value of every field the walk would emit (its own, and template content). */
function collectValues(root, vals) {
  var stack = [root];
  while (stack.length) {
    var n = stack.pop();
    if (n.nodeType !== 1 && n.nodeType !== 11) continue;
    if (n.nodeType === 1 && isField(n)) fieldValues(n, vals);
    if (n.nodeType === 1 && isHtml(n) && local(n) === "option") optionValues(n, vals);
    if (n.nodeType === 1 && isHtml(n) && local(n) === "template" && n.content) stack.push(n.content);
    for (var i = 0; i < n.childNodes.length; i++) stack.push(n.childNodes[i]);
  }
}
/* Nodes the engine found, through CDP, slotted into a protected slot inside a
   closed shadow root (assignedSlot is null there). Each is given as a path
   from the document: element index, non-whitespace text index, or entry into
   an open shadow root; the node name must match. Unresolvable: fail closed. */
function resolveClosed(doc) {
  var out = [], list = req.closed || [];
  for (var i = 0; i < list.length; i++) {
    var cur = doc, path = list[i].path;
    for (var j = 0; j < path.length; j++) {
      var s = path[j], next = null;
      if (s.s === 1) next = cur.shadowRoot || null;
      else if (typeof s.e === "number") { var k = 0; for (var c = cur.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) { if (k === s.e) { next = c; break; } k++; } }
      else if (typeof s.t === "number") { var m = 0; for (var d = cur.firstChild; d; d = d.nextSibling) if (d.nodeType === 3 && /\S/.test(d.data)) { if (m === s.t) { next = d; break; } m++; } }
      if (!next) throw new Fail("closed-shadow");
      cur = next;
    }
    if (cur.nodeName !== list[i].name) throw new Fail("closed-shadow");
    out.push(cur);
  }
  return out;
}
/* Test-only probe hook (design 4.2): a forced failure, or a forced timeout (busy wait) at the n-th walked node. */
function probeHook(st) {
  var h = req.hook;
  if (!h || st.nodes !== h.at) return;
  if (h.kind === "failure") throw new Fail("evaluation-failed");
  var until = Date.now() + h.ms; while (Date.now() < until) { /* forced composite walk timeout */ }
}
var closedNodes = [];
function main() {
try {
  if (!node || (node.nodeType !== 1 && node.nodeType !== 3)) return { ok: false, reason: "not-element" };
  var doc = documentOf(node);
  checkDocument(doc);
  closedNodes = resolveClosed(doc);
  var st = { count: 0, nodes: 0, templates: templateResolver(node) };
  var op = req.op;
  if (op === "startTagAndText") {
    if (node.nodeType !== 3 || !node.parentNode || node.parentNode.nodeType !== 1) return { ok: false, reason: "not-element" };
    var parent = node.parentNode;
    if (verdict(parent, null) === "protected") return { ok: false, reason: "protected" };
    var pv = []; if (isField(parent)) fieldValues(parent, pv);
    var tag = startTag(parent, pv, st);
    var text;
    if (verdict(node, null) === "protected") text = node.data === "" ? "" : (st.count++, MASK);
    else if (matches(pv, node.data)) { text = MASK; st.count++; }
    else text = (isHtml(parent) && (RAW[local(parent)] === 1 || local(parent) === "noscript")) ? node.data : escText(node.data);
    return { ok: true, value: tag + text, count: st.count };
  }
  if (node.nodeType !== 1 && op !== "textRange") return { ok: false, reason: "not-element" };
  if (op === "verdict") return verdict(node, null) === "protected" ? { ok: false, reason: "protected" } : { ok: true, value: "", count: 0 };
  if (verdict(node, null) === "protected") return { ok: false, reason: "protected" };
  var own = []; if (node.nodeType === 1 && isField(node)) fieldValues(node, own);
  if (op === "startTag") return { ok: true, value: startTag(node, own, st), count: st.count };
  if (op === "attr" || op === "id") {
    var an = op === "id" ? "id" : lower(String(req.name));
    var v = attrOf(node, an);
    if (v === null) return { ok: true, value: "", count: 0 };
    if (isField(node) && (an === "checked" || an === "selected" || allow[an] !== 1)) return { ok: false, reason: "value-match" };
    if (matches(own, v)) return { ok: false, reason: "value-match" };
    return { ok: true, value: v, count: 0 };
  }
  if (op === "locator") {
    /* Engine syntax: tag:nth-of-type chains, " >> " into a shadow root (frames are prefixed in Node with " >>> "). */
    var segs = [], hostEl = node;
    while (hostEl && hostEl.nodeType === 1) {
      var chain = [], c = hostEl;
      while (c && c.nodeType === 1) {
        var k = 1; for (var sb = c.previousElementSibling; sb; sb = sb.previousElementSibling) if (sb.localName === c.localName) k++;
        chain.unshift(local(c) + ":nth-of-type(" + k + ")");
        c = c.parentNode;
      }
      segs.unshift(chain.join(" > "));
      if (c && c.nodeType === 11) { if (!c.host) throw new Fail("detached"); hostEl = c.host; }
      else if (c && c.nodeType === 9) hostEl = null;
      else throw new Fail("detached");
    }
    var loc = segs.join(" >> ");
    if (matches(own, loc)) return { ok: false, reason: "value-match" };
    return { ok: true, value: loc, count: 0 };
  }
  if (op === "accguard") {
    /* 2.1: an accessible name or value is withheld if its node is, or contains, a field or a box (light DOM, open shadow roots, template content). */
    if (isField(node) || isBox(node)) return { ok: false, reason: "contains-field-or-box" };
    var stk = [node];
    if (node.shadowRoot) stk.push(node.shadowRoot);
    while (stk.length) {
      var sn = stk.pop();
      for (var ch = sn.firstChild; ch; ch = ch.nextSibling) {
        if (ch.nodeType !== 1) continue;
        if (isField(ch) || isBox(ch)) return { ok: false, reason: "contains-field-or-box" };
        stk.push(ch);
        if (ch.shadowRoot) stk.push(ch.shadowRoot);
        if (isHtml(ch) && local(ch) === "template" && ch.content) stk.push(ch.content);
      }
    }
    return { ok: true, value: "", count: 0 };
  }
  if (op === "outer") {
    var vals = []; collectValues(node, vals);
    return { ok: true, value: walkOuter(node, vals, st), count: st.count };
  }
  if (op === "textRange") {
    var start = req.start, end = req.end;
    if (typeof start !== "number" || typeof end !== "number" || start < 0 || end < start) return { ok: false, reason: "bad-range" };
    if (node.nodeType === 1 && isHtml(node) && local(node) === "noscript" && node.childNodes.length === 1 && node.firstChild.nodeType === 3 && /[<&]/.test(node.firstChild.data)) return { ok: false, reason: "unparsed-raw-text" };
    var rv = []; collectValues(node, rv);
    var texts = [];
    (function gather(n) {
      st.nodes++;
      if (st.nodes > req.cap) throw new Fail("too-large");
      probeHook(st);
      if (n.nodeType === 3) { texts.push(n); return; }
      for (var k = 0; k < n.childNodes.length; k++) gather(n.childNodes[k]);
    })(node);
    var outText = "", pos = 0;
    for (var q = 0; q < texts.length; q++) {
      var tn = texts[q], len = tn.data.length, a0 = Math.max(start, pos), a1 = Math.min(end, pos + len);
      if (a1 > a0) {
        var piece = tn.data.slice(a0 - pos, a1 - pos);
        if (verdict(tn, null) === "protected" || matches(rv, piece)) { outText += MASK; st.count++; }
        else outText += piece;
      }
      pos += len;
    }
    if (end > pos) return { ok: false, reason: "bad-range" };
    return { ok: true, value: outText, count: st.count };
  }
  return { ok: false, reason: "unsupported-kind" };
} catch (e) {
  return { ok: false, reason: e instanceof Fail ? e.reason : "evaluation-failed" };
}
}
var result = main();
if (req.probe) {
  var pk = null;
  try { var pe = node && node.nodeType === 1 ? node : node && node.parentNode; pk = pe && pe.getAttribute ? pe.getAttribute("data-probe") : null; } catch (e) { pk = null; }
  result.probe = pk;
}
return result;
`;

/** The in-page function, as Playwright and CDP `callFunctionOn` take it. */
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const inPageFunction = new Function("node", "req", IN_PAGE_BODY) as (node: unknown, req: InPageRequest) => InPageResult;
export const IN_PAGE_FUNCTION_SOURCE: string = inPageFunction.toString();

function request(op: InPageRequest["op"], extra: Partial<InPageRequest> = {}): InPageRequest {
  return { op, roles: TEXTBOX_ROLE_LIST, allow: FIELD_ATTRIBUTE_ALLOW_LIST, cap: WALK_NODE_CAP, ...extra };
}

/** Guard timeout per piece (3.3: a resolution past the guard timeout is withheld). */
export const GUARD_TIMEOUT_MS = 5000;

/** The kind of a piece, as the probe reports it. */
export type PieceKind = `snippet:${"outer" | "startTag" | "startTagAndText" | "textRange"}` | Exclude<Derivation["kind"], "snippet">;

export const pieceKind = (d: Derivation): PieceKind => (d.kind === "snippet" ? `snippet:${d.shape}` : d.kind);

/** One probe entry (design 4.2): per piece, its kind, verdict, count, and the resolved node's `data-probe` key. */
export interface ProbeEntry {
  readonly pieceKind: PieceKind;
  readonly verdict: "plain" | "withheld";
  readonly reason?: WithheldReason;
  readonly count: number;
  readonly probeKey: string | null;
}

/**
 * Test-only, in-memory probe seam (design 4.2). A measurement only: it never
 * decides anything and is never written to disk. The two hooks force a
 * failure, or a timeout, at the n-th node of a composite walk (3.4a, qx218).
 */
export interface PrivacyProbe {
  record(entry: ProbeEntry): void;
  readonly forceCompositeWalkFailure?: { readonly atNode: number };
  readonly forceCompositeWalkTimeout?: { readonly atNode: number };
}

/** Options for the guard. */
export interface DeriveOptions {
  /** Test-only probe seam. */
  readonly probe?: PrivacyProbe;
  /** Guard timeout per piece; default `GUARD_TIMEOUT_MS` (250 ms when a forced timeout is set). */
  readonly timeoutMs?: number;
}

function hookFor(probe: PrivacyProbe | undefined, timeoutMs: number): InPageRequest["hook"] | undefined {
  if (probe?.forceCompositeWalkTimeout !== undefined) return { at: probe.forceCompositeWalkTimeout.atNode, kind: "timeout", ms: timeoutMs + 1000 };
  if (probe?.forceCompositeWalkFailure !== undefined) return { at: probe.forceCompositeWalkFailure.atNode, kind: "failure", ms: 0 };
  return undefined;
}

/** The in-page request for a derivation, or null when it is not an in-page op. */
function requestFor(d: Derivation, extra: Partial<InPageRequest>): InPageRequest | null {
  switch (d.kind) {
    case "snippet":
      if (d.shape === "textRange") return request("textRange", { start: d.start, end: d.end, ...extra });
      return request(d.shape, extra);
    case "attr":
      return request("attr", { name: d.name, ...extra });
    case "id":
      return request("id", extra);
    case "locator":
      return request("locator", extra);
    case "accname":
    case "accvalue":
      return request("accguard", extra);
    default:
      return null;
  }
}

/** One piece after the guard and the sanitiser. */
export interface Piece {
  /** The written string: the sanitised plain value, or exactly `[redacted]`. */
  readonly value: string;
  /** Redactions: the guard's own (1 for a withheld piece, or per replaced node and value in a kept composite), plus the sanitiser's. */
  readonly redactions: number;
  readonly withheld: boolean;
  readonly reason?: WithheldReason;
}

const withheld = (reason: WithheldReason): Piece => ({ value: MASK, redactions: 1, withheld: true, reason });

type GuardCtx = Pick<CheckContext, "frames" | "cdpFor">;

/** True when the frame key is in the target's frames and not detached. */
function frameUsable(key: FrameKey, ctx: Pick<CheckContext, "frames">): boolean {
  if (key.frame.isDetached()) return false;
  const info = ctx.frames.find((f) => f.frame === key.frame);
  return info !== undefined && info.readable;
}

/**
 * The context of every hosting frame element, from the frame up to the top
 * (3.3): "plain" only when every frame element and its document are plain.
 * Read through `frameElement()`, never by selector.
 */
async function frameChainVerdict(frame: Frame): Promise<"plain" | WithheldReason> {
  let cur: Frame | null = frame;
  while (cur !== null && cur.parentFrame() !== null) {
    let r: InPageResult;
    try {
      const el = await cur.frameElement();
      try {
        r = (await el.evaluate(inPageFunction as never, request("verdict") as never)) as InPageResult;
      } finally {
        await el.dispose().catch(() => undefined);
      }
    } catch {
      return "frame-chain";
    }
    if (!r.ok) return r.reason === "protected" ? "protected-frame" : "frame-chain";
    cur = cur.parentFrame();
  }
  return "plain";
}

/** Reads the chain twice around `fn` (3.3). The documents' own `designMode` is judged in the page. */
async function withFrameChain(frame: Frame, fn: () => Promise<InPageResult>): Promise<InPageResult> {
  const before = await frameChainVerdict(frame);
  if (before !== "plain") return { ok: false, reason: before };
  const r = await fn();
  const after = await frameChainVerdict(frame);
  if (after !== "plain") return { ok: false, reason: after === "protected-frame" ? "protected-frame" : "frame-chain-changed" };
  return r;
}

/* Closed shadow roots, through CDP (`DOM.getDocument` with `pierce`). */

interface CdpNode {
  backendNodeId: number;
  nodeType: number;
  nodeName: string;
  localName?: string;
  nodeValue?: string;
  attributes?: string[];
  children?: CdpNode[];
  shadowRoots?: CdpNode[];
  shadowRootType?: string;
  distributedNodes?: { backendNodeId: number }[];
  assignedSlot?: { backendNodeId: number };
  contentDocument?: CdpNode;
  documentURL?: string;
}

function cdpEditable(n: CdpNode): boolean {
  if (n.nodeType !== 1 || n.attributes === undefined) return false;
  let ce: string | null = null;
  let role: string | null = null;
  for (let i = 0; i + 1 < n.attributes.length; i += 2) {
    const name = (n.attributes[i] ?? "").toLowerCase();
    if (name === "contenteditable" && ce === null) ce = n.attributes[i + 1] ?? "";
    if (name === "role" && role === null) role = n.attributes[i + 1] ?? "";
  }
  if (ce !== null && ce.trim().toLowerCase() !== "false") return true;
  return role !== null && role.split(/[\t\n\f\r ]+/).some((t) => t !== "" && TEXTBOX_ROLE_LIST.includes(t.toLowerCase()));
}

/** The frame's document in a pierced CDP tree: the root for the main frame, else the one document with the frame's URL; null when ambiguous. */
function frameDocument(root: CdpNode, frame: Frame): CdpNode | null {
  if (frame.parentFrame() === null) return root;
  const found: CdpNode[] = [];
  const visit = (n: CdpNode): void => {
    if (n.nodeType === 9 && n.documentURL === frame.url()) found.push(n);
    for (const c of [...(n.children ?? []), ...(n.shadowRoots ?? [])]) visit(c);
    if (n.contentDocument !== undefined) visit(n.contentDocument);
  };
  visit(root);
  return found.length === 1 ? (found[0] ?? null) : null;
}

/**
 * Nodes assigned to a protected slot inside a closed shadow root, as paths
 * from the frame's document. `null` when this cannot be established.
 */
export async function closedSlotted(frame: Frame): Promise<{ path: PathStep[]; name: string }[] | null> {
  // The engine's own session, separate from `cdpFor`: `getDocument` resets the node ids a provider's session holds.
  let root: CdpNode;
  let session: CDPSession | undefined;
  try {
    const context = frame.page().context();
    if (frame.parentFrame() === null) session = await context.newCDPSession(frame.page());
    else session = await context.newCDPSession(frame).catch(() => context.newCDPSession(frame.page()));
    root = ((await session.send("DOM.getDocument", { depth: -1, pierce: true })) as { root: CdpNode }).root;
  } catch {
    return null;
  } finally {
    await session?.detach().catch(() => undefined);
  }
  const doc = frameDocument(root, frame);
  if (doc === null) return null;
  const parent = new Map<CdpNode, CdpNode>();
  const byBackend = new Map<number, CdpNode>();
  const slots: CdpNode[] = [];
  const assigned = new Map<number, Set<number>>();
  const visit = (n: CdpNode, containing: CdpNode | null): void => {
    byBackend.set(n.backendNodeId, n);
    if (n.localName === "slot" && containing?.shadowRootType === "closed") slots.push(n);
    if (n.assignedSlot !== undefined) {
      const set = assigned.get(n.assignedSlot.backendNodeId) ?? new Set<number>();
      set.add(n.backendNodeId);
      assigned.set(n.assignedSlot.backendNodeId, set);
    }
    for (const sr of n.shadowRoots ?? []) {
      parent.set(sr, n);
      visit(sr, sr);
    }
    for (const c of n.children ?? []) {
      parent.set(c, n);
      visit(c, containing);
    }
    // Frame documents and template content are not entered here.
  };
  visit(doc, null);
  const slotProtected = (slot: CdpNode): boolean => {
    let cur: CdpNode | undefined = slot;
    for (let guard = 0; cur !== undefined && guard < 10000; guard++) {
      if (cur === doc) return false;
      if (cdpEditable(cur)) return true;
      if (cur.assignedSlot !== undefined) {
        const next = byBackend.get(cur.assignedSlot.backendNodeId);
        if (next === undefined) return true; // unknown: fail closed
        cur = next;
      } else cur = parent.get(cur);
    }
    return true; // never reached the document: fail closed
  };
  const pathOf = (n: CdpNode): PathStep[] | null => {
    const steps: PathStep[] = [];
    let cur = n;
    while (cur !== doc) {
      const p = parent.get(cur);
      if (p === undefined) return null;
      if ((p.shadowRoots ?? []).includes(cur)) steps.unshift({ s: 1 });
      else if (cur.nodeType === 1) steps.unshift({ e: (p.children ?? []).filter((c) => c.nodeType === 1).indexOf(cur) });
      else if (cur.nodeType === 3) steps.unshift({ t: (p.children ?? []).filter((c) => c.nodeType === 3 && /\S/.test(c.nodeValue ?? "")).indexOf(cur) });
      else return null;
      cur = p;
    }
    return steps;
  };
  const out: { path: PathStep[]; name: string }[] = [];
  for (const slot of slots) {
    const ids = new Set<number>([...(slot.distributedNodes ?? []).map((d) => d.backendNodeId), ...(assigned.get(slot.backendNodeId) ?? [])]);
    if (ids.size === 0 || !slotProtected(slot)) continue;
    for (const id of ids) {
      const n = byBackend.get(id);
      if (n === undefined) return null;
      const path = pathOf(n);
      if (path === null) return null;
      out.push({ path, name: n.nodeName });
    }
  }
  return out;
}

async function evaluateOn(ref: NodeRef, req: InPageRequest, ctx: GuardCtx): Promise<InPageResult> {
  if (!("frame" in ref)) return { ok: false, reason: "unsupported-source" };
  if (!frameUsable(ref.frame, ctx)) return { ok: false, reason: "stale-frame" };
  const frame = ref.frame.frame;
  return withFrameChain(frame, async () => {
    const closed = await closedSlotted(frame);
    if (closed === null) return { ok: false, reason: "closed-shadow" };
    const full: InPageRequest = { ...req, closed };
    if ("handle" in ref) {
      try {
        return (await ref.handle.evaluate(inPageFunction as never, full as never)) as InPageResult;
      } catch {
        return { ok: false, reason: "evaluation-failed" };
      }
    }
    // A CDP backend node id, resolved in the engine's own object group, released in `finally`.
    const group = `rgaa-guard-${Math.random().toString(36).slice(2)}`;
    let session;
    try {
      session = await ctx.cdpFor(frame);
    } catch {
      return { ok: false, reason: "resolution-failed" };
    }
    try {
      const resolved = (await session.send("DOM.resolveNode", { backendNodeId: ref.backendNodeId, objectGroup: group })) as { object?: { objectId?: string } };
      const objectId = resolved.object?.objectId;
      if (objectId === undefined) return { ok: false, reason: "resolution-failed" };
      const r = (await session.send("Runtime.callFunctionOn", {
        objectId,
        functionDeclaration: `function (req) { return (${IN_PAGE_FUNCTION_SOURCE})(this, req); }`,
        arguments: [{ value: full }],
        returnByValue: true,
      })) as { result?: { value?: unknown }; exceptionDetails?: unknown };
      if (r.exceptionDetails !== undefined) return { ok: false, reason: "evaluation-failed" };
      return (r.result?.value as InPageResult | undefined) ?? { ok: false, reason: "evaluation-failed" };
    } catch {
      return { ok: false, reason: "resolution-failed" };
    } finally {
      await session.send("Runtime.releaseObjectGroup", { objectGroup: group }).catch(() => undefined);
    }
  });
}

/** The engine-syntax locator of every hosting frame element, top first, each judged in its own frame. */
async function frameLocatorPrefix(frame: Frame): Promise<string[] | WithheldReason> {
  const out: string[] = [];
  let cur: Frame | null = frame;
  while (cur !== null && cur.parentFrame() !== null) {
    let r: InPageResult;
    try {
      const el = await cur.frameElement();
      try {
        r = (await el.evaluate(inPageFunction as never, request("locator") as never)) as InPageResult;
      } finally {
        await el.dispose().catch(() => undefined);
      }
    } catch {
      return "frame-chain";
    }
    if (!r.ok) return r.reason === "protected" ? "protected-frame" : r.reason;
    out.unshift(r.value);
    cur = cur.parentFrame();
  }
  return out;
}

/** The accessible name or value of a CDP-referenced node (`Accessibility.getPartialAXTree`). */
async function axText(ref: NodeRef, which: "accname" | "accvalue", ctx: GuardCtx): Promise<string | null> {
  if (!("backendNodeId" in ref)) return null;
  try {
    const session = await ctx.cdpFor(ref.frame.frame);
    const { nodes } = (await session.send("Accessibility.getPartialAXTree", { backendNodeId: ref.backendNodeId, fetchRelatives: false })) as {
      nodes: { backendDOMNodeId?: number; name?: { value?: unknown }; value?: { value?: unknown } }[];
    };
    const n = nodes.find((x) => x.backendDOMNodeId === ref.backendNodeId);
    if (n === undefined) return null;
    const v = which === "accname" ? n.name?.value : n.value?.value;
    return v === undefined || v === null ? "" : String(v);
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

async function deriveRaw(d: Derivation, ctx: GuardCtx, sanitiser: Sanitiser, options: DeriveOptions, timeoutMs: number): Promise<{ piece: Piece; probeKey: string | null }> {
  const probeKey = options.probe === undefined ? {} : { probe: true };
  if (d.kind === "frameUrl") {
    let key: FrameKey | null = null;
    if ("frame" in d.source) key = d.source.frame;
    else if ("handle" in d.source.node) {
      const f = await d.source.node.handle.asElement()?.contentFrame().catch(() => null);
      key = f === null || f === undefined ? null : { frame: f };
    }
    if (key === null) return { piece: withheld("unsupported-source"), probeKey: null };
    if (!frameUsable(key, ctx)) return { piece: withheld("stale-frame"), probeKey: null };
    const v = await frameChainVerdict(key.frame);
    if (v !== "plain") return { piece: withheld(v), probeKey: null };
    const s = sanitiser.url(key.frame.url());
    return { piece: { value: s.value, redactions: s.redactions, withheld: false }, probeKey: null };
  }
  const hook = d.kind === "snippet" && d.shape !== "startTag" ? hookFor(options.probe, timeoutMs) : undefined;
  const req = requestFor(d, { ...probeKey, ...(hook === undefined ? {} : { hook }) });
  if (req === null) return { piece: withheld("unsupported-kind"), probeKey: null };
  if (!("node" in d.source)) return { piece: withheld("unsupported-source"), probeKey: null };
  const ref = d.source.node;
  const r = await evaluateOn(ref, req, ctx).catch((): InPageResult => ({ ok: false, reason: "evaluation-failed" }));
  const key = r.probe ?? null;
  if (!r.ok) return { piece: withheld(r.reason), probeKey: key };
  if (d.kind === "locator" && "frame" in ref) {
    const prefix = await frameLocatorPrefix(ref.frame.frame);
    if (typeof prefix === "string") return { piece: withheld(prefix), probeKey: key };
    const s = sanitiser.text([...prefix, r.value].join(" >>> "));
    return { piece: { value: s.value, redactions: s.redactions, withheld: false }, probeKey: key };
  }
  if (d.kind === "accname" || d.kind === "accvalue") {
    const text = await axText(ref, d.kind, ctx);
    if (text === null) return { piece: withheld("unsupported-source"), probeKey: key };
    const s = sanitiser.text(text);
    return { piece: { value: s.value, redactions: s.redactions, withheld: false }, probeKey: key };
  }
  const s = d.kind === "snippet" && d.shape !== "textRange" ? sanitiser.snippet(r.value) : sanitiser.text(r.value);
  return { piece: { value: s.value, redactions: r.count + s.redactions, withheld: false }, probeKey: key };
}

/**
 * Derive, judge and sanitise one piece (3.4). A withheld piece is exactly
 * `[redacted]` with 1 redaction; a kept composite carries its own count plus
 * the sanitiser's. Snippets go through `sanitiser.snippet` (the cap comes
 * after the guard), `frameUrl` through `sanitiser.url`, the rest through
 * `sanitiser.text`. Past the guard timeout, the piece is withheld.
 */
export async function derivePiece(d: Derivation, ctx: GuardCtx, sanitiser: Sanitiser, options: DeriveOptions = {}): Promise<Piece> {
  const timeoutMs = options.timeoutMs ?? (options.probe?.forceCompositeWalkTimeout !== undefined ? 250 : GUARD_TIMEOUT_MS);
  let out: { piece: Piece; probeKey: string | null };
  try {
    out = await withTimeout(deriveRaw(d, ctx, sanitiser, options, timeoutMs), timeoutMs, { piece: withheld("timeout"), probeKey: null });
  } catch {
    out = { piece: withheld("evaluation-failed"), probeKey: null };
  }
  options.probe?.record({
    pieceKind: pieceKind(d),
    verdict: out.piece.withheld ? "withheld" : "plain",
    ...(out.piece.reason === undefined ? {} : { reason: out.piece.reason }),
    count: out.piece.redactions,
    probeKey: out.probeKey,
  });
  return out.piece;
}

/* Notes, evidence items and lists (3.2, 3.4). */

/** Check-owned text that was not declared, or a slot of the wrong kind: a provider bug. */
export class UndeclaredTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UndeclaredTextError";
  }
}

/** Fixed engine notes (3.4). No page text. */
export const PROTECTED_NOTE = "Element in protected context: fields withheld.";
export const unestablishedNote = (code: WithheldReason): string => `Element whose context could not be established (${code}): fields withheld.`;

const isDerivation = (s: NoteSlot): s is Derivation => typeof s === "object" && "source" in s && "kind" in s;

/**
 * A note from a declared template (`{0}`, `{1}`, … placeholders) and its
 * slots: a finite number, a declared enumeration value, or a text derivation
 * (not a snippet). Throws `UndeclaredTextError` for an undeclared template or
 * enumeration value, a slot of another kind, or placeholders that do not
 * match the slots. A withheld derived slot becomes `[redacted]`, counted 1.
 */
export async function deriveNote(note: SourcedNote, declared: DeclaredText | undefined, ctx: GuardCtx, sanitiser: Sanitiser, options: DeriveOptions = {}): Promise<{ value: string; redactions: number }> {
  if (typeof note.template !== "string" || !(declared?.templates ?? []).includes(note.template)) throw new UndeclaredTextError("note template not declared");
  const used = new Set<number>();
  for (const m of note.template.matchAll(/\{(\d+)\}/g)) used.add(Number(m[1]));
  if (used.size !== note.slots.length || [...used].some((i) => i >= note.slots.length)) throw new UndeclaredTextError("note slots do not match the template");
  const values: string[] = [];
  let redactions = 0;
  for (const slot of note.slots) {
    if (typeof slot === "number") {
      if (!Number.isFinite(slot)) throw new UndeclaredTextError("note slot is not a finite number");
      values.push(String(slot));
    } else if (isDerivation(slot)) {
      if (slot.kind === "snippet") throw new UndeclaredTextError("a snippet cannot fill a note slot");
      const p = await derivePiece(slot, ctx, sanitiser, options);
      values.push(p.value);
      redactions += p.redactions;
    } else if (typeof slot === "object" && slot !== null && typeof slot.enumeration === "string" && typeof slot.value === "string") {
      if (!(declared?.enumerations?.[slot.enumeration] ?? []).includes(slot.value)) throw new UndeclaredTextError("enumeration value not declared");
      values.push(slot.value);
    } else throw new UndeclaredTextError("unknown note slot kind");
  }
  return { value: note.template.replace(/\{(\d+)\}/g, (_m, i: string) => values[Number(i)] ?? ""), redactions };
}

/** An evidence item after the guard: schema fields (without `id`) and the guarded list. */
export interface DerivedEvidence {
  readonly evidence: Omit<Evidence, "id">;
  /** `locatorList`, member by member; withheld members keep the list's length. */
  readonly locatorList?: readonly string[];
}

/** A reason that means the source itself failed (as opposed to the field rule withholding one value). */
const sourceFailed = (p: Piece): boolean => p.withheld && p.reason !== "value-match" && p.reason !== "contains-field-or-box";

/**
 * Guard one evidence item (3.2 to 3.5). Each piece is judged on its own
 * source. If the snippet's or locator's source fails, every piece of the item
 * is withheld (each counted 1) and its note becomes a fixed engine note,
 * except a `scope_examined` item, which keeps its template note and its list.
 */
export async function deriveEvidence(item: SourcedEvidence, declared: DeclaredText | undefined, ctx: GuardCtx, sanitiser: Sanitiser, options: DeriveOptions = {}): Promise<DerivedEvidence> {
  const snippet = item.snippet === undefined ? undefined : await derivePiece(item.snippet, ctx, sanitiser, options);
  const locator = item.locator === undefined ? undefined : await derivePiece(item.locator, ctx, sanitiser, options);
  const failed = [snippet, locator].find((p): p is Piece => p !== undefined && sourceFailed(p));
  const out: { kind: Evidence["kind"]; snippet?: string; locator?: string; note?: string; redactions: number } = { kind: item.kind, redactions: 0 };
  if (failed !== undefined && item.kind !== "scope_examined") {
    if (snippet !== undefined) out.snippet = MASK;
    if (locator !== undefined) out.locator = MASK;
    out.redactions = (snippet === undefined ? 0 : 1) + (locator === undefined ? 0 : 1);
    if (item.note !== undefined) {
      if (!(declared?.templates ?? []).includes(item.note.template)) throw new UndeclaredTextError("note template not declared");
      out.redactions += item.note.slots.filter(isDerivation).length;
    }
    out.note = failed.reason === "protected" || failed.reason === "protected-frame" ? PROTECTED_NOTE : unestablishedNote(failed.reason ?? "evaluation-failed");
    const list = item.locatorList?.map(() => MASK);
    out.redactions += list?.length ?? 0;
    return list === undefined ? { evidence: out } : { evidence: out, locatorList: list };
  }
  if (snippet !== undefined) {
    out.snippet = snippet.value;
    out.redactions += snippet.redactions;
  }
  if (locator !== undefined) {
    out.locator = locator.value;
    out.redactions += locator.redactions;
  }
  if (item.note !== undefined) {
    const n = await deriveNote(item.note, declared, ctx, sanitiser, options);
    out.note = n.value;
    out.redactions += n.redactions;
  }
  if (item.locatorList === undefined) return { evidence: out };
  const list: string[] = [];
  for (const m of item.locatorList) {
    const p = await derivePiece(m, ctx, sanitiser, options);
    list.push(p.value);
    out.redactions += p.redactions;
  }
  return { evidence: out, locatorList: list };
}

/** A fingerprint built from a declared label and its parts (3.6). */
export interface BuiltFingerprint {
  readonly value: string;
  /** Parts that were not plain: counted once, on `evidence[0]` (3.5). */
  readonly withheldParts: number;
}

/**
 * `<checkId>:<label>:<parts joined by "|">`, each part plain and sanitised or
 * `[withheld]`; hashed (SHA-256, 16 hex digits) when longer than 200
 * characters. The label must be declared by the check.
 */
export async function buildFingerprint(
  checkId: string,
  fp: SourcedFingerprint,
  declaredLabels: readonly string[],
  ctx: GuardCtx,
  sanitiser: Sanitiser,
  options: DeriveOptions = {},
): Promise<BuiltFingerprint> {
  if (!declaredLabels.includes(fp.label)) throw new UndeclaredTextError(`fingerprint label not declared by ${checkId}`);
  const parts: string[] = [];
  let withheldParts = 0;
  for (const d of fp.parts) {
    const p = await derivePiece(d, ctx, sanitiser, options);
    if (p.withheld) {
      withheldParts += 1;
      parts.push(WITHHELD_PART);
    } else parts.push(p.value);
  }
  const text = `${checkId}:${fp.label}:${parts.join("|")}`;
  const value = text.length > 200 ? `${checkId}:${fp.label}:${createHash("sha256").update(text).digest("hex").slice(0, 16)}` : text;
  return { value, withheldParts };
}

/** The fixed sentence appended to `evidence[0]`'s note (3.5). */
export const fingerprintNote = (n: number): string => `Redactions include ${n} withheld fingerprint part(s).`;

/**
 * Attribute withheld fingerprint parts once, to the first evidence item (3.5):
 * its redactions grow by `n` and its note gets the fixed sentence. With no
 * evidence, a `text` item carrying the note and the count is appended.
 * Returns a new array; `n` = 0 changes nothing.
 */
export function attributeFingerprintWithholding(evidence: readonly Evidence[], n: number, newId: string): Evidence[] {
  if (n <= 0) return [...evidence];
  const [first, ...rest] = evidence;
  if (first === undefined) return [{ id: newId, kind: "text", note: fingerprintNote(n), redactions: n } as Evidence];
  const note = first.note === undefined || first.note === "" ? fingerprintNote(n) : `${first.note} ${fingerprintNote(n)}`;
  return [{ ...first, note, redactions: (first.redactions ?? 0) + n }, ...rest];
}
