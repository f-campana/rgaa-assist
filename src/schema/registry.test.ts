import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registry } from "../../tests/fixtures/schema-fixtures.ts";
import { CheckRegistrySchema } from "./registry.ts";

const valid = (x: unknown) => CheckRegistrySchema.safeParse(x).success;

describe("check registry", () => {
  it("accepts checks that exist and checks still to be built", () => {
    expect(valid(registry())).toBe(true);
  });

  it("requires the kind to equal the id's prefix", () => {
    const r = registry();
    r.checks[0]!.kind = "custom";
    expect(valid(r)).toBe(false);
  });

  it("refuses duplicate ids, bad ids and a record without what it examines", () => {
    const r = registry();
    r.checks.push({ ...r.checks[0]! });
    expect(valid(r)).toBe(false);
    expect(valid({ schemaVersion: 1, checks: [{ id: "object-alt", kind: "axe", examines: "x", exists: true }] })).toBe(false);
    expect(valid({ schemaVersion: 1, checks: [{ id: "axe/object-alt", kind: "axe", examines: "", exists: true }] })).toBe(false);
  });

  it("the RGAA 4.1.2 registry file is valid", () => {
    const file = join(import.meta.dirname, "..", "rulesets", "rgaa-4.1.2", "checks.json");
    expect(valid(JSON.parse(readFileSync(file, "utf8")))).toBe(true);
  });
});
