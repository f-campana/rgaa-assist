// custom/8-5-page-title-present: the top-level document's title elements.
// A title element is an element in the HTML namespace whose local name is
// title (an SVG or MathML title is not one).
// arg: { blank: number[] } (code points of the blank-looking characters)
function (C, arg) {
  "use strict";
  var doc = document;
  var root = doc.documentElement;
  var out = {
    xmlViewer: C.isXmlViewer(doc),
    contentType: doc.contentType,
    rootIsHtmlHtml: C.isHtml(root, "html"),
    inTree: 0,
    inTemplate: 0,
    inShadow: 0,
    noscriptWithTitle: 0,
    first: null,
    headLocator: null,
    headSnippet: null,
  };
  var titles = doc.getElementsByTagNameNS(C.XHTML, "title");
  out.inTree = titles.length;

  function noscriptHasTitle(el) {
    return C.isHtml(el, "noscript") && C.asciiLower(el.textContent).indexOf("<title") >= 0;
  }
  // Document tree: noscript text. Then template contents and open shadow
  // trees, wherever they are (nested in each other too).
  function walk(rootNode, where) {
    var els = rootNode.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (where === "template" && C.isHtml(el, "title")) out.inTemplate++;
      if (where === "shadow" && C.isHtml(el, "title")) out.inShadow++;
      if (noscriptHasTitle(el)) out.noscriptWithTitle++;
      if (C.isHtml(el, "template") && el.content) walk(el.content, "template");
      if (el.shadowRoot) walk(el.shadowRoot, where === "template" ? "template" : "shadow");
    }
  }
  walk(doc, "tree");

  var head = doc.head;
  if (head !== null) {
    out.headLocator = C.locator(head);
    out.headSnippet = C.openTag(head);
  }
  if (titles.length > 0) {
    var t = titles[0];
    var textContent = t.textContent;
    out.first = {
      childOfHead: head !== null && t.parentNode === head,
      qualifies: C.qualifies(textContent, arg.blank),
      text: C.clip(textContent, 200),
      locator: C.locator(t),
      snippet: C.guardEditable(t, C.openTag(t) + C.clip(textContent, 200)),
    };
  }
  return out;
}
