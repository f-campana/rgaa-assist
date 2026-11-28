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
import type { Frame } from "playwright";
import type { CheckContext, Derivation, FrameKey, NodeRef, SourcedFingerprint } from "../checks/types.ts";
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
  | "bad-range";

/** What the in-page evaluation returns. */
export type InPageResult =
  | { readonly ok: true; readonly value: string; readonly count: number }
  | { readonly ok: false; readonly reason: WithheldReason };

/** The in-page request: what to derive from the node. */
export interface InPageRequest {
  readonly op: "verdict" | "outer" | "startTag" | "startTagAndText" | "textRange" | "attr" | "id";
  readonly name?: string;
  readonly start?: number;
  readonly end?: number;
  readonly roles: readonly string[];
  readonly allow: readonly string[];
  readonly cap: number;
  /** Tests only: make the walk fail at its n-th node (forced failure, 3.4a all or nothing). */
  readonly failAt?: number;
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
    if (req.failAt !== undefined && st.nodes === req.failAt) throw new Fail("evaluation-failed");
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
try {
  if (!node || (node.nodeType !== 1 && node.nodeType !== 3)) return { ok: false, reason: "not-element" };
  var doc = documentOf(node);
  checkDocument(doc);
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
      if (req.failAt !== undefined && st.nodes === req.failAt) throw new Fail("evaluation-failed");
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
`;

/** The in-page function, as Playwright and CDP `callFunctionOn` take it. */
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const inPageFunction = new Function("node", "req", IN_PAGE_BODY) as (node: unknown, req: InPageRequest) => InPageResult;
export const IN_PAGE_FUNCTION_SOURCE: string = inPageFunction.toString();

function request(op: InPageRequest["op"], extra: Partial<InPageRequest> = {}): InPageRequest {
  return { op, roles: TEXTBOX_ROLE_LIST, allow: FIELD_ATTRIBUTE_ALLOW_LIST, cap: WALK_NODE_CAP, ...extra };
}

/** The request for a derivation, or null when the kind is not handled in this slice. */
export function requestFor(d: Derivation, testing: { failAt?: number } = {}): InPageRequest | null {
  const t = testing.failAt === undefined ? {} : { failAt: testing.failAt };
  switch (d.kind) {
    case "snippet":
      if (d.shape === "textRange") return request("textRange", { start: d.start, end: d.end, ...t });
      return request(d.shape, t);
    case "attr":
      return request("attr", { name: d.name });
    case "id":
      return request("id");
    default:
      // locator, accname, accvalue, frameUrl: not in this slice; withheld.
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

/** The main frame's document in `designMode` is judged in the page; this reads the chain twice around `fn` (3.3). */
async function withFrameChain(frame: Frame, fn: () => Promise<InPageResult>): Promise<InPageResult> {
  const before = await frameChainVerdict(frame);
  if (before !== "plain") return { ok: false, reason: before };
  const r = await fn();
  const after = await frameChainVerdict(frame);
  if (after !== "plain") return { ok: false, reason: after === "protected-frame" ? "protected-frame" : "frame-chain-changed" };
  return r;
}

async function evaluateOn(ref: NodeRef, req: InPageRequest, ctx: Pick<CheckContext, "frames" | "cdpFor">): Promise<InPageResult> {
  if (!("frame" in ref)) return { ok: false, reason: "unsupported-source" };
  if (!frameUsable(ref.frame, ctx)) return { ok: false, reason: "stale-frame" };
  const frame = ref.frame.frame;
  return withFrameChain(frame, async () => {
    if ("handle" in ref) {
      try {
        return (await ref.handle.evaluate(inPageFunction as never, req as never)) as InPageResult;
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
        arguments: [{ value: req }],
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

/** Options for `derivePiece`. */
export interface DeriveOptions {
  /** Tests only: force the composite walk to fail at its n-th node. */
  readonly failAt?: number;
}

/**
 * Derive, judge and sanitise one piece (3.4). A withheld piece is exactly
 * `[redacted]` with 1 redaction; a kept composite carries its own count plus
 * the sanitiser's. Snippets go through `sanitiser.snippet` (the cap comes
 * after the guard), other pieces through `sanitiser.text`.
 */
export async function derivePiece(
  d: Derivation,
  ctx: Pick<CheckContext, "frames" | "cdpFor">,
  sanitiser: Sanitiser,
  options: DeriveOptions = {},
): Promise<Piece> {
  const req = requestFor(d, options.failAt === undefined ? {} : { failAt: options.failAt });
  if (req === null) return withheld("unsupported-kind");
  if (!("node" in d.source)) return withheld("unsupported-source");
  let r: InPageResult;
  try {
    r = await evaluateOn(d.source.node, req, ctx);
  } catch {
    r = { ok: false, reason: "evaluation-failed" };
  }
  if (!r.ok) return withheld(r.reason);
  const s = d.kind === "snippet" && d.shape !== "textRange" ? sanitiser.snippet(r.value) : sanitiser.text(r.value);
  return { value: s.value, redactions: r.count + s.redactions, withheld: false };
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
  ctx: Pick<CheckContext, "frames" | "cdpFor">,
  sanitiser: Sanitiser,
): Promise<BuiltFingerprint> {
  if (!declaredLabels.includes(fp.label)) throw new Error(`fingerprint label not declared by ${checkId}`);
  const parts: string[] = [];
  let withheldParts = 0;
  for (const d of fp.parts) {
    const p = await derivePiece(d, ctx, sanitiser);
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
