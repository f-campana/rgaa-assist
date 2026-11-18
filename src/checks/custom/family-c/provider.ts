/**
 * The provider of family C (tree): one reading of the target (`read.ts`)
 * serves the four checks. A check whose derivation throws gets
 * `check_error` alone; the others keep their results.
 */
import type { CheckDefinition, CheckProvider, CheckRunResult, CheckResult } from "../../types.ts";
import type { CheckId } from "../../../schema/index.ts";
import * as frameTitle from "../2-1-frame-title-attribute/index.ts";
import * as linkName from "../6-2-link-content-name/index.ts";
import * as fieldLabel from "../11-1-field-label-mechanism/index.ts";
import * as optgroupLabel from "../11-8-optgroup-label-attribute/index.ts";
import { readPage } from "./read.ts";
import type { PageRead } from "./read.ts";

const CHECKS: readonly { definition: CheckDefinition; derive: (read: PageRead, options: Readonly<Record<string, unknown>>) => CheckResult }[] = [
  frameTitle,
  linkName,
  fieldLabel,
  optgroupLabel,
];

export const familyCProvider: CheckProvider = {
  name: "custom/family-c",
  checks: CHECKS.map((c) => c.definition),
  async run(ctx) {
    const read = await readPage(ctx);
    const out = new Map<CheckId, CheckRunResult>();
    for (const c of CHECKS) {
      const options = ctx.options.get(c.definition.id) ?? c.definition.defaultOptions;
      try {
        out.set(c.definition.id, c.derive(read, options));
      } catch (e) {
        out.set(c.definition.id, { outcome: "error", kind: "check_error", message: e instanceof Error ? e.message : String(e) });
      }
    }
    return out;
  },
};
