/**
 * The coverage entry (spec 6.1, 6.2): one per test, the tool's claim about
 * what it can and cannot conclude for that test.
 *
 * Structural rules are enforced in one place, `entryStructureIssues`, which
 * the schema runs as a refinement. `validateEntry` adds the one rule that
 * needs the check registry. See `docs/m1/contract-notes.md`.
 */
import { z } from "zod";
import {
  CheckIdSchema,
  CriterionIdSchema,
  LevelSchema,
  LocalIdSchema,
  PrerequisiteSchema,
  TestIdSchema,
  TextSchema,
  checkKindOf,
  duplicates,
  levelRank,
} from "./common.ts";
import type { CheckRegistry } from "./registry.ts";

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

/**
 * A verbatim excerpt of the official RGAA text.
 *
 * "Verbatim" is defined by `quoteMatches` in `src/rulesets/shared/quote.ts`
 * and in the notes: after Unicode NFC and collapsing every run of whitespace
 * to one space, the quote is a substring of the cited source text.
 */
export const QuoteSchema = TextSchema;

/** One or more lines of a test, as in `criteres.json`. Line 1 is the question, then each condition. */
export const TestCitationSchema = z.strictObject({
  source: z.literal("test"),
  test: TestIdSchema,
  /** 1-based line of the test. When absent, the quote may come from any line, or span lines. */
  line: z.int().positive().optional(),
  quote: QuoteSchema,
});

/** The `particularCases` of a criterion. */
export const ParticularCasesCitationSchema = z.strictObject({
  source: z.literal("particular_cases"),
  criterion: CriterionIdSchema,
  quote: QuoteSchema,
});

/** The `technicalNote` of a criterion. */
export const TechnicalNoteCitationSchema = z.strictObject({
  source: z.literal("technical_note"),
  criterion: CriterionIdSchema,
  quote: QuoteSchema,
});

/** A glossary entry, named by its exact title in `glossaire.json`. */
export const GlossaryCitationSchema = z.strictObject({
  source: z.literal("glossary"),
  entry: TextSchema,
  quote: QuoteSchema,
});

/** The methodology of a test, in `methodologies.json`. */
export const MethodologyCitationSchema = z.strictObject({
  source: z.literal("methodology"),
  test: TestIdSchema,
  quote: QuoteSchema,
});

/** The title of a criterion, in `criteres.json`. */
export const CriterionTitleCitationSchema = z.strictObject({
  source: z.literal("criterion_title"),
  criterion: CriterionIdSchema,
  quote: QuoteSchema,
});

export const CitationSchema = z.discriminatedUnion("source", [
  TestCitationSchema,
  ParticularCasesCitationSchema,
  TechnicalNoteCitationSchema,
  GlossaryCitationSchema,
  MethodologyCitationSchema,
  CriterionTitleCitationSchema,
]);
export type Citation = z.infer<typeof CitationSchema>;

const CitationsSchema = z.array(CitationSchema).min(1, "at least one citation of the official text");

/** The argument in prose, plus the official words it rests on. */
export const RationaleSchema = z.strictObject({
  text: TextSchema,
  citations: CitationsSchema,
});
export type Rationale = z.infer<typeof RationaleSchema>;

// ---------------------------------------------------------------------------
// Requirements, routes, exceptions
// ---------------------------------------------------------------------------

/**
 * A route (one accepted way to meet a requirement) or an exception (a case
 * where the requirement does not have to be met). Its `id` is stable inside
 * the entry and unique across all requirements, routes and exceptions of it.
 */
export const AlternativeSchema = z.strictObject({
  id: LocalIdSchema,
  /** Short statement in English. */
  statement: TextSchema,
  citations: CitationsSchema,
});
export type Route = z.infer<typeof AlternativeSchema>;
export type Exception = z.infer<typeof AlternativeSchema>;

/**
 * One thing the test demands. It holds for an element when any one of its
 * routes holds, or one of its exceptions applies (6.1).
 */
export const RequirementSchema = z.strictObject({
  id: LocalIdSchema,
  statement: TextSchema,
  citations: CitationsSchema,
  routes: z.array(AlternativeSchema).min(1, "a requirement has at least one route"),
  /** May be empty. */
  exceptions: z.array(AlternativeSchema),
});
export type Requirement = z.infer<typeof RequirementSchema>;

