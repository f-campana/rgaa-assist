// custom/8-2-id-duplicate: the id values of the top-level document tree.
// Elements in the HTML, SVG or MathML namespace with an attribute in no
// namespace whose local name is id and whose value holds a character other
// than ASCII whitespace. Template contents, shadow trees and framed documents
// are not part of the document tree, so getElementsByTagName leaves them out.
function (C) {
  "use strict";
  var doc = document;
  if (doc.doctype === null) return { doctype: false, elements: 0, collected: 0, pair: null, duplicatedValues: 0 };
  var all = doc.getElementsByTagName("*");
  var seen = new Map();
  var collected = 0;
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var ns = el.namespaceURI;
    if (ns !== C.XHTML && ns !== C.SVG && ns !== C.MATHML) continue;
    if (!el.hasAttributeNS(null, "id")) continue;
    var v = el.getAttributeNS(null, "id");
    if (!/[^\t\n\f\r ]/.test(v)) continue;
    collected++;
    var rec = seen.get(v);
    if (rec === undefined) seen.set(v, [i]);
    else if (rec.length < 2) rec.push(i);
  }
  // The first pair in tree order: the earliest element that shares its value
  // with a later one, paired with the first later element holding that value.
  var best = null;
  var duplicated = 0;
  seen.forEach(function (rec, value) {
    if (rec.length < 2) return;
    duplicated++;
    if (best === null || rec[0] < best.rec[0]) best = { value: value, rec: rec };
  });
  var pair = null;
  if (best !== null) {
    var a = all[best.rec[0]];
    var b = all[best.rec[1]];
    pair = {
      value: best.value,
      first: { locator: C.locator(a), snippet: C.openTag(a) },
      second: { locator: C.locator(b), snippet: C.openTag(b) },
    };
  }
  return { doctype: true, elements: all.length, collected: collected, pair: pair, duplicatedValues: duplicated };
}
