import { describe, expect, it } from "vitest";
import { specSample } from "../../tests/fixtures/schema-fixtures.ts";
import { SampleFileSchema, stepAction } from "./sample.ts";

function issues(input: unknown): string[] {
  const r = SampleFileSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

function minimal(): Record<string, any> {
  return { project: { name: "Site", ruleset: "rgaa-4.1.2" }, pages: [{ id: "home", url: "https://example.com/", kinds: ["home"] }] };
}

describe("sample file", () => {
  it("accepts the example of spec section 7", () => {
    expect(issues(specSample())).toEqual([]);
  });

  it("applies the defaults of 7.1", () => {
    const s = SampleFileSchema.parse(minimal());
    expect(s.project.regime).toBe("to_confirm");
    expect(s.project.reportLanguage).toBe("en");
    expect(s.model).toEqual({ enabled: false, allowAuthenticated: false });
    expect(s.pages[0]!.authenticated).toBe(false);
    expect(s.pages[0]!.states).toEqual([]);
  });

  it("is invalid with no pages", () => {
    expect(issues({ ...minimal(), pages: [] }).join()).toMatch(/no pages/);
  });

  it("is invalid with a page marked authenticated and no session.storageState", () => {
    const s = specSample();
    delete s.session;
    expect(issues(s).join()).toMatch(/needs session.storageState/);
    s.session = {};
    expect(issues(s).join()).toMatch(/needs session.storageState/);
  });

  it("is invalid with a page marked authenticated and no expect", () => {
    const s = specSample();
    delete s.pages[1].expect;
    expect(issues(s).join()).toMatch(/authenticated needs `expect`/);
  });

  it("is invalid with a declared state that has no expect", () => {
    const s = specSample();
    delete s.pages[0].states[0].expect;
    expect(issues(s)).not.toEqual([]);
  });

  it("is invalid with an empty expect", () => {
    const s = specSample();
    s.pages[0].states[0].expect = {};
    expect(issues(s).join()).toMatch(/visible`, `url` or both/);
  });

  it("reserves the state id initial", () => {
    const s = specSample();
    s.pages[0].states[0].id = "initial";
    expect(issues(s).join()).toMatch(/cannot be declared/);
  });

  it("is invalid with a declared state that has no steps", () => {
    const s = specSample();
    s.pages[0].states[0].steps = [];
    expect(issues(s).join()).toMatch(/at least one step/);
  });

  it("accepts the five step actions and no other", () => {
    const s = specSample();
    s.pages[0].states[0].steps = [
      { navigate: "https://example.com/a" },
      { click: "role=button[name='Menu']" },
      { fill: { locator: "role=textbox[name='Search']", value: "x" } },
      { press: { key: "Enter" } },
      { press: { key: "Tab", locator: "role=textbox[name='Search']" } },
      { setViewport: { width: 375, height: 812 } },
    ];
    const parsed = SampleFileSchema.parse(s);
    expect(parsed.pages[0]!.states[0]!.steps.map(stepAction)).toEqual(["navigate", "click", "fill", "press", "press", "setViewport"]);

    for (const bad of [{ hover: "x" }, { waitFor: "x" }, { click: "a", press: { key: "b" } }, { login: {} }, {}]) {
      const t = specSample();
      t.pages[0].states[0].steps = [bad];
      expect(issues(t)).not.toEqual([]);
    }
  });

  it("is invalid with model.enabled and no provider or model", () => {
    expect(issues({ ...minimal(), model: { enabled: true } }).join()).toMatch(/provider and a model id/);
    expect(issues({ ...minimal(), model: { enabled: true, provider: "anthropic", model: "m" } })).toEqual([]);
  });

  it("is invalid with duplicate page, state, service or process ids", () => {
    const s = specSample();
    s.pages[3].id = "signup-1";
    expect(issues(s).join()).toMatch(/duplicate page id/);
    const t = specSample();
    t.pages[0].states.push({ ...t.pages[0].states[0] });
    expect(issues(t).join()).toMatch(/duplicate state id/);
    const u = specSample();
    u.services.push({ id: "account", name: "x" });
    expect(issues(u).join()).toMatch(/duplicate service id/);
  });

  it("refuses ids with a slash, unknown kinds and unknown fields", () => {
    const s = specSample();
    s.pages[0].id = "a/b";
    expect(issues(s)).not.toEqual([]);
    const t = specSample();
    t.pages[0].kinds = ["landing"];
    expect(issues(t)).not.toEqual([]);
    expect(issues({ ...minimal(), crawl: true })).not.toEqual([]);
  });

  it("does not treat the warnings of 7.5 as errors", () => {
    const s = specSample();
    s.absentKinds = [];
    s.processes[0].steps.push("signup-3");
    s.services.push({ id: "search", name: "Search" });
    s.pages.push({ id: "orphan", url: "https://example.com/o", kinds: ["process_step"] });
    expect(issues(s)).toEqual([]);
  });
});
