/**
 * The check registry: one record per check id. Links in coverage entries
 * refer to ids here. A check may be registered before it exists, so an entry
 * can name a check that is still to be built.
 *
 * Checks belong to no ruleset (spec 5.1). The registry file sits beside the
 * ruleset's `coverage/` folder (`src/rulesets/rgaa-4.1.2/checks.json`) because
 * it lists the checks that ruleset's links name.
 */
import { z } from "zod";
import { CheckIdSchema, CheckKindSchema, TextSchema, checkKindOf, duplicates } from "./common.ts";

export const CheckRecordSchema = z
  .strictObject({
    /** `<kind>/<name>`. For an axe check, `<name>` is the axe rule id: `axe/object-alt`. */
    id: CheckIdSchema,
    /** `axe`, `custom` or `model`. Must equal the prefix of `id`. */
    kind: CheckKindSchema,
    /**
     * What the check must examine: the elements, the routes and exceptions,
     * the scope. For a check that does not exist yet this is its specification,
     * and a later builder implements it from this text.
     */
    examines: TextSchema,
    /** Whether the check is implemented in this repository. */
    exists: z.boolean(),
  })
  .refine((c) => checkKindOf(c.id) === c.kind, { message: "kind must equal the prefix of the check id", path: ["kind"] });
export type CheckRecord = z.infer<typeof CheckRecordSchema>;

export const CheckRegistrySchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    checks: z.array(CheckRecordSchema),
  })
  .superRefine((reg, ctx) => {
    for (const id of duplicates(reg.checks.map((c) => c.id))) {
      ctx.addIssue({ code: "custom", path: ["checks"], message: `duplicate check id: ${id}` });
    }
  });
export type CheckRegistry = z.infer<typeof CheckRegistrySchema>;
