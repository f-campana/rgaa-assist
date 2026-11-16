import { describe, expect, it } from "vitest";
import { htmlTextForm, markdownTextForm, normaliseForQuote, quoteMatches } from "./quote.ts";

describe("verbatim quotes", () => {
  it("collapses every whitespace run, no-break spaces included, and trims", () => {
    expect(normaliseForQuote("  a :\n\t b c ")).toBe("a : b c");
  });

  it("compares in NFC", () => {
    expect(quoteMatches("é", "le état")).toBe(true);
  });

  it("changes nothing else: apostrophes, case and punctuation must match", () => {
    expect(quoteMatches("l’élément", "L’élément est")).toBe(false);
    expect(quoteMatches("L'élément", "L’élément est")).toBe(false);
    expect(quoteMatches("L’élément est", "L’élément est")).toBe(true);
    expect(quoteMatches("élément est.", "L’élément est")).toBe(false);
  });

  it("never matches an empty quote", () => {
    expect(quoteMatches("  ", "anything")).toBe(false);
  });

  it("has a plain-text form for Markdown links and for glossary HTML", () => {
    expect(markdownTextForm("Chaque [image objet](#image-objet) (balise `<object>`)")).toBe("Chaque image objet (balise `<object>`)");
    expect(htmlTextForm("<p>une balise <code>&lt;object&gt;</code> &quot;x&quot; &amp;lt;</p> ")).toBe('une balise <object> "x" &lt; ');
  });
});