// ---------------------------------------------------------------------------
// Links (6.2)
// ---------------------------------------------------------------------------

export const LinkScopeSchema = z.enum(["whole", "partial"]);
export const FaultMeansSchema = z.enum(["failure", "evidence_only"]);

/**
 * What one check's outcome means for one requirement of one test. The pair
 * (`check`, `requirement`) is unique inside an entry.
 */
export const LinkSchema = z.strictObject({
  /** An id in the check registry. */
  check: CheckIdSchema,
  /** Id of a requirement of this entry. */
  requirement: LocalIdSchema,
  /** Ids of the routes and exceptions of that requirement that the check examines. */
  routes: z.array(LocalIdSchema).min(1),
  /** `whole` when the check examines every element the requirement applies to. */
  scope: LinkScopeSchema,
  /** `failure` only when `routes` lists every route and exception of the requirement. */
  faultMeans: FaultMeansSchema,
});
export type Link = z.infer<typeof LinkSchema>;

// ---------------------------------------------------------------------------
// The entry (6.1)
// ---------------------------------------------------------------------------

const CoverageEntryShape = z.strictObject({
  test: TestIdSchema,
  requirements: z.array(RequirementSchema).min(1, "an entry has at least one requirement"),
  links: z.array(LinkSchema),
  /** What the entry argues the tool could conclude. */
  candidate: LevelSchema,
  /** What the tool is allowed to conclude today. Never above `candidate`. Outside the entry hash. */
  enabled: LevelSchema,
  /**
   * `structural` when "not applicable" follows from the absence of certain elements in the whole examined scope.
   * `always` when the test applies to every page, so "not applicable" is never the answer; a check that answers
   * `inapplicable` for such a test leads to "needs review" (Q40). Otherwise `judgment`.
   */
  applicability: z.enum(["structural", "judgment", "always"]),
  needs: z.array(PrerequisiteSchema),
  rationale: RationaleSchema,
});

/** A shape-valid entry, before the structural rules. */
export type CoverageEntryShape = z.infer<typeof CoverageEntryShape>;

/**
 * Whether a link is resolving (6.2): its `routes` name every route and every
 * exception of its requirement, and its scope is `whole`. Derived, never stored.
 *
 * Returns false when the link's requirement is not in the entry.
 */
export function isResolving(entry: Pick<CoverageEntryShape, "requirements">, link: Link): boolean {
  if (link.scope !== "whole") return false;
  return coversEveryAlternative(entry, link);
}

/** Whether the link's `routes` name every route and exception of its requirement. */
export function coversEveryAlternative(entry: Pick<CoverageEntryShape, "requirements">, link: Link): boolean {
  const req = entry.requirements.find((r) => r.id === link.requirement);
  if (req === undefined) return false;
  const named = new Set(link.routes);
  return [...req.routes, ...req.exceptions].every((a) => named.has(a.id));
}

/** One problem found in an entry, with the path of the offending field. */
export interface EntryIssue {
  path: (string | number)[];
  message: string;
}

/**
 * The structural rules of an entry that need nothing but the entry. Returns
 * every problem found; an empty list means the entry is structurally valid.
 *
 * 1. Ids of requirements, routes and exceptions are unique across the entry.
 * 2. `needs` has no duplicate.
 * 3. `enabled` is never above `candidate`.
 * 4. Every link names a requirement that exists, and its `routes` are ids of
 *    that requirement's routes or exceptions, without duplicates.
 * 5. The pair (`check`, `requirement`) is unique among links.
 * 6. `faultMeans: failure` only when the link's `routes` list every route and
 *    every exception of the requirement.
 * 7. No link names a `model/` check: derivation is deterministic and model
 *    output never changes a status (spec 2.7, 8.3, 9).
 * 8. `candidate: full` only when every requirement has a resolving link.
 * 9. `candidate: fail_only` only when at least one link has `faultMeans: failure`.
 *
 * "At least one requirement" and "at least one citation" are enforced by the
 * schema shape itself.
 */
