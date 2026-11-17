import { describe, expect, it } from "vitest";
import { entry116, entry116Full, registry } from "../../tests/fixtures/schema-fixtures.ts";
import { CheckRegistrySchema } from "./registry.ts";
import { CoverageEntrySchema, entryFilePath, isResolving, validateEntry } from "./coverage.ts";

const reg = CheckRegistrySchema.parse(registry());

function issues(input: unknown): string[] {
  const r = CoverageEntrySchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe("coverage entry: shape", () => {
  it("accepts the 1.1.6 fixture and its full variant", () => {
    expect(issues(entry116())).toEqual([]);
    expect(issues(entry116Full())).toEqual([]);
    expect(validateEntry(entry116(), reg).ok).toBe(true);
    expect(validateEntry(entry116Full(), reg).ok).toBe(true);
  });

  it("rejects an entry with no requirement", () => {
    const e = entry116();
    e.requirements = [];
    e.links = [];
    expect(issues(e).join()).toMatch(/at least one requirement/);
  });

  it("rejects an entry whose rationale has no citation", () => {
    const e = entry116();
    e.rationale.citations = [];
    expect(issues(e).join()).toMatch(/citation/);
  });

  it("rejects a requirement, a route or an exception without a citation", () => {
    const a = entry116();
    a.requirements[0].citations = [];
    expect(issues(a)).not.toEqual([]);
    const b = entry116();
    b.requirements[0].routes[1].citations = [];
    expect(issues(b)).not.toEqual([]);
    const c = entry116();
    c.requirements[0].exceptions = [{ id: "captcha", statement: "x", citations: [] }];
    expect(issues(c)).not.toEqual([]);
  });

  it("rejects an unknown field, an unknown prerequisite and a bad citation source", () => {
    expect(issues({ ...entry116(), confidence: 0.9 })).not.toEqual([]);
    expect(issues({ ...entry116(), needs: ["mouse"] })).not.toEqual([]);
    const e = entry116();
    e.rationale.citations[0].source = "criterion_title";
    expect(issues(e)).not.toEqual([]);
  });

  it("rejects an empty quote", () => {
    const e = entry116();
    e.rationale.citations[0].quote = "   ";
    expect(issues(e)).not.toEqual([]);
  });
});

describe("coverage entry: structural rules", () => {
  it("enabled is never above candidate", () => {
    const e = entry116();
    e.enabled = "fail_only";
    expect(issues(e).join()).toMatch(/enabled \(fail_only\) is above candidate \(none\)/);
    const f = entry116Full();
    f.enabled = "full";
    expect(issues(f)).toEqual([]);
    f.enabled = "fail_only";
    expect(issues(f)).toEqual([]);
  });

  it("every link names a requirement that exists", () => {
    const e = entry116();
    e.links[0].requirement = "nope";
    expect(issues(e).join()).toMatch(/no requirement with id nope/);
  });

  it("a link's routes are routes or exceptions of its own requirement", () => {
    const e = entry116();
    e.requirements.push({
      id: "second",
      statement: "s",
      citations: e.requirements[0].citations,
      routes: [{ id: "other-route", statement: "s", citations: e.requirements[0].citations }],
      exceptions: [],
    });
    e.links[0].routes = ["other-route"];
    expect(issues(e).join()).toMatch(/other-route is not a route or exception of requirement object-alternative/);
    e.links[0].routes = ["text-alternative-and-role", "text-alternative-and-role"];
    expect(issues(e).join()).toMatch(/route named twice/);
  });

  it("an exception id is accepted in a link's routes", () => {
    const e = entry116();
    e.requirements[0].exceptions = [{ id: "decorative", statement: "s", citations: e.requirements[0].citations }];
    e.links[0].routes = ["text-alternative-and-role", "decorative"];
    expect(issues(e)).toEqual([]);
  });

  it("faultMeans failure only when routes list every route and every exception", () => {
    const e = entry116();
    e.links[0].faultMeans = "failure";
    expect(issues(e).join()).toMatch(/faultMeans failure/);

    const f = entry116Full();
    expect(issues(f)).toEqual([]);
    f.requirements[0].exceptions = [{ id: "captcha", statement: "s", citations: f.requirements[0].citations }];
    // The custom link now misses the exception: failure is refused, and it is no longer resolving.
    const msgs = issues(f).join("\n");
    expect(msgs).toMatch(/faultMeans failure/);
    expect(msgs).toMatch(/candidate full needs a resolving link/);
    f.links[1].routes.push("captcha");
    expect(issues(f)).toEqual([]);
  });

  it("faultMeans failure does not need scope whole", () => {
    const f = entry116Full();
    f.links[1].scope = "partial";
    f.candidate = "fail_only";
    expect(issues(f)).toEqual([]);
  });

  it("candidate full only when every requirement has a resolving link", () => {
    const e = entry116();
    e.candidate = "full";
    expect(issues(e).join()).toMatch(/candidate full needs a resolving link for requirement object-alternative/);
    const f = entry116Full();
    f.links[1].scope = "partial";
    expect(issues(f).join()).toMatch(/candidate full needs a resolving link/);
  });

  it("candidate fail_only only when a link has faultMeans failure", () => {
    const e = entry116();
    e.candidate = "fail_only";
    expect(issues(e).join()).toMatch(/candidate fail_only needs at least one link with faultMeans failure/);
    const f = entry116Full();
    f.candidate = "fail_only";
    expect(issues(f)).toEqual([]);
  });

  it("ids are unique across requirements, routes and exceptions", () => {
    const e = entry116();
    e.requirements[0].routes[1].id = "text-alternative-and-role";
    expect(issues(e).join()).toMatch(/id used twice/);
  });

  it("a check speaks to a requirement through one link only", () => {
    const e = entry116();
    e.links.push({ ...e.links[0] });
    expect(issues(e).join()).toMatch(/two links for the same check and requirement/);
  });

  it("refuses a link to a model-judged check", () => {
    const e = entry116();
    e.links[0].check = "model/object-alt";
    expect(issues(e).join()).toMatch(/model-judged check cannot be linked/);
  });

  it("refuses duplicate prerequisites", () => {
    const e = entry116();
    e.needs = ["state", "state"];
    expect(issues(e).join()).toMatch(/duplicate prerequisite/);
  });

  it("accepts the three applicability values and nothing else", () => {
    for (const a of ["structural", "judgment", "always"]) {
      const e = entry116Full();
      e.applicability = a;
      expect(issues(e)).toEqual([]);
    }
    const e = entry116();
    e.applicability = "never";
    expect(issues(e)).not.toEqual([]);
  });
});

describe("isResolving", () => {
  const full = CoverageEntrySchema.parse(entry116Full());

  it("is true only with every route and exception and scope whole", () => {
    const [axe, custom] = full.links;
    expect(isResolving(full, axe!)).toBe(false);
    expect(isResolving(full, custom!)).toBe(true);
    expect(isResolving(full, { ...custom!, scope: "partial" })).toBe(false);
    expect(isResolving(full, { ...custom!, routes: ["adjacent-link", "replace-mechanism"] })).toBe(false);
    expect(isResolving(full, { ...custom!, requirement: "missing" })).toBe(false);
  });
});

describe("validateEntry with the registry", () => {
  it("rejects a link whose check is not registered", () => {
    const e = entry116();
    e.links[0].check = "axe/not-registered";
    expect(issues(e)).toEqual([]);
    const v = validateEntry(e, reg);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.issues).toEqual([{ path: ["links", 0, "check"], message: "check axe/not-registered is not in the check registry" }]);
  });

  it("reports the structural issues too", () => {
    const e = entry116();
    e.enabled = "full";
    const v = validateEntry(e, reg);
    expect(v.ok).toBe(false);
  });
});

describe("entryFilePath", () => {
  it("puts an entry in its two-digit theme folder", () => {
    expect(entryFilePath("1.1.6")).toBe("coverage/01/1.1.6.json");
    expect(entryFilePath("13.12.3")).toBe("coverage/13/13.12.3.json");
  });
});
