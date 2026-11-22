/**
 * Editable boxes in axe snippets (spec 8.7, Q56, Q61, Q62). axe-core reports
 * each node's own markup (`node.html`), without its ancestors, so the
 * sanitiser cannot see that the text belongs to an editable box
 * (`contenteditable`, a textbox-like role, or a document in designMode).
 * Matching that markup against a box's `outerHTML` misses everything in a
 * shadow tree, so the node is resolved instead: its `node.target` names the
 * frame chain (one entry per frame level) and, in an entry that is an array, a
 * shadow-piercing chain (host selector, then selectors inside each open shadow
 * root). In its frame the element and its flat-tree ancestors (assigned slot,
 * then parent, a shadow root's host, and the frame element of a framed
 * document) are tested with the shared definition of an editable box. A node
 * inside one is wrapped in that ancestor's start tag, which the sanitiser masks
 * and counts. A node that cannot be resolved is wrapped too (masked rather
 * than leaked) and listed in `UNRESOLVED`, which the mapping reports in the
 * evidence note.
 */
import type { AxeResults } from "axe-core";
import type { Frame } from "playwright";
import { TEXTBOX_ROLE_LIST } from "../../engine/sanitise.ts";
import type { FrameInfo } from "../types.ts";

/** Nodes whose editable ancestry could not be established; their snippet was masked. */
export const UNRESOLVED: WeakSet<object> = new WeakSet();

interface Wrap {
  shell: string;
  end: string;
}
type Verdict = { s: "e"; shell: string; end: string } | { s: "c" } | { s: "u" };

/** Page-side library (plain JavaScript, the TypeScript configuration has no DOM library). */
function libSource(roles: readonly string[]): string {
  return `
  var roles = ${JSON.stringify(roles)};
  var lower = function (s) { return String(s).replace(/[A-Z]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 32); }); };
  var attr = function (el, name) {
    for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (a.namespaceURI === null && lower(a.name) === name) return a.value; }
    return null;
  };
  var editable = function (el) {
    var ce = attr(el, "contenteditable");
    if (ce !== null && lower(ce.trim()) !== "false") return true;
    var role = attr(el, "role");
    return role !== null && role.split(/[\\t\\n\\f\\r ]+/).some(function (t) { return roles.indexOf(lower(t)) !== -1; });
  };
  var ancestry = function (el) {
    var cur = el;
    while (cur) {
      if (cur.nodeType === 1 && editable(cur)) {
        var h = cur.cloneNode(false).outerHTML, k = h.lastIndexOf("</");
        return k === -1 ? { s: "e", shell: h, end: "" } : { s: "e", shell: h.slice(0, k), end: "</" + cur.localName + ">" };
      }
      var next = cur.nodeType === 1 && cur.assignedSlot ? cur.assignedSlot : cur.parentNode;
      if (next && next.nodeType === 11 && next.host) next = next.host;
      cur = next;
    }
    var doc = el.ownerDocument || el;
    if (String(doc.designMode).toLowerCase() === "on") return { s: "e", shell: '<div contenteditable="true">', end: "</div>" };
    return { s: "c" };
  };
  var candidates = function (entry) {
    var chain = typeof entry === "string" ? [entry] : entry;
    var roots = [document], out = [];
    for (var i = 0; i < chain.length; i++) {
      var found = [];
      for (var r = 0; r < roots.length; r++) found = found.concat(Array.prototype.slice.call(roots[r].querySelectorAll(chain[i])));
      if (i === chain.length - 1) out = found;
      else roots = found.map(function (m) { return m.shadowRoot; }).filter(function (x) { return x; });
    }
    return out;
  };`;
}

/** Runs in a frame with the last entries of its targets: one verdict per entry (any editable match wins). */
const verdictsExpression = (roles: readonly string[], entries: readonly unknown[]): string => `(function (entries) {${libSource(roles)}
  return entries.map(function (entry) {
    try {
      var c = candidates(entry);
      if (c.length === 0) return { s: "u" };
      for (var i = 0; i < c.length; i++) { var v = ancestry(c[i]); if (v.s === "e") return v; }
      return { s: "c" };
    } catch (e) { return { s: "u" }; }
  });
})(${JSON.stringify(entries)})`;

