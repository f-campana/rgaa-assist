/**
 * What "verbatim" means for a citation's quote (see `docs/m1/contract-notes.md`).
 *
 * A quote matches a source text when, after normalising both, the quote is a
 * substring of the source. Normalising is exactly:
 * 1. Unicode NFC;
 * 2. every maximal run of whitespace (JavaScript `\s`, which includes the
 *    no-break spaces U+00A0 and U+202F, tabs and newlines) becomes one U+0020;
 * 3. leading and trailing spaces are removed.
 * Nothing else changes: not quotes or apostrophes (’ and ' differ), not case,
 * not punctuation, not Markdown or HTML.
 *
 * A ruleset may offer a source in several forms (for RGAA 4.1.2, as stored and
 * as plain text: see `citationSourceForms`); the quote matches when it
 * matches any of them.
 */
export function normaliseForQuote(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

/** Whether `quote` is a verbatim excerpt of `source`, as defined above. An empty quote never matches. */
export function quoteMatches(quote: string, source: string): boolean {
  const q = normaliseForQuote(quote);
  return q.length > 0 && normaliseForQuote(source).includes(q);
}

/**
 * The plain-text form of a Markdown source from `criteres.json` or
 * `methodologies.json`: each link `[label](target)` becomes `label`. Nothing
 * else changes (backticks and `**` stay).
 */
export function markdownTextForm(text: string): string {
  return text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

/**
 * The plain-text form of an HTML source from `glossaire.json`: every tag
 * `<...>` is removed (replaced by nothing), then the entities `&lt;`, `&gt;`,
 * `&quot;`, `&#39;` and `&amp;` are decoded, `&amp;` last.
 */
export function htmlTextForm(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
