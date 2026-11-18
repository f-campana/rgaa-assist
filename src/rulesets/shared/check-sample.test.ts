import { describe, expect, it } from "vitest";
import { SampleFileSchema, SampleWarningSchema } from "../../schema/index.ts";
import type { SampleFile } from "../../schema/index.ts";
import { checkSample } from "./check-sample.ts";

type PageIn = { id: string; kinds: string[]; service?: string };

function sample(pages: PageIn[], extra: Record<string, unknown> = {}): SampleFile {
  return SampleFileSchema.parse({
    project: { name: "x", ruleset: "rgaa-4.1.2" },
    pages: pages.map((p) => ({ url: `https://example.test/${p.id}`, ...p })),
    ...extra,
  });
}

const ALL_FIXED = ["home", "contact", "legal_notice", "accessibility_statement", "sitemap", "help", "authentication"];

describe("checkSample (spec 7.5)", () => {
  it("returns no warning for a sample that declares every fixed kind and enough random pages", () => {
    const pages: PageIn[] = ALL_FIXED.map((k) => ({ id: k, kinds: [k] }));
    pages.push({ id: "r1", kinds: ["random"] });
    expect(checkSample(sample(pages))).toEqual([]);
  });

  it("warns for each fixed kind neither present nor listed absent, in FIXED_PAGE_KINDS order", () => {
    const w = checkSample(sample([{ id: "home", kinds: ["home"] }], { absentKinds: ["sitemap", "help"] }));
    expect(w.filter((x) => x.code === "fixed_kind_missing")).toEqual([
      { code: "fixed_kind_missing", kind: "contact" },
      { code: "fixed_kind_missing", kind: "legal_notice" },
      { code: "fixed_kind_missing", kind: "accessibility_statement" },
      { code: "fixed_kind_missing", kind: "authentication" },
    ]);
  });

  it("warns for a declared service with no page", () => {
    const w = checkSample(
      sample([{ id: "c", kinds: ["contact"], service: "contact-request" }], {
        services: [
          { id: "contact-request", name: "Send a message" },
          { id: "account", name: "Manage my account" },
        ],
      }),
    );
    expect(w.filter((x) => x.code === "service_without_page")).toEqual([{ code: "service_without_page", service: "account" }]);
  });

  it("warns for process steps not in pages and process_step pages in no process, in order", () => {
    const w = checkSample(
      sample(
        [
          { id: "signup-1", kinds: ["process_step"] },
          { id: "orphan-b", kinds: ["process_step"] },
          { id: "orphan-a", kinds: ["process_step", "service"] },
        ],
        {
          processes: [
            { id: "signup", name: "Sign up", steps: ["signup-1", "signup-2", "signup-3"] },
            { id: "order", name: "Order", steps: ["cart"] },
          ],
        },
      ),
    );
    expect(w.filter((x) => x.code === "process_step_not_in_pages")).toEqual([
      { code: "process_step_not_in_pages", process: "signup", step: "signup-2" },
      { code: "process_step_not_in_pages", process: "signup", step: "signup-3" },
      { code: "process_step_not_in_pages", process: "order", step: "cart" },
    ]);
    expect(w.filter((x) => x.code === "process_step_without_process")).toEqual([
      { code: "process_step_without_process", page: "orphan-b" },
      { code: "process_step_without_process", page: "orphan-a" },
    ]);
  });

  it("requires random pages at 10% of the other pages, rounded up; a page is random only when random is its only kind", () => {
    const eleven: PageIn[] = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, kinds: ["distinct_template"] }));
    // 11 other pages: 2 random pages required. One page is random and distinct_template: it is not random.
    const w = checkSample(
      sample([...eleven, { id: "r1", kinds: ["random"] }, { id: "mixed", kinds: ["random", "distinct_template"] }], {
        absentKinds: ALL_FIXED,
      }),
    );
    expect(w).toEqual([{ code: "too_few_random_pages", randomPages: 1, otherPages: 12, required: 2 }]);
  });

  it("requires one random page as soon as there is one other page", () => {
    const w = checkSample(sample([{ id: "home", kinds: ["home"] }], { absentKinds: ALL_FIXED.slice(1) }));
    expect(w).toEqual([{ code: "too_few_random_pages", randomPages: 0, otherPages: 1, required: 1 }]);
  });

  it("puts warnings in the documented order, each valid against SampleWarningSchema", () => {
    const w = checkSample(
      sample([{ id: "s", kinds: ["process_step"] }], {
        services: [{ id: "svc", name: "Service" }],
        processes: [{ id: "p", name: "P", steps: ["missing"] }],
      }),
    );
    const codes = w.map((x) => x.code);
    const order = ["fixed_kind_missing", "service_without_page", "process_step_not_in_pages", "process_step_without_process", "too_few_random_pages"];
    expect([...codes].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(codes);
    expect(new Set(codes)).toEqual(new Set(order));
    for (const x of w) expect(SampleWarningSchema.safeParse(x).success).toBe(true);
  });
});