export function entryStructureIssues(entry: CoverageEntryShape): EntryIssue[] {
  const issues: EntryIssue[] = [];

  const ids: string[] = [];
  for (const r of entry.requirements) {
    ids.push(r.id, ...r.routes.map((a) => a.id), ...r.exceptions.map((a) => a.id));
  }
  for (const id of duplicates(ids)) {
    issues.push({ path: ["requirements"], message: `id used twice in the entry: ${id}` });
  }
  for (const n of duplicates(entry.needs)) {
    issues.push({ path: ["needs"], message: `duplicate prerequisite: ${n}` });
  }

  if (levelRank(entry.enabled) > levelRank(entry.candidate)) {
    issues.push({ path: ["enabled"], message: `enabled (${entry.enabled}) is above candidate (${entry.candidate})` });
  }

  const pairs = entry.links.map((l) => `${l.check} -> ${l.requirement}`);
  for (const p of duplicates(pairs)) {
    issues.push({ path: ["links"], message: `two links for the same check and requirement: ${p}` });
  }

  entry.links.forEach((link, i) => {
    const req = entry.requirements.find((r) => r.id === link.requirement);
    if (req === undefined) {
      issues.push({ path: ["links", i, "requirement"], message: `no requirement with id ${link.requirement}` });
      return;
    }
    const allowed = new Set([...req.routes, ...req.exceptions].map((a) => a.id));
    link.routes.forEach((id, j) => {
      if (!allowed.has(id)) {
        issues.push({
          path: ["links", i, "routes", j],
          message: `${id} is not a route or exception of requirement ${req.id}`,
        });
      }
    });
    for (const id of duplicates(link.routes)) {
      issues.push({ path: ["links", i, "routes"], message: `route named twice: ${id}` });
    }
    if (link.faultMeans === "failure" && !coversEveryAlternative(entry, link)) {
      issues.push({
        path: ["links", i, "faultMeans"],
        message: "faultMeans failure needs routes to list every route and exception of the requirement (6.2)",
      });
    }
    if (checkKindOf(link.check) === "model") {
      issues.push({
        path: ["links", i, "check"],
        message: "a model-judged check cannot be linked: model output never changes a status (2.7, 9)",
      });
    }
  });

  if (entry.candidate === "full") {
    entry.requirements.forEach((req, i) => {
      const resolved = entry.links.some((l) => l.requirement === req.id && isResolving(entry, l));
      if (!resolved) {
        issues.push({
          path: ["requirements", i],
          message: `candidate full needs a resolving link for requirement ${req.id}`,
        });
      }
    });
  }
  if (entry.candidate === "fail_only" && !entry.links.some((l) => l.faultMeans === "failure")) {
    issues.push({ path: ["candidate"], message: "candidate fail_only needs at least one link with faultMeans failure" });
  }

  return issues;
}

/**
 * A coverage entry. Parsing it enforces the shape and every rule of
 * `entryStructureIssues`. The registry rule is in `validateEntry`.
 *
 * The file for test `t` is `src/rulesets/<ruleset>/coverage/<theme>/<t>.json`,
 * where `<theme>` is the first segment of `t`, two digits (`coverage/01/1.1.6.json`).
 */
export const CoverageEntrySchema = CoverageEntryShape.superRefine((entry, ctx) => {
  for (const issue of entryStructureIssues(entry)) {
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
});
export type CoverageEntry = z.infer<typeof CoverageEntrySchema>;

/** The result of `validateEntry`. */
export type EntryValidation = { ok: true; entry: CoverageEntry } | { ok: false; issues: EntryIssue[] };

/**
 * Validate an entry completely: its shape, every structural rule, and that
 * every link's check id exists in the registry.
 */
export function validateEntry(input: unknown, registry: CheckRegistry): EntryValidation {
  const parsed = CoverageEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.filter((p): p is string | number => typeof p !== "symbol"),
        message: i.message,
      })),
    };
  }
  const known = new Set(registry.checks.map((c) => c.id));
  const issues: EntryIssue[] = [];
  parsed.data.links.forEach((link, i) => {
    if (!known.has(link.check)) {
      issues.push({ path: ["links", i, "check"], message: `check ${link.check} is not in the check registry` });
    }
  });
  return issues.length === 0 ? { ok: true, entry: parsed.data } : { ok: false, issues };
}

/** The relative path of the entry file for a test, inside the ruleset folder: `coverage/01/1.1.6.json`. */
export function entryFilePath(test: string): string {
  const theme = test.split(".")[0] ?? "";
  return `coverage/${theme.padStart(2, "0")}/${test}.json`;
}
