import { describe, expect, it } from "vitest";
import type { AxeResults, NodeResult, Result } from "axe-core";
import { locatorOf, mapRule, testedFrameCount, untestedFramesOf } from "../../../src/checks/axe/map.ts";

const node = (html: string, target: NodeResult["target"] = ["img"]): NodeResult => ({ html, target, any: [], all: [], none: [] });
const result = (id: string, nodes: NodeResult[]): Result => ({ id, description: "", help: "", helpUrl: "", tags: [], nodes });
const results = (p: Partial<Pick<AxeResults, "violations" | "incomplete" | "passes" | "inapplicable">>): AxeResults =>
  ({ violations: [], incomplete: [], passes: [], inapplicable: [], ...p }) as unknown as AxeResults;
const OPTS = { passLocatorCap: 3 };

describe("locatorOf", () => {
  it("joins frame hops with ' >>> ' and shadow hops with ' >> '", () => {
    expect(locatorOf(["img"])).toBe("img");
    expect(locatorOf(["iframe#a", "iframe#b", "img"])).toBe("iframe#a >>> iframe#b >>> img");
    expect(locatorOf(["iframe#a", ["#host", "img"]])).toBe("iframe#a >>> #host >> img");
  });
});

describe("mapRule", () => {
  it("says check_error 'rule not reported' when no list holds the rule", () => {
    const r = mapRule("axe/image-alt", "image-alt", results({ passes: [result("list", [node("<ul>")])] }), [], 0, OPTS);
    expect(r).toMatchObject({ outcome: "error", kind: "check_error" });
    expect(r.outcome === "error" && r.message).toContain("rule not reported");
  });

  it("a violation wins over passes, and keeps incomplete nodes of the same rule as extra evidence", () => {
    const r = mapRule(
      "axe/image-alt",
      "image-alt",
      results({
        violations: [result("image-alt", [node("<img>")])],
        incomplete: [result("image-alt", [node("<img src=x>", ["#x"])])],
        passes: [result("image-alt", [node("<img alt=a>", ["#p"])])],
      }),
      [],
      0,
      OPTS,
    );
    expect(r.outcome).toBe("fault");
    if (r.outcome === "error") return;
    expect(r.evidence.map((e) => e.locator)).toEqual(["img", "#x"]);
  });

  it("an incomplete node with no violation is cannot_tell", () => {
    const r = mapRule("axe/image-alt", "image-alt", results({ incomplete: [result("image-alt", [node("<img>")])], passes: [result("image-alt", [node("<img alt=a>")])] }), [], 0, OPTS);
    expect(r.outcome).toBe("cannot_tell");
  });

  it("a gap turns no_fault and inapplicable into cannot_tell, never a fault", () => {
    const gap = [{ locator: "iframe", snippet: "<iframe>", reason: "no result" }];
    const pass = mapRule("axe/image-alt", "image-alt", results({ passes: [result("image-alt", [node("<img alt=a>")])] }), gap, 0, OPTS);
    const none = mapRule("axe/image-alt", "image-alt", results({ inapplicable: [result("image-alt", [])] }), gap, 0, OPTS);
    const bad = mapRule("axe/image-alt", "image-alt", results({ violations: [result("image-alt", [node("<img>")])] }), gap, 0, OPTS);
    expect(pass.outcome).toBe("cannot_tell");
    expect(none.outcome).toBe("cannot_tell");
    expect(bad.outcome).toBe("fault");
    for (const r of [pass, none, bad]) {
      if (r.outcome !== "error") expect(r.evidence.some((e) => e.locator === "iframe" && e.note?.includes("Frame not analysed"))).toBe(true);
    }
  });
});

describe("frame-tested as scope probe", () => {
  it("undecided frame nodes are gaps, decided ones count as tested", () => {
    const r = results({
      incomplete: [result("frame-tested", [node("<iframe id=a>", ["#a"])])],
      passes: [result("frame-tested", [node("<iframe id=b>", ["#b"]), node("<iframe id=c>", ["#c"])])],
    });
    expect(untestedFramesOf(r).map((g) => g.locator)).toEqual(["#a"]);
    expect(testedFrameCount(r)).toBe(2);
  });
});
