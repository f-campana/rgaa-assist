import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  BROWSER_FAILURE,
  PAGE_FAILURE,
  browserFailure,
  classifyPageOrBrowser,
  internalErrorLine,
  recognisedBrowserError,
  zodIssueText,
} from "../../src/engine/error-class.ts";
import { parseSample } from "../../src/engine/sample.ts";

const MARKER = "QXMARK-secret-https://x.test/?token=abc";

describe("classifying page and browser errors", () => {
  it("recognises a browser error by name", () => {
    const e = new Error(`waiting for ${MARKER}`);
    e.name = "TimeoutError";
    expect(classifyPageOrBrowser(e)).toEqual({ origin: "browser", message: "the browser operation timed out" });
  });

  it("recognises a browser error by known prefix, after the API prefix", () => {
    expect(recognisedBrowserError(new Error(`frame.evaluate: Target page, context or browser has been closed\n${MARKER}`))).toBe(
      "the page, context or browser was closed",
    );
    expect(recognisedBrowserError(new Error(`Frame was detached ${MARKER}`))).toBe("the frame was detached");
    expect(recognisedBrowserError(new Error(`page.evaluate: Execution context was destroyed, ${MARKER}`))).toBe(
      "the execution context was destroyed",
    );
  });

  it("maps known net:: errors to fixed messages and other net:: errors to a generic one", () => {
    expect(browserFailure(new Error(`page.goto: net::ERR_CONNECTION_REFUSED at ${MARKER}`))).toBe("the connection was refused");
    expect(browserFailure(new Error(`page.goto: net::ERR_SOMETHING_NEW at ${MARKER}`))).toBe("network error");
  });

  it("treats an unknown origin as page, with a fixed message", () => {
    expect(classifyPageOrBrowser(new Error(MARKER))).toEqual({ origin: "page", message: PAGE_FAILURE });
    expect(classifyPageOrBrowser(MARKER)).toEqual({ origin: "page", message: PAGE_FAILURE });
    expect(classifyPageOrBrowser({ message: MARKER })).toEqual({ origin: "page", message: PAGE_FAILURE });
  });

  it("gives \"browser error\" for an unrecognised browser-side failure", () => {
    expect(browserFailure(new Error(MARKER))).toBe(BROWSER_FAILURE);
  });

  it("never quotes the error text", () => {
    const inputs: unknown[] = [
      new Error(MARKER),
      new Error(`page.goto: net::ERR_CONNECTION_REFUSED ${MARKER}`),
      Object.assign(new Error(MARKER), { name: "TimeoutError" }),
      MARKER,
    ];
    for (const e of inputs) {
      expect(classifyPageOrBrowser(e).message).not.toContain("QXMARK");
      expect(browserFailure(e)).not.toContain("QXMARK");
    }
  });
});

describe("zod issues", () => {
  it("gives the path and the issue code only", () => {
    const r = z.object({ a: z.array(z.literal("x")) }).safeParse({ a: [MARKER] });
    expect(r.success).toBe(false);
    if (r.success) return;
    const text = r.error.issues.map((i) => zodIssueText(i)).join("; ");
    expect(text).toBe("a.0: invalid_value");
    expect(text).not.toContain("QXMARK");
  });

  it("names the root when the path is empty", () => {
    expect(zodIssueText({ path: [], code: "invalid_type" })).toBe("(root): invalid_type");
  });
});

describe("the CLI internal error line", () => {
  it("gives the class, a fixed message and the code, without the message or stack", () => {
    const e = new TypeError(`${MARKER}\nsecond line ${MARKER}`);
    const line = internalErrorLine(e, "E-CLI-01");
    expect(line).toBe("rgaa-assist: internal error (TypeError): the tool stopped unexpectedly [E-CLI-01]");
    expect(line).not.toContain("QXMARK");
    expect(line).not.toContain(" at ");
  });

  it("does not use a page-influenced class name", () => {
    class QXMARKError extends Error {}
    expect(internalErrorLine(new QXMARKError("x"), "E-CLI-01")).toContain("(Error)");
    expect(internalErrorLine(MARKER, "E-CLI-01")).toContain("(non-error value)");
  });
});

describe("sample parsing messages", () => {
  it("says only \"not valid JSON\" for invalid JSON", () => {
    const r = parseSample(`{"a": ${MARKER}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.messages).toEqual(["sample: not valid JSON"]);
  });

  it("gives path and issue code for schema errors, never the value", () => {
    const r = parseSample(JSON.stringify({ [MARKER]: MARKER }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    for (const m of r.messages) {
      expect(m).toMatch(/^sample: [^:]+: [a-z_]+$/);
      expect(m).not.toContain(MARKER.slice(7));
    }
  });
});
