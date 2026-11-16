import { describe, expect, it } from "vitest";
import { entry116 } from "../../../tests/fixtures/schema-fixtures.ts";
import { CoverageEntrySchema } from "../../schema/index.ts";
import type { Citation } from "../../schema/index.ts";
import { checkCitation, checkEntryCitations } from "./citations.ts";
import { loadOfficialData } from "./official-data.ts";

const official = loadOfficialData();
const check = (c: Citation) => checkCitation(official, c);

describe("citations against the official text", () => {
  it("finds every quote of the 1.1.6 fixture verbatim", () => {
    expect(checkEntryCitations(official, CoverageEntrySchema.parse(entry116()))).toEqual([]);
  });

  it("matches a test line as stored or in plain-text form, and checks the line number", () => {
    expect(check({ source: "test", test: "1.1.6", line: 3, quote: "[lien ou bouton adjacent](#lien-ou-bouton-adjacent)" })).toBeNull();
    expect(check({ source: "test", test: "1.1.6", line: 3, quote: "suivi d’un lien ou bouton adjacent permettant" })).toBeNull();
    expect(check({ source: "test", test: "1.1.6", line: 2, quote: "suivi d’un lien ou bouton adjacent" })).toMatch(/not found verbatim/);
    expect(check({ source: "test", test: "1.1.6", line: 5, quote: "x" })).toMatch(/has no line 5/);
    expect(check({ source: "test", test: "1.1.99", quote: "x" })).toMatch(/no test/);
  });

  it("lets a quote without a line span the test's lines", () => {
    expect(check({ source: "test", test: "1.1.6", quote: "une de ces conditions ? La balise `<object>`" })).toBeNull();
  });

  it("refuses a quote with a different apostrophe or a paraphrase", () => {
    expect(check({ source: "test", test: "1.1.6", line: 4, quote: "Un mécanisme permet à l'utilisateur" })).toMatch(/not found/);
    expect(check({ source: "test", test: "1.1.6", line: 4, quote: "A mechanism lets the user replace the object" })).toMatch(/not found/);
  });

  it("reads particular cases and technical notes, list items included", () => {
    expect(check({ source: "particular_cases", criterion: "1.3", quote: "le critère est non applicable." })).toBeNull();
    expect(check({ source: "particular_cases", criterion: "3.2", quote: "Le texte ou l’image de texte est purement décoratif ;" })).toBeNull();
    expect(check({ source: "technical_note", criterion: "1.2", quote: "Dans ce cas le critère 1.2 est non applicable." })).toBeNull();
    expect(check({ source: "technical_note", criterion: "1.1", quote: "x" })).toMatch(/has no technical_note/);
  });

  it("reads a glossary body as HTML or as text, by exact title", () => {
    expect(check({ source: "glossary", entry: "Image objet", quote: "balise <code>&lt;object&gt;</code>" })).toBeNull();
    expect(check({ source: "glossary", entry: "Image objet", quote: "balise <object>." })).toBeNull();
    expect(check({ source: "glossary", entry: "image objet", quote: "Image" })).toMatch(/no glossary entry/);
  });

  it("reads a criterion title as stored or in plain-text form", () => {
    expect(check({ source: "criterion_title", criterion: "1.1", quote: "[image porteuse d’information](#image-porteuse-d-information)" })).toBeNull();
    expect(check({ source: "criterion_title", criterion: "1.1", quote: "Chaque image porteuse d’information a-t-elle une alternative textuelle ?" })).toBeNull();
    expect(check({ source: "criterion_title", criterion: "1.1", quote: "Chaque image porteuse d'information" })).toMatch(/not found verbatim in title of criterion 1.1/);
    expect(check({ source: "criterion_title", criterion: "99.9", quote: "x" })).toMatch(/no criterion/);
  });

  it("reads a methodology", () => {
    expect(check({ source: "methodology", test: "1.1.6", quote: "Vérifier que l’élément `<object>` est pourvu d’un attribut WAI-ARIA `role=\"img\"` ;" })).toBeNull();
  });

  it("reports each bad citation of an entry with its path", () => {
    const e = entry116();
    e.requirements[0].routes[2].citations[0].quote = "Un mécanisme permet à l'utilisateur";
    const problems = checkEntryCitations(official, CoverageEntrySchema.parse(e));
    expect(problems).toHaveLength(1);
    expect(problems[0]!.path).toEqual(["requirements", 0, "routes", 2, "citations", 0]);
  });
});
