// A framed document, for the frame clauses of 8.5.1 and 8.3.1: its document
// type and root attributes, whether a title child of its head qualifies, and
// whether it holds a text node with a non-whitespace character that is
// rendered (has a client rectangle), or one that is not.
// arg: { blank: number[] } (code points of the blank-looking characters)
function (C, arg) {
  "use strict";
  var doc = document;
  var out = C.docInfo(doc);
  out.headTitleQualifies = false;
  var head = doc.head;
  if (head !== null) {
    for (var i = 0; i < head.children.length; i++) {
      var t = head.children[i];
      if (C.isHtml(t, "title") && C.qualifies(t.textContent, arg.blank)) {
        out.headTitleQualifies = true;
        break;
      }
    }
  }
  out.renderedText = false;
  out.unrenderedText = false;
  out.textNodes = 0;
  var range = doc.createRange();
  function scan(root) {
    var walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
    var n;
    while ((n = walker.nextNode()) !== null) {
      if (!/\S/u.test(n.data)) continue;
      out.textNodes++;
      range.selectNodeContents(n);
      if (range.getClientRects().length > 0) {
        out.renderedText = true;
        return true;
      }
      out.unrenderedText = true;
    }
    return false;
  }
  // RECORD: the records speak of a text node the framed document holds; text
  // in the open shadow trees of that document is counted too (it may be
  // rendered or exposed). That is wider than the document tree, and can only
  // make the check abstain where the record would give no_fault.
  var roots = [doc];
  C.forEachElementDeep(doc, function (el) {
    if (el.shadowRoot) roots.push(el.shadowRoot);
  });
  for (var r = 0; r < roots.length; r++) if (scan(roots[r])) break;
  if (typeof range.detach === "function") range.detach();
  return out;
}
