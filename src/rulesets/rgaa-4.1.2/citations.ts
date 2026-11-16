/**
 * Checking citations against the vendored official text (spec 6.5).
 *
 * The text a citation is checked against, by `source`:
 * - `test`: the test's lines in `criteres.json`. With `line`, that line only;
 *   without it, the lines joined with "\n".
 * - `particular_cases`, `technical_note`: the criterion's blocks, each list
 *   item on its own, all joined with "\n".
 * - `glossary`: the body of the entry with that exact title.
 * - `methodology`: the test's methodology.
 *
 * Each text is offered in two forms: as stored, and its plain-text form
 * (`markdownTextForm` for criteres and methodologies, `htmlTextForm` for the
 * glossary). A quote is verbatim when `quoteMatches` holds for either form.
 */
import type { Citation, CoverageEntry } from "../../schema/index.ts";
import type { OfficialBlock, OfficialData } from "../contract.ts";
import { htmlTextForm, markdownTextForm, quoteMatches } from "../shared/quote.ts";

function blocksText(blocks: readonly OfficialBlock[]): string {
  return blocks.flatMap((b) => (typeof b === "string" ? [b] : b.ul)).join("\n");
}

/**
 * The forms of the official text a citation points to, or an error message
 * when the citation points to nothing (unknown test, line, criterion or
 * glossary title, or a criterion without that block).
 */
export function citationSourceForms(official: OfficialData, c: Citation): { ok: true; forms: string[] } | { ok: false; error: string } {
  switch (c.source) {
    case "test": {
      const t = official.tests.get(c.test);
      if (t === undefined) return { ok: false, error: `no test ${c.test}` };
      let text: string;
      if (c.line !== undefined) {
        const line = t.lines[c.line - 1];
        if (line === undefined) return { ok: false, error: `test ${c.test} has no line ${c.line}` };
        text = line;
      } else {
        text = t.lines.join("\n");
      }
      return { ok: true, forms: [text, markdownTextForm(text)] };
    }
    case "particular_cases":
    case "technical_note": {
      const cr = official.criteria.get(c.criterion);
      if (cr === undefined) return { ok: false, error: `no criterion ${c.criterion}` };
      const blocks = c.source === "particular_cases" ? cr.particularCases : cr.technicalNote;
      if (blocks.length === 0) return { ok: false, error: `criterion ${c.criterion} has no ${c.source}` };
      const text = blocksText(blocks);
      return { ok: true, forms: [text, markdownTextForm(text)] };
    }
    case "glossary": {
      const g = official.glossary.get(c.entry);
      if (g === undefined) return { ok: false, error: `no glossary entry titled ${JSON.stringify(c.entry)}` };
      return { ok: true, forms: [g.body, htmlTextForm(g.body)] };
    }
    case "methodology": {
      const t = official.tests.get(c.test);
      if (t === undefined) return { ok: false, error: `no test ${c.test}` };
      return { ok: true, forms: [t.methodology, markdownTextForm(t.methodology)] };
    }
  }
}

/** Whether a citation's quote is a verbatim excerpt of the text it points to. Returns the problem when not. */
export function checkCitation(official: OfficialData, c: Citation): string | null {
  const src = citationSourceForms(official, c);
  if (!src.ok) return src.error;
  return src.forms.some((f) => quoteMatches(c.quote, f)) ? null : `quote not found verbatim in ${describe(c)}: ${JSON.stringify(c.quote)}`;
}

function describe(c: Citation): string {
  switch (c.source) {
    case "test":
      return c.line === undefined ? `test ${c.test}` : `test ${c.test} line ${c.line}`;
    case "particular_cases":
      return `particular cases of ${c.criterion}`;
    case "technical_note":
      return `technical note of ${c.criterion}`;
    case "glossary":
      return `glossary entry ${JSON.stringify(c.entry)}`;
    case "methodology":
      return `methodology of ${c.test}`;
  }
}

/** Every citation of an entry, with its path: rationale, requirements, routes, exceptions. */
export function entryCitations(entry: CoverageEntry): { path: (string | number)[]; citation: Citation }[] {
  const out: { path: (string | number)[]; citation: Citation }[] = [];
  entry.rationale.citations.forEach((citation, i) => out.push({ path: ["rationale", "citations", i], citation }));
  entry.requirements.forEach((r, ri) => {
    r.citations.forEach((citation, i) => out.push({ path: ["requirements", ri, "citations", i], citation }));
    r.routes.forEach((a, ai) =>
      a.citations.forEach((citation, i) => out.push({ path: ["requirements", ri, "routes", ai, "citations", i], citation })),
    );
    r.exceptions.forEach((a, ai) =>
      a.citations.forEach((citation, i) =>
        out.push({ path: ["requirements", ri, "exceptions", ai, "citations", i], citation }),
      ),
    );
  });
  return out;
}

/** Check every citation of an entry. Empty when all are verbatim. */
export function checkEntryCitations(official: OfficialData, entry: CoverageEntry): { path: (string | number)[]; message: string }[] {
  const problems: { path: (string | number)[]; message: string }[] = [];
  for (const { path, citation } of entryCitations(entry)) {
    const p = checkCitation(official, citation);
    if (p !== null) problems.push({ path, message: p });
  }
  return problems;
}
