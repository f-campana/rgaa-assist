import { describe, expect, it } from "vitest";
import { JSON_SCHEMA_NAMES, jsonSchema } from "./json-schema.ts";

describe("JSON Schemas", () => {
  for (const name of JSON_SCHEMA_NAMES) {
    it(`generates the ${name} schema`, () => {
      const s = jsonSchema(name);
      expect(s.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      // A corpus case is a union of two object shapes.
      expect(s.type === "object" || Array.isArray(s.oneOf)).toBe(true);
    });
  }

  it("lets a sample omit fields that have defaults, and requires pages", () => {
    const s = jsonSchema("sample") as { required: string[]; properties: { pages: { minItems: number } } };
    expect(s.required).toEqual(["project", "pages"]);
    expect(s.properties.pages.minItems).toBe(1);
  });

  it("keeps the eight fields of a coverage entry and nothing else", () => {
    const s = jsonSchema("coverage-entry") as { properties: Record<string, unknown>; additionalProperties: boolean };
    expect(Object.keys(s.properties).sort()).toEqual(
      ["applicability", "candidate", "enabled", "links", "needs", "rationale", "requirements", "test"].sort(),
    );
    expect(s.additionalProperties).toBe(false);
  });
});
