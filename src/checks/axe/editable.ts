/**
 * Editable boxes in axe snippets (spec 8.7, Q56, Q61). axe-core reports each
 * node's own markup (`node.html`), without its ancestors, so the sanitiser
 * cannot see that the text belongs to an editable box (`contenteditable`, a
 * textbox-like role, or a document in designMode). Before the results are
 * mapped, every snippet that is a part of an editable box's markup, in any
 * frame of the page, is wrapped in that box's start tag; the sanitiser then
 * masks it and counts the redaction. The match is on the markup, so it can
 * only over-redact (a twin of the markup outside any box is masked too).
 */
import type { AxeResults } from "axe-core";
import { TEXTBOX_ROLE_LIST } from "../../engine/sanitise.ts";
import type { FrameInfo } from "../types.ts";

interface Box {
  shell: string;
  html: string;
}

/** Runs in a frame (plain JavaScript, the TypeScript configuration has no DOM library): its editable boxes in the flat tree (open shadow roots) and its designMode. */
function readBoxesExpression(roles: readonly string[]): string {
  return `(function (roles) {
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
  var out = [];
  var walk = function (root) {
    var els = root.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (editable(el)) {
        var h = el.cloneNode(false).outerHTML;
        out.push({ shell: h.slice(0, h.lastIndexOf("</")), html: el.outerHTML });
      }
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  if (String(document.designMode).toLowerCase() === "on") out.push({ shell: '<div contenteditable="true">', html: document.documentElement.outerHTML });
  return out;
})(${JSON.stringify(roles)})`;
}

/** Wrap the snippets of `results` that sit inside an editable box. Changes the results in place. */
export async function guardEditableSnippets(results: AxeResults, frames: readonly FrameInfo[]): Promise<void> {
  const boxes: Box[] = [];
  for (const info of frames) {
    if (!info.readable) continue;
    try {
      boxes.push(...((await info.frame.evaluate(readBoxesExpression(TEXTBOX_ROLE_LIST))) as Box[]));
    } catch {
      // a frame that cannot be read has no snippet to guard here
    }
  }
  if (boxes.length === 0) return;
  for (const list of [results.violations, results.incomplete, results.passes, results.inapplicable]) {
    for (const rule of list) {
      for (const node of rule.nodes) {
        // axe may cut long markup: compare on its beginning
        const probe = node.html.slice(0, 120);
        if (probe === "") continue;
        const box = boxes.find((b) => b.html.includes(probe));
        if (box !== undefined) node.html = `${box.shell}${node.html}</div>`;
      }
    }
  }
}
