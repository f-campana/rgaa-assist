/**
 * Error classification (privacy design section 5). Every caught error is
 * classified where it is caught, and only a fixed message for its class
 * reaches any output: never the raw message, never a stack.
 */
export type ErrorOrigin = "page" | "browser" | "parser" | "engine";

export interface ClassifiedError {
  origin: ErrorOrigin;
  /** A fixed message; never text taken from the error. */
  message: string;
}

export const PAGE_FAILURE = "the evaluation in the page failed";
export const BROWSER_FAILURE = "browser error";

/** Recognised browser errors, matched by message prefix after any `api.call: ` prefix. */
const BROWSER_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["Target page, context or browser has been closed", "the page, context or browser was closed"],
  ["Target closed", "the page, context or browser was closed"],
  ["Browser has been closed", "the page, context or browser was closed"],
  ["Frame was detached", "the frame was detached"],
  ["Execution context was destroyed", "the execution context was destroyed"],
  ["Navigation failed because page crashed", "the page crashed"],
  ["Page crashed", "the page crashed"],
  ["Timeout ", "the browser operation timed out"],
  ["net::ERR_CONNECTION_REFUSED", "the connection was refused"],
  ["net::ERR_NAME_NOT_RESOLVED", "the host name was not resolved"],
  ["net::ERR_CONNECTION_RESET", "the connection was reset"],
  ["net::ERR_CONNECTION_CLOSED", "the connection was closed"],
  ["net::ERR_CONNECTION_TIMED_OUT", "the connection timed out"],
  ["net::ERR_ADDRESS_UNREACHABLE", "the address is unreachable"],
  ["net::ERR_CERT_", "the certificate was rejected"],
  ["net::ERR_SSL_", "the TLS connection failed"],
  ["net::ERR_ABORTED", "the navigation was aborted"],
  ["net::", "network error"],
  ["Protocol error", "browser protocol error"],
];

/** Recognised browser errors matched by `name`. */
const BROWSER_NAMES: Readonly<Record<string, string>> = {
  TimeoutError: "the browser operation timed out",
};

function rawMessage(e: unknown): string {
  if (e instanceof Error) return typeof e.message === "string" ? e.message : "";
  return typeof e === "string" ? e : "";
}

/** Playwright prefixes messages with the API call, as in `page.goto: net::ERR_...`. */
function stripApiPrefix(text: string): string {
  return text.replace(/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+: /, "");
}

/** The fixed message for a recognised browser error, or null when not recognised. */
export function recognisedBrowserError(e: unknown): string | null {
  if (e instanceof Error && Object.hasOwn(BROWSER_NAMES, e.name)) return BROWSER_NAMES[e.name] ?? null;
  const text = stripApiPrefix(rawMessage(e).trimStart());
  for (const [prefix, message] of BROWSER_PREFIXES) if (text.startsWith(prefix)) return message;
  return null;
}

/**
 * Classifies an error thrown from page or browser work. A recognised browser
 * error gets its fixed message; anything else is of unknown origin and is
 * treated as `page`.
 */
export function classifyPageOrBrowser(e: unknown): ClassifiedError {
  const browser = recognisedBrowserError(e);
  if (browser !== null) return { origin: "browser", message: browser };
  return { origin: "page", message: PAGE_FAILURE };
}

/** The fixed text for a browser-side failure: the recognised message, else "browser error". */
export function browserFailure(e: unknown): string {
  return recognisedBrowserError(e) ?? BROWSER_FAILURE;
}

/** A zod issue as path + issue code only; never the issue message, which can quote values. */
export function zodIssueText(issue: { readonly path: ReadonlyArray<PropertyKey>; readonly code: string }): string {
  const path = issue.path.length > 0 ? issue.path.map((p) => String(p)).join(".") : "(root)";
  return `${path}: ${issue.code}`;
}

/**
 * The CLI's internal error line: the class, a fixed message and an opaque
 * diagnostic code for the throw site. No stack frames, no raw message.
 */
export function internalErrorLine(e: unknown, code: string): string {
  const cls = e instanceof Error ? errorClassName(e) : "non-error value";
  return `rgaa-assist: internal error (${cls}): the tool stopped unexpectedly [${code}]`;
}

const KNOWN_CLASSES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "EvalError",
  "URIError",
  "AggregateError",
  "TimeoutError",
  "ZodError",
]);

/** The error's class, only when it is a known built-in name; otherwise "Error". */
function errorClassName(e: Error): string {
  const name = e.constructor?.name;
  return typeof name === "string" && KNOWN_CLASSES.has(name) ? name : "Error";
}