/** Runs in a frame with one frame-element entry: the single element it names, or null. */
const frameElementExpression = (roles: readonly string[], entry: unknown): string => `(function (entry) {${libSource(roles)}
  var c = candidates(entry);
  return c.length === 1 ? c[0] : null;
})(${JSON.stringify(entry)})`;

/** Runs on a frame element: its own editable ancestry. */
const ancestryExpression = (roles: readonly string[]): string => `(function (el) {${libSource(roles)}
  return ancestry(el);
})`;

interface Level {
  frame: Frame | null;
  wrap: Wrap | null;
}

interface AnyNode {
  html: string;
  target: unknown;
}

const validEntry = (e: unknown): boolean => typeof e === "string" || (Array.isArray(e) && e.length > 0 && e.every((x) => typeof x === "string"));

const UNKNOWN: Wrap = { shell: '<div contenteditable="true">', end: "</div>" };

function mask(node: AnyNode, w: Wrap, unresolved: boolean): void {
  node.html = `${w.shell}${node.html}${w.end}`;
  if (unresolved) UNRESOLVED.add(node);
}

/** Wrap the snippets of `results` that sit inside an editable box, or whose place is unknown. Changes the results in place. */
export async function guardEditableSnippets(results: AxeResults, frames: readonly FrameInfo[]): Promise<void> {
  const nodes: AnyNode[] = [];
  for (const list of [results.violations, results.incomplete, results.passes, results.inapplicable]) {
    for (const rule of list) for (const node of rule.nodes) nodes.push(node as unknown as AnyNode);
  }
  if (nodes.length === 0) return;
  const main = frames.find((f) => f.parent === null);
  const readable = new Set(frames.filter((f) => f.readable).map((f) => f.frame));

  const levels = new Map<string, Promise<Level>>();
  const levelOf = (prefix: unknown[]): Promise<Level> => {
    const key = JSON.stringify(prefix);
    let hit = levels.get(key);
    if (hit === undefined) {
      hit = (async (): Promise<Level> => {
        if (prefix.length === 0) return { frame: main !== undefined && readable.has(main.frame) ? main.frame : null, wrap: null };
        const parent = await levelOf(prefix.slice(0, -1));
        const entry = prefix[prefix.length - 1];
        if (parent.frame === null || !validEntry(entry)) return { frame: null, wrap: null };
        try {
          const handle = await parent.frame.evaluateHandle(frameElementExpression(TEXTBOX_ROLE_LIST, entry));
          const el = handle.asElement();
          if (el === null) return { frame: null, wrap: null };
          const child = await el.contentFrame();
          const anc = (await el.evaluate(ancestryExpression(TEXTBOX_ROLE_LIST) as never)) as Verdict;
          const wrap: Wrap | null = parent.wrap ?? (anc.s === "e" ? { shell: anc.shell, end: anc.end } : null);
          return { frame: child !== null && readable.has(child) ? child : null, wrap };
        } catch {
          return { frame: null, wrap: null };
        }
      })();
      levels.set(key, hit);
    }
    return hit;
  };

  const byFrame = new Map<Frame, { items: { node: AnyNode; entry: unknown }[]; wrap: Wrap | null }>();
  for (const node of nodes) {
    const entries: unknown = node.target;
    if (!Array.isArray(entries) || entries.length === 0 || !validEntry(entries[entries.length - 1])) {
      mask(node, UNKNOWN, true);
      continue;
    }
    const lvl = await levelOf(entries.slice(0, -1));
    if (lvl.frame === null) {
      mask(node, UNKNOWN, true);
      continue;
    }
    let slot = byFrame.get(lvl.frame);
    if (slot === undefined) {
      slot = { items: [], wrap: lvl.wrap };
      byFrame.set(lvl.frame, slot);
    }
    slot.items.push({ node, entry: entries[entries.length - 1] });
  }
  for (const [frame, { items, wrap }] of byFrame) {
    let verdicts: Verdict[];
    try {
      verdicts = (await frame.evaluate(verdictsExpression(TEXTBOX_ROLE_LIST, items.map((i) => i.entry)))) as Verdict[];
    } catch {
      verdicts = items.map((): Verdict => ({ s: "u" }));
    }
    items.forEach(({ node }, i) => {
      const v: Verdict = verdicts[i] ?? { s: "u" };
      if (v.s === "u") mask(node, UNKNOWN, true);
      else if (v.s === "e") mask(node, v, false);
      else if (wrap !== null) mask(node, wrap, false);
    });
  }
}
