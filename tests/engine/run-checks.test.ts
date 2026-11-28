import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import type { CheckContext, CheckProvider, CheckRunResult } from "../../src/checks/types.ts";
import { launchBrowser } from "../../src/engine/browser.ts";
import { EngineBugError, runProvider, runProviders, validateProviders } from "../../src/engine/run-checks.ts";
import { MASK, createSanitiser } from "../../src/engine/sanitise.ts";
import { withTarget } from "../../src/engine/testing/index.ts";
import type { ExaminableTarget } from "../../src/engine/target.ts";
import { ObservationSchema } from "../../src/schema/index.ts";
import type { CheckId } from "../../src/schema/index.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

const PAGE = { "index.html": '<!doctype html><html lang="fr"><title>Page</title><form><input id="nom" value="Jean"></form>' };
const sanitiser = createSanitiser();
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwbGFudGVkIn0.c2lnbmF0dXJlLXBsYW50ZWQ";

function provider(name: string, ids: string[], run: (ctx: CheckContext) => Promise<ReadonlyMap<CheckId, CheckRunResult>>): CheckProvider {
  return { name, checks: ids.map((id) => ({ id, version: "1.0.0", defaultOptions: { limit: 5, mode: "a" } })), run };
}

/** Run one provider on the fixture page, as the engine does. */
async function onPage<T>(fn: (target: ExaminableTarget) => Promise<T>): Promise<T> {
  return withTarget(PAGE, async (_ctx, info) => fn(info.target), { browser });
}

