/**
 * Page scripts of family A. Each script under `page/` is a plain JavaScript
 * function expression `function (C, arg) { … }`, evaluated in the frame being
 * examined with `C`, the helpers of `page/common.js`, and a JSON argument.
 * They are kept as JavaScript read as text because the repository's
 * TypeScript configuration has no DOM library; they never leave a global and
 * never change the page.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CDPSession, Frame } from "playwright";

export type PageScript = "doc-info" | "frame-doc" | "title-main" | "ids" | "witness";

const DIR = join(import.meta.dirname, "page");
const sources = new Map<string, string>();

function source(name: PageScript | "common"): string {
  let s = sources.get(name);
  if (s === undefined) {
    s = readFileSync(join(DIR, `${name}.js`), "utf8")
      .replace(/^(\s*\/\/[^\n]*\n)+/, "")
      .trim()
      .replace(/;$/, "");
    sources.set(name, s);
  }
  return s;
}

/** The expression that runs `script` with the helpers and `arg`. */
export function pageExpression(script: PageScript, arg: unknown = null): string {
  return `(${source(script)})(${source("common")}, ${JSON.stringify(arg)})`;
}

/** Run a page script in a frame through Playwright and return its JSON result. */
export async function inFrame<T>(frame: Frame, script: PageScript, arg: unknown = null): Promise<T> {
  return (await frame.evaluate(pageExpression(script, arg))) as T;
}

/** A remote object from a CDP evaluation. */
export interface RemoteObject {
  type: string;
  subtype?: string;
  objectId?: string;
  value?: unknown;
}

interface EvaluateResponse {
  result: RemoteObject;
  exceptionDetails?: { text?: string; exception?: { description?: string } };
}

function exceptionMessage(r: EvaluateResponse): string {
  return r.exceptionDetails?.exception?.description ?? r.exceptionDetails?.text ?? "the page script threw";
}

/**
 * Run a page script through CDP in the main world of the session's own frame,
 * keeping the result as a remote object in `objectGroup`. The caller releases
 * the group with `releaseGroup`.
 */
export async function evaluateRemote(session: CDPSession, expression: string, objectGroup: string): Promise<RemoteObject> {
  const r = (await session.send("Runtime.evaluate", { expression, objectGroup, returnByValue: false })) as EvaluateResponse;
  if (r.exceptionDetails !== undefined) throw new Error(exceptionMessage(r));
  return r.result;
}

/** Call `functionDeclaration` with `this` bound to the object; by value or as a remote object. */
export async function callOn(
  session: CDPSession,
  objectId: string,
  functionDeclaration: string,
  args: unknown[],
  options: { byValue: boolean; objectGroup: string },
): Promise<RemoteObject> {
  const r = (await session.send("Runtime.callFunctionOn", {
    objectId,
    functionDeclaration,
    arguments: args.map((value) => ({ value })),
    returnByValue: options.byValue,
    objectGroup: options.objectGroup,
  })) as EvaluateResponse;
  if (r.exceptionDetails !== undefined) throw new Error(exceptionMessage(r));
  return r.result;
}

/** The remote objects held by an array object, in index order. */
export async function arrayItems(session: CDPSession, objectId: string): Promise<RemoteObject[]> {
  const r = (await session.send("Runtime.getProperties", { objectId, ownProperties: true })) as {
    result: { name: string; value?: RemoteObject }[];
  };
  return r.result
    .filter((p) => /^\d+$/.test(p.name) && p.value !== undefined)
    .sort((a, b) => Number(a.name) - Number(b.name))
    .map((p) => p.value as RemoteObject);
}

export async function releaseGroup(session: CDPSession, objectGroup: string): Promise<void> {
  await session.send("Runtime.releaseObjectGroup", { objectGroup }).catch(() => undefined);
}

/** A DOM node as `DOM.describeNode` gives it (the fields family A reads). */
export interface CdpNode {
  backendNodeId: number;
  nodeType: number;
  nodeName: string;
  localName: string;
  nodeValue: string;
  isSVG?: boolean;
  children?: CdpNode[];
  shadowRoots?: (CdpNode & { shadowRootType?: string })[];
  templateContent?: CdpNode;
  contentDocument?: CdpNode;
}

export async function describe(session: CDPSession, objectId: string, depth: number): Promise<CdpNode> {
  const r = (await session.send("DOM.describeNode", { objectId, depth, pierce: true })) as { node: CdpNode };
  return r.node;
}
