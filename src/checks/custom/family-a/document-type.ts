/**
 * Document types and the language indication they require, as the record of
 * `custom/8-3-default-lang-present` defines them; `custom/8-4-default-lang-code-valid`
 * uses the same definitions.
 */

/** What `page/common.js` `docInfo` returns about the root element. */
export interface RootInfo {
  isHtmlHtml: boolean;
  /** `getAttributeNS(null, "lang")`. */
  lang: string | null;
  /** The attribute in no namespace named `xml:lang` (how text/html documents hold it). */
  xmlLangNamed: string | null;
  /** `getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang")`. */
  xmlLangNs: string | null;
  /** A lang or xml:lang attribute in any form (any namespace, any case, any value). */
  anyLangForm: boolean;
  snippet: string;
}

/** What `page/common.js` `docInfo` returns about a document. */
export interface DocInfo {
  /** The document is the page Chromium's XML viewer builds around an XML resource, not the resource itself. */
  xmlViewer: boolean;
  contentType: string;
  hasDoctype: boolean;
  publicId: string | null;
  root: RootInfo | null;
}

export type DocumentType = "html" | "xhtml-1.0-text/html" | "xhtml-1.0-application/xhtml+xml" | "xhtml-1.1" | "other-xml";

export type LangAttribute = "lang" | "xml:lang";

/**
 * XHTML 1.1 when the doctype public identifier contains "XHTML 1.1"; XHTML
 * 1.0 when it contains "XHTML 1.0", split by the served content type; other
 * XML when it contains "XHTML" otherwise or the document is served as
 * application/xhtml+xml without one of those doctypes; otherwise HTML.
 */
export function documentType(doc: Pick<DocInfo, "publicId" | "contentType">): DocumentType {
  const id = doc.publicId ?? "";
  if (id.includes("XHTML 1.1")) return "xhtml-1.1";
  if (id.includes("XHTML 1.0")) {
    if (doc.contentType === "text/html") return "xhtml-1.0-text/html";
    if (doc.contentType === "application/xhtml+xml") return "xhtml-1.0-application/xhtml+xml";
    // RECORD: the record splits XHTML 1.0 by content type into text/html and
    // application/xhtml+xml only. An XHTML 1.0 doctype served with another
    // content type (application/xml, text/xml) is classed as "other XML",
    // which requires both attributes: the strictest reading, so that it never
    // gives no_fault on an attribute another reading would require.
    return "other-xml";
  }
  if (id.includes("XHTML")) return "other-xml";
  if (doc.contentType === "application/xhtml+xml") return "other-xml";
  return "html";
}

export function requiredAttributes(type: DocumentType): readonly LangAttribute[] {
  switch (type) {
    case "html":
      return ["lang"];
    case "xhtml-1.0-text/html":
      return ["lang", "xml:lang"];
    case "xhtml-1.0-application/xhtml+xml":
      return ["xml:lang"];
    case "xhtml-1.1":
      return ["xml:lang"];
    case "other-xml":
      return ["lang", "xml:lang"];
  }
}

/**
 * The value of a required attribute on the root element: xml:lang is read as
 * the attribute named xml:lang in text/html documents and with
 * getAttributeNS(XML namespace, "lang") in XML documents.
 */
export function attributeValue(doc: DocInfo, name: LangAttribute): string | null {
  const root = doc.root;
  if (root === null || !root.isHtmlHtml) return null;
  if (name === "lang") return root.lang;
  return doc.contentType === "text/html" ? root.xmlLangNamed : root.xmlLangNs;
}

/** Every required attribute is present with a value holding a non-whitespace character. */
export function carriesIndication(doc: DocInfo): boolean {
  if (doc.root === null || !doc.root.isHtmlHtml) return false;
  return requiredAttributes(documentType(doc)).every((name) => {
    const v = attributeValue(doc, name);
    return v !== null && /\S/u.test(v);
  });
}

export function describeType(type: DocumentType): string {
  switch (type) {
    case "html":
      return "HTML";
    case "xhtml-1.0-text/html":
      return "XHTML 1.0 served as text/html";
    case "xhtml-1.0-application/xhtml+xml":
      return "XHTML 1.0 served as application/xhtml+xml";
    case "xhtml-1.1":
      return "XHTML 1.1";
    case "other-xml":
      return "other XML";
  }
}
