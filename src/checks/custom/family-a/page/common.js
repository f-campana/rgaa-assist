// Helpers shared by the family A page scripts. Evaluated in the page, in the
// frame being examined, as the first argument of each script (see page.ts).
// Plain JavaScript: the repository's TypeScript configuration has no DOM
// library. Read only: nothing here changes the page or leaves a global.
(function () {
  "use strict";
  var XHTML = "http://www.w3.org/1999/xhtml";
  var SVG = "http://www.w3.org/2000/svg";
  var MATHML = "http://www.w3.org/1998/Math/MathML";
  var XML_NS = "http://www.w3.org/XML/1998/namespace";

  function asciiLower(s) {
    return String(s).replace(/[A-Z]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) + 32);
    });
  }

  function isHtml(node, localName) {
    return (
      node !== null &&
      node !== undefined &&
      node.nodeType === 1 &&
      node.namespaceURI === XHTML &&
      (localName === undefined || node.localName === localName)
    );
  }

  function clip(s, max) {
    s = String(s);
    return s.length > max ? s.slice(0, max) + "…" : s;
  }

  function escapeAttr(v) {
    return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  /** The element's opening tag, rebuilt from its attributes. */
  function openTag(el) {
    var name = el.nodeName;
    if (el.namespaceURI === XHTML && el.ownerDocument.contentType === "text/html") name = asciiLower(name);
    var out = "<" + name;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      out += " " + a.name + '="' + clip(escapeAttr(a.value), 120) + '"';
    }
    return out + ">";
  }

  function cssIdent(s) {
    if (typeof CSS !== "undefined" && CSS && typeof CSS.escape === "function") return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, function (c) {
      return "\\" + c.charCodeAt(0).toString(16) + " ";
    });
  }

  /**
   * A CSS selector a human can paste into the browser's tools: from the
   * nearest ancestor whose id is unique in its tree, or from the root, with
   * :nth-of-type where siblings share the element's name.
   */
  function locator(el) {
    var parts = [];
    var node = el;
    var root = el.getRootNode();
    while (node !== null && node.nodeType === 1) {
      var id = node.getAttribute("id");
      if (id !== null && /[^\t\n\f\r ]/.test(id) && root.querySelectorAll) {
        var sel = "#" + cssIdent(id);
        var same = null;
        try {
          same = root.querySelectorAll(sel);
        } catch (e) {
          same = null;
        }
        if (same !== null && same.length === 1 && same[0] === node) {
          parts.unshift(sel);
          break;
        }
      }
      var name = node.localName;
      var parent = node.parentNode;
      var part = cssIdent(name);
      if (parent !== null && parent.children) {
        var index = 0;
        var count = 0;
        for (var i = 0; i < parent.children.length; i++) {
          var sib = parent.children[i];
          if (sib.localName === name && sib.namespaceURI === node.namespaceURI) {
            count++;
            if (sib === node) index = count;
          }
        }
        if (count > 1) part += ":nth-of-type(" + index + ")";
      }
      parts.unshift(part);
      if (parent === null || parent.nodeType !== 1) break;
      node = parent;
    }
    return parts.join(" > ");
  }

  /** An attribute named lang or xml:lang in any form: any namespace, any case. */
  function isLangAttribute(a) {
    return asciiLower(a.localName) === "lang" || asciiLower(a.name) === "xml:lang";
  }

  function hasLangInAnyForm(el) {
    for (var i = 0; i < el.attributes.length; i++) if (isLangAttribute(el.attributes[i])) return true;
    return false;
  }

  /** The value of the attribute in no namespace named exactly `name`, or null. */
  function namedAttribute(el, name) {
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.namespaceURI === null && a.name === name) return a.value;
    }
    return null;
  }

  /**
   * Chromium shows an XML document that has no style information (and is not
   * XHTML) in its own viewer: an XHTML page it builds around the source, with
   * this element holding the original tree.
   */
  function isXmlViewer(doc) {
    var el = doc.getElementById("webkit-xml-viewer-source-xml");
    return el !== null && isHtml(el, "div");
  }

  /** What the family needs to know about a document and its root element. */
  function docInfo(doc) {
    var root = doc.documentElement;
    var info = {
      xmlViewer: isXmlViewer(doc),
      contentType: doc.contentType,
      hasDoctype: doc.doctype !== null,
      publicId: doc.doctype !== null ? doc.doctype.publicId : null,
      root: null,
    };
    if (root !== null) {
      info.root = {
        isHtmlHtml: isHtml(root, "html"),
        lang: root.getAttributeNS(null, "lang"),
        xmlLangNamed: namedAttribute(root, "xml:lang"),
        xmlLangNs: root.getAttributeNS(XML_NS, "lang"),
        anyLangForm: hasLangInAnyForm(root),
        snippet: openTag(root),
      };
    }
    return info;
  }

  /** True when the text holds a character of general category L or N that is not in `blank` (code points). */
  function qualifies(text, blank) {
    var chars = Array.from(String(text));
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      if (/[\p{L}\p{N}]/u.test(c) && blank.indexOf(c.codePointAt(0)) < 0) return true;
    }
    return false;
  }

  /** Every element of a tree root (document or fragment), then of its open shadow trees, recursively. */
  function forEachElementDeep(root, visit) {
    var els = root.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      visit(el);
      if (el.shadowRoot) forEachElementDeep(el.shadowRoot, visit);
    }
  }

  return {
    XHTML: XHTML,
    SVG: SVG,
    MATHML: MATHML,
    XML_NS: XML_NS,
    asciiLower: asciiLower,
    isHtml: isHtml,
    clip: clip,
    openTag: openTag,
    locator: locator,
    isLangAttribute: isLangAttribute,
    hasLangInAnyForm: hasLangInAnyForm,
    docInfo: docInfo,
    isXmlViewer: isXmlViewer,
    qualifies: qualifies,
    forEachElementDeep: forEachElementDeep,
  };
})()
