// custom/8-3-default-lang-present: candidate witnesses, in tree order. A
// candidate is a text node that meets conditions (a) place (apart from closed
// shadow hosts), (b) letters, (d) font, (e) paint, (f) contrast and
// (g) geometry of the record, with no lang or xml:lang attribute in any form
// on body or on the elements between body and the node (the caller has
// checked html). Conditions (c) exposure and the closed-shadow-host part of
// (a) are checked by the caller through CDP.
// Runs through CDP Runtime.evaluate: returns { nodes: Text[], data }, kept as
// a remote object so that the caller can reach each node.
// arg: { allowed, generics, fonts (ASCII lowercase), skip, limit }
function (C, arg) {
  "use strict";
  var doc = document;
  var win = doc.defaultView;
  var body = doc.body;
  var stats = { editable: 0, textNodes: 0, notTwoLetters: 0, font: 0, paint: 0, contrast: 0, geometry: 0, elementsNotEntered: 0 };
  var nodes = [];
  var items = [];
  var result = { nodes: nodes, data: { items: items, stats: stats, done: true, bodyEligible: false } };
  if (body === null || !C.isHtml(body, "body")) return result;

  var ALLOWED = new Set(arg.allowed);
  var GENERICS = new Set(arg.generics);
  var FONTS = new Set(arg.fonts);
  var FORBIDDEN = new Set(["role", "aria-hidden", "hidden", "inert"]);
  var LETTERS = /\p{L}\p{M}*\p{L}/u;

  // (a), and "uncovered": no role, aria-hidden, hidden or inert attribute and
  // no lang or xml:lang attribute, in any form, and not an (open) shadow host.
  function excluded(el) {
    if (el.shadowRoot) return true;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (FORBIDDEN.has(C.asciiLower(a.localName)) || C.isLangAttribute(a)) return true;
    }
    return false;
  }
  if (excluded(body)) return result;
  result.data.bodyEligible = true;

  var styles = new Map();
  function style(el) {
    var s = styles.get(el);
    if (s === undefined) {
      s = win.getComputedStyle(el);
      styles.set(el, s);
    }
    return s;
  }

  // (d) Font.
  function unquote(s) {
    s = String(s).trim();
    if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) return s.slice(1, -1);
    return s;
  }
  function parseFamilies(v) {
    var out = [];
    var i = 0;
    var n = v.length;
    while (i < n) {
      while (i < n && (v[i] === "," || /\s/.test(v[i]))) i++;
      if (i >= n) break;
      var c = v[i];
      var s = "";
      if (c === '"' || c === "'") {
        i++;
        while (i < n && v[i] !== c) {
          if (v[i] === "\\" && i + 1 < n) i++;
          s += v[i];
          i++;
        }
        i++;
        out.push({ quoted: true, name: s });
        while (i < n && v[i] !== ",") i++;
      } else {
        while (i < n && v[i] !== ",") {
          s += v[i];
          i++;
        }
        out.push({ quoted: false, name: s.trim().replace(/\s+/g, " ") });
      }
    }
    return out;
  }
  var pageFamilies = null;
  function definedByPage(name) {
    if (pageFamilies === null) {
      pageFamilies = new Set();
      doc.fonts.forEach(function (f) {
        pageFamilies.add(C.asciiLower(unquote(f.family)));
      });
    }
    return pageFamilies.has(C.asciiLower(name));
  }
  var fontMemo = new Map();
  function fontOk(el) {
    if (fontMemo.has(el)) return fontMemo.get(el);
    var fams = parseFamilies(style(el).fontFamily);
    var ok = fams.length > 0;
    for (var i = 0; ok && i < fams.length; i++) {
      var f = fams[i];
      var low = C.asciiLower(f.name);
      var listed = (!f.quoted && GENERICS.has(low)) || FONTS.has(low);
      // RECORD: Chromium serialises the family BlinkMacSystemFont in the
      // computed font-family as the quoted name "system-ui", so the pinned
      // list's BlinkMacSystemFont would never match. A quoted "system-ui" is
      // read as BlinkMacSystemFont (see index.ts of the check).
      var blink = f.quoted && low === "system-ui" && FONTS.has("blinkmacsystemfont");
      if (blink) listed = true;
      if (!listed || definedByPage(f.name) || (blink && definedByPage("BlinkMacSystemFont"))) ok = false;
    }
    fontMemo.set(el, ok);
    return ok;
  }

  // Colours as Chromium serialises computed values (rgb(), rgba(),
  // color(srgb …)).
  // RECORD: Chromium keeps a colour given in another space (lab, oklch,
  // color(display-p3 …)) in that space in the computed value, and the check
  // does not convert it, so it cannot read its alpha or compute the contrast
  // of (e) and (f). The node is then not a witness: the check abstains where
  // the record might fault.
  function parseColor(v) {
    var m = /^rgba?\(([^)]*)\)$/.exec(v);
    var scale = 1;
    if (m === null) {
      m = /^color\(srgb\s+([^)]*)\)$/.exec(v);
      scale = 255;
    }
    if (m === null) return null;
    var p = m[1].split(/[\s,\/]+/).filter(function (x) {
      return x.length > 0;
    });
    if (p.length < 3 || p.length > 4) return null;
    var r = parseFloat(p[0]) * scale;
    var g = parseFloat(p[1]) * scale;
    var b = parseFloat(p[2]) * scale;
    var a = 1;
    if (p.length === 4) a = /%$/.test(p[3]) ? parseFloat(p[3]) / 100 : parseFloat(p[3]);
    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null;
    return { r: r, g: g, b: b, a: a };
  }

  // (e) Paint.
  var paintMemo = new Map();
  function ownPaintOk(el) {
    if (paintMemo.has(el)) return paintMemo.get(el);
    var s = style(el);
    var mask = s.getPropertyValue("mask-image") || "none";
    var wmask = s.getPropertyValue("-webkit-mask-image") || "none";
    var ok =
      s.opacity === "1" &&
      s.filter === "none" &&
      s.mixBlendMode === "normal" &&
      s.clipPath === "none" &&
      mask === "none" &&
      wmask === "none" &&
      s.clip === "auto";
    paintMemo.set(el, ok);
    return ok;
  }
  function paintOk(parent) {
    var s = style(parent);
    if (s.visibility !== "visible") return false;
    if (s.getPropertyValue("-webkit-text-security") !== "none") return false;
    if (!(parseFloat(s.fontSize) >= 8)) return false;
    var col = parseColor(s.color);
    var fill = parseColor(s.getPropertyValue("-webkit-text-fill-color"));
    if (col === null || col.a !== 1 || fill === null || fill.a !== 1) return false;
    for (var el = parent; el !== null && el.nodeType === 1; el = el.parentElement) if (!ownPaintOk(el)) return false;
    return true;
  }

  // (f) Contrast.
  function luminance(c) {
    function ch(v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }
  function contrastOk(parent) {
    var s = style(parent);
    if (s.getPropertyValue("-webkit-text-fill-color") !== s.color) return false;
    var fg = parseColor(s.color);
    if (fg === null) return false;
    var bg = null;
    for (var el = parent; el !== null && el.nodeType === 1; el = el.parentElement) {
      var es = style(el);
      if (es.backgroundImage !== "none") return false;
      var c = parseColor(es.backgroundColor);
      if (c === null) return false;
      if (c.a > 0 && c.a < 1) return false;
      if (c.a === 1) {
        bg = c;
        break;
      }
    }
    if (bg === null) {
      if (style(doc.documentElement).colorScheme !== "normal") return false;
      bg = { r: 255, g: 255, b: 255, a: 1 };
    }
    var l1 = luminance(fg);
    var l2 = luminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) >= 2;
  }

  // (g) Geometry.
  var vv = win.visualViewport;
  var vw = vv ? vv.width : win.innerWidth;
  var vh = vv ? vv.height : win.innerHeight;
  var clipMemo = new Map();
  function clipBox(el) {
    if (clipMemo.has(el)) return clipMemo.get(el);
    var s = style(el);
    var box = null;
    var contain = " " + String(s.contain).replace(/,/g, " ") + " ";
    if (s.overflowX !== "visible" || s.overflowY !== "visible" || /\s(paint|content|strict)\s/.test(contain)) {
      var r = el.getBoundingClientRect();
      box = {
        l: r.left + (parseFloat(s.borderLeftWidth) || 0),
        t: r.top + (parseFloat(s.borderTopWidth) || 0),
        r: r.right - (parseFloat(s.borderRightWidth) || 0),
        b: r.bottom - (parseFloat(s.borderBottomWidth) || 0),
      };
    }
    clipMemo.set(el, box);
    return box;
  }
  var peNone = null;
  function coveredByPointerEventsNone(x, y, parent) {
    if (peNone === null) {
      peNone = [];
      C.forEachElementDeep(doc, function (el) {
        if (win.getComputedStyle(el).pointerEvents === "none") peNone.push(el);
      });
    }
    for (var i = 0; i < peNone.length; i++) {
      var el = peNone[i];
      if (el === parent || el.contains(parent)) continue;
      var rects = el.getClientRects();
      for (var j = 0; j < rects.length; j++) {
        var r = rects[j];
        if (r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
      }
    }
    return false;
  }
  function noPseudoBox(el) {
    var b = win.getComputedStyle(el, "::before").content;
    var a = win.getComputedStyle(el, "::after").content;
    return (b === "none" || b === "normal") && (a === "none" || a === "normal");
  }
  var range = doc.createRange();
  function geometryOk(textNode, parent) {
    if (!noPseudoBox(parent)) return false;
    range.selectNodeContents(textNode);
    var rects = range.getClientRects();
    var clippers = [];
    for (var el = parent; el !== null && el.nodeType === 1; el = el.parentElement) {
      var box = clipBox(el);
      if (box !== null) clippers.push(box);
    }
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      var l = Math.max(r.left, 0);
      var t = Math.max(r.top, 0);
      var rr = Math.min(r.right, vw);
      var bb = Math.min(r.bottom, vh);
      for (var k = 0; k < clippers.length; k++) {
        var c = clippers[k];
        l = Math.max(l, c.l);
        t = Math.max(t, c.t);
        rr = Math.min(rr, c.r);
        bb = Math.min(bb, c.b);
      }
      if (rr - l < 4 || bb - t < 4) continue;
      var x = (l + rr) / 2;
      var y = (t + bb) / 2;
      if (doc.elementFromPoint(x, y) !== parent) continue;
      if (coveredByPointerEventsNone(x, y, parent)) continue;
      return true;
    }
    return false;
  }

  // A text node with an editable ancestor, or inside a field, is a field's
  // value under the record: never a witness, and its text never reaches a
  // snippet (Q60). Editable: a contenteditable attribute whose value is not
  // false (any case), or designMode "on" in this document. Open shadow hosts
  // are never entered, so the walk below stays in one tree.
  function editableAttr(el) {
    var v = C.namedAttributeAnyCase(el, "contenteditable");
    return v !== null && v.trim().toLowerCase() !== "false";
  }
  function fieldElement(el) {
    return C.isHtml(el) && (el.localName === "input" || el.localName === "textarea" || el.localName === "select");
  }
  var designMode = String(doc.designMode).toLowerCase() === "on";
  var found = 0;
  function test(textNode, parent) {
    stats.textNodes++;
    if (!LETTERS.test(textNode.data)) {
      stats.notTwoLetters++;
      return;
    }
    if (!fontOk(parent)) {
      stats.font++;
      return;
    }
    if (!paintOk(parent)) {
      stats.paint++;
      return;
    }
    if (!contrastOk(parent)) {
      stats.contrast++;
      return;
    }
    if (!geometryOk(textNode, parent)) {
      stats.geometry++;
      return;
    }
    found++;
    if (found > arg.skip) {
      nodes.push(textNode);
      items.push({
        locator: C.locator(parent),
        snippet: C.openTag(parent) + C.clip(textNode.data.replace(/\s+/g, " ").trim(), 160),
      });
    }
  }
  function visit(el, editable) {
    editable = editable || editableAttr(el) || fieldElement(el);
    for (var ch = el.firstChild; ch !== null; ch = ch.nextSibling) {
      if (ch.nodeType === 3 || ch.nodeType === 4) {
        if (editable) {
          stats.editable++;
          continue;
        }
        test(ch, el);
        if (nodes.length >= arg.limit) return true;
      } else if (ch.nodeType === 1) {
        if (C.isHtml(ch) && ALLOWED.has(ch.localName) && !excluded(ch)) {
          if (visit(ch, editable)) return true;
        } else stats.elementsNotEntered++;
      }
    }
    return false;
  }
  var startEditable = designMode;
  for (var up = body.parentElement; up !== null; up = up.parentElement) if (editableAttr(up)) startEditable = true;
  result.data.done = !visit(body, startEditable);
  if (typeof range.detach === "function") range.detach();
  return result;
}