describe("running providers", () => {
  it("turns results into sanitised, numbered, validated observations with effective options", async () => {
    const p = provider("custom/test", ["custom/test-a", "custom/test-b"], async (ctx) => {
      const snippet = await ctx.page.locator("#nom").evaluate((el) => el.outerHTML);
      return new Map<CheckId, CheckRunResult>([
        [
          "custom/test-a",
          {
            outcome: "fault",
            evidence: [
              { kind: "dom_node", locator: "#nom", snippet, note: `see ${ctx.page.url()}?token=planted` },
              { kind: "text", note: `state ${JWT}` },
            ],
            fingerprint: "custom/test-a:id=nom",
          },
        ],
        ["custom/test-b", { outcome: "no_fault", evidence: [{ kind: "scope_examined", note: "1 element examined" }], fingerprint: "custom/test-b:no_fault" }],
      ]);
    });
    const obs = await onPage((t) => runProvider(t, p, { timeoutMs: 5_000, sanitiser, runOptions: { "custom/test-a": { limit: 9 } } }));
    expect(obs.map((o) => o.id)).toEqual(["fixture/initial:custom/test-a", "fixture/initial:custom/test-b"]);
    for (const o of obs) expect(ObservationSchema.safeParse(o).success).toBe(true);
    const [a, b] = obs;
    expect(a?.options).toEqual({ limit: 9, mode: "a" });
    expect(b?.options).toEqual({ limit: 5, mode: "a" });
    expect(a?.checkVersion).toBe("1.0.0");
    expect(a?.evidence.map((e) => e.id)).toEqual(["e001", "e002"]);
    expect(a?.evidence[0]?.snippet).toBe(`<input id="nom" value="${MASK}">`);
    expect(a?.evidence[0]?.note).toMatch(/^see http:\/\/127\.0\.0\.1:\d+\/index\.html\?token=\[redacted\]$/);
    expect(a?.evidence[0]?.redactions).toBe(2);
    expect(a?.evidence[1]).toEqual({ id: "e002", kind: "text", note: `state ${MASK}`, redactions: 1 });
    expect(b?.evidence[0]?.redactions).toBe(0);
    expect(a?.fingerprint).toBe("custom/test-a:id=nom");
  });

  it("records a CheckFailure as an error observation with its kind and a sanitised message", async () => {
    const p = provider("custom/fail", ["custom/fail-a", "custom/fail-b"], async () =>
      new Map<CheckId, CheckRunResult>([
        ["custom/fail-a", { outcome: "error", kind: "scope_unreadable", message: "frame https://x.test/?k=planted could not be read" }],
        ["custom/fail-b", { outcome: "error", kind: "check_error", message: "" }],
      ]),
    );
    const [a, b] = await onPage((t) => runProvider(t, p, { timeoutMs: 5_000, sanitiser }));
    expect(a).toMatchObject({
      outcome: "error",
      evidence: [],
      fingerprint: "custom/fail-a:error",
      error: { kind: "scope_unreadable", message: "the evaluation in the page failed" },
    });
    expect(b?.error).toEqual({ kind: "check_error", message: "the evaluation in the page failed" });
  });

  it("keeps a declared check message, sanitised", async () => {
    const p = provider("custom/declared", ["custom/declared-a"], async () =>
      new Map<CheckId, CheckRunResult>([
        ["custom/declared-a", { outcome: "error", kind: "check_error", message: "rule not reported: custom/declared-a", declared: true }],
      ]),
    );
    const [a] = await onPage((t) => runProvider(t, p, { timeoutMs: 5_000, sanitiser }));
    expect(a?.error).toEqual({ kind: "check_error", message: "rule not reported: custom/declared-a" });
  });

  it("does not let a page-thrown message from a patched method reach error.message", async () => {
    const p = provider("custom/patched", ["custom/patched-a", "custom/patched-b"], async (ctx) => {
      await ctx.page.evaluate(() => {
        const proto = (globalThis as unknown as { Element: { prototype: { getAttribute: () => never } } }).Element.prototype;
        proto.getAttribute = () => {
          throw new Error("zzMARKER-patched https://x.test/?k=zzMARKER");
        };
      });
      let message = "";
      try {
        await ctx.page.locator("#nom").evaluate((el) => el.getAttribute("id"));
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      }
      expect(message).toContain("zzMARKER");
      return new Map<CheckId, CheckRunResult>([
        ["custom/patched-a", { outcome: "error", kind: "check_error", message }],
        ["custom/patched-b", { outcome: "error", kind: "scope_unreadable", message: `could not read: ${message}` }],
      ]);
    });
    const obs = await onPage((t) => runProvider(t, p, { timeoutMs: 5_000, sanitiser }));
    expect(obs).toHaveLength(2);
    for (const o of obs) {
      expect(o.error?.message).toBe("the evaluation in the page failed");
      expect(JSON.stringify(o)).not.toContain("zzMARKER");
    }
  });

  it("gives check_error for each check of a provider that throws", async () => {
    const p = provider("custom/throws", ["custom/t-a", "custom/t-b"], async () => {
      throw new Error("boom at https://x.test/#secret");
    });
    const obs = await onPage((t) => runProvider(t, p, { timeoutMs: 5_000, sanitiser }));
    expect(obs).toHaveLength(2);
    for (const o of obs) {
      expect(o.outcome).toBe("error");
      expect(o.error).toEqual({ kind: "check_error", message: "provider custom/throws threw: the evaluation in the page failed" });
      expect(ObservationSchema.safeParse(o).success).toBe(true);
    }
  });

  it("aborts a provider on its timeout through ctx.signal and gives check_error", async () => {
    let aborted = false;
    const p = provider("custom/slow", ["custom/slow-a"], (ctx) => {
      ctx.signal.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise(() => undefined); // never resolves
    });
    const [o] = await onPage((t) => runProvider(t, p, { timeoutMs: 300, sanitiser }));
    expect(aborted).toBe(true);
    expect(o?.error).toEqual({ kind: "check_error", message: "provider custom/slow timed out after 300 ms" });
  });

  it("gives check_error 'no result' for a declared check the provider omits", async () => {
    const p = provider("custom/partial", ["custom/p-a", "custom/p-b"], async () =>
      new Map<CheckId, CheckRunResult>([["custom/p-a", { outcome: "cannot_tell", evidence: [], fingerprint: "custom/p-a:cannot_tell" }]]),
    );
    const [a, b] = await onPage((t) => runProvider(t, p, { timeoutMs: 5_000, sanitiser }));
    expect(a?.outcome).toBe("cannot_tell");
    expect(b?.error).toEqual({ kind: "check_error", message: "no result" });
  });

  it("turns an invalid result into check_error with the validation message", async () => {
    const p = provider("custom/bad", ["custom/b-a", "custom/b-b", "custom/b-c"], async () =>
      new Map<CheckId, CheckRunResult>([
        // no_fault without scope_examined evidence
        ["custom/b-a", { outcome: "no_fault", evidence: [{ kind: "text", note: "x" }], fingerprint: "custom/b-a:no_fault" }],
        // an evidence key the schema does not know
        ["custom/b-b", { outcome: "fault", evidence: [{ kind: "dom_node", locator: "#a", confidence: 0.9 } as never], fingerprint: "f" }],
        // an outcome that does not exist
        ["custom/b-c", { outcome: "passed" as never, evidence: [], fingerprint: "f" }],
      ]),
    );
    const obs = await onPage((t) => runProvider(t, p, { timeoutMs: 5_000, sanitiser }));
    for (const o of obs) {
      expect(o.outcome).toBe("error");
      expect(o.error?.kind).toBe("check_error");
      expect(o.error?.message).toMatch(/^invalid observation: /);
      expect(ObservationSchema.safeParse(o).success).toBe(true);
    }
    expect(obs[0]?.error?.message).toBe("invalid observation: evidence: custom");
  });

  it("refuses a result for an undeclared check id as a bug", async () => {
    const p = provider("custom/rogue", ["custom/r-a"], async () =>
      new Map<CheckId, CheckRunResult>([["custom/r-other", { outcome: "cannot_tell", evidence: [], fingerprint: "x" }]]),
    );
    await expect(onPage((t) => runProvider(t, p, { timeoutMs: 5_000, sanitiser }))).rejects.toThrow(EngineBugError);
  });

  it("runs providers one at a time in the order given", async () => {
    const log: string[] = [];
    const mk = (name: string, id: string): CheckProvider =>
      provider(name, [id], async () => {
        log.push(`start ${name}`);
        await new Promise((r) => setTimeout(r, 30));
        log.push(`end ${name}`);
        return new Map<CheckId, CheckRunResult>([[id, { outcome: "cannot_tell", evidence: [], fingerprint: `${id}:cannot_tell` }]]);
      });
    const obs = await onPage((t) =>
      runProviders(t, [mk("custom/first", "custom/o-1"), mk("axe", "axe/o-2")], { timeoutMs: 5_000, sanitiser }),
    );
    expect(log).toEqual(["start custom/first", "end custom/first", "start axe", "end axe"]);
    expect(obs.map((o) => o.checkId)).toEqual(["custom/o-1", "axe/o-2"]);
  });

  it("refuses providers that declare the same check, or a check outside the registry", () => {
    const a = provider("a", ["custom/same"], async () => new Map());
    const b = provider("b", ["custom/same"], async () => new Map());
    expect(() => validateProviders([a, b])).toThrow(EngineBugError);
    expect(() => validateProviders([a], new Set(["custom/other"]))).toThrow(/not in the check registry/);
    expect(() => validateProviders([a], new Set(["custom/same"]))).not.toThrow();
  });
});
