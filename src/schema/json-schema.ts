/**
 * JSON Schemas generated from the Zod schemas (spec 13: defined once, used
 * for both validation and types).
 *
 * A JSON Schema describes shape only. The cross-field rules (refinements) are
 * enforced when parsing with the Zod schema, and only there. The sample file
 * schema is generated for input (defaults optional), the others for output.
 */
import { z } from "zod";
import { ApprovalLogSchema } from "./approvals.ts";
import { CorpusCaseSchema } from "./corpus.ts";
import { CoverageEntrySchema } from "./coverage.ts";
import { EvaluationSummarySchema } from "./evaluation.ts";
import { CheckRegistrySchema } from "./registry.ts";
import { RunFileSchema } from "./run.ts";
import { SampleFileSchema } from "./sample.ts";

export const JSON_SCHEMA_NAMES = [
  "sample",
  "run",
  "coverage-entry",
  "check-registry",
  "approval-log",
  "evaluation-summary",
  "corpus-case",
] as const;
export type JsonSchemaName = (typeof JSON_SCHEMA_NAMES)[number];

/** The JSON Schema (draft 2020-12) for one file kind. */
export function jsonSchema(name: JsonSchemaName): Record<string, unknown> {
  switch (name) {
    case "sample":
      return z.toJSONSchema(SampleFileSchema, { io: "input" });
    case "run":
      return z.toJSONSchema(RunFileSchema);
    case "coverage-entry":
      return z.toJSONSchema(CoverageEntrySchema);
    case "check-registry":
      return z.toJSONSchema(CheckRegistrySchema);
    case "approval-log":
      return z.toJSONSchema(ApprovalLogSchema);
    case "evaluation-summary":
      return z.toJSONSchema(EvaluationSummarySchema);
    case "corpus-case":
      return z.toJSONSchema(CorpusCaseSchema);
  }
}
