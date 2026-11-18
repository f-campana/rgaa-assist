/**
 * `custom/8-4-default-lang-code-valid` (RGAA test 8.4.1, the validity
 * condition only). Implements the record in
 * `src/rulesets/rgaa-4.1.2/checks.json` as written:
 *
 * - Scope: the html element of the top-level document, with the document
 *   types, required attributes and reading of xml:lang of
 *   `custom/8-3-default-lang-present` (`../family-a/document-type.ts`).
 * - For each required attribute present: empty or with leading or trailing
 *   whitespace, cannot_tell for it; otherwise the part before the first
 *   hyphen is compared, ignoring ASCII case, with the pinned ISO 639 list
 *   (`iso-639-codes.json`, derived by `derive.ts`); fault when it is not in it.
 * - None of the required attributes: cannot_tell.
 * - Page result: fault if any required attribute has a fault; no_fault when
 *   every required attribute is present and in the list; otherwise
 *   cannot_tell. Never inapplicable.
 */
import { readFileSync } from "node:fs";
import type { CheckId } from "../../../schema/index.ts";
import type { CheckContext, CheckDefinition, CheckProvider, CheckRunResult, RawEvidence } from "../../types.ts";
import { attributeValue, describeType, documentType, requiredAttributes } from "../family-a/document-type.ts";
import type { DocInfo, LangAttribute } from "../family-a/document-type.ts";
import { inFrame } from "../family-a/page.ts";
import { cannotTell, checkError, fault, firstLine, mainFrameOrFailure, noFault, scope, text } from "../family-a/result.ts";
import { LIST_FILE } from "./derive.ts";
import type { CodeList } from "./derive.ts";

export const ID: CheckId = "custom/8-4-default-lang-code-valid";

const list = JSON.parse(readFileSync(LIST_FILE, "utf8")) as CodeList;
const CODES: ReadonlySet<string> = new Set(list.codes);

export const LANGUAGE_CODE_LIST = Object.freeze({
  version: list.version,
  ianaRegistryFileDate: list.sources.ianaRegistry.fileDate,
  ianaRegistrySha256: list.sources.ianaRegistry.sha256,
  locIso6392Sha256: list.sources.locIso6392.sha256,
  count: list.count,
});

export const definition: CheckDefinition = {
  id: ID,
  version: "1.0.0",
  defaultOptions: { languageCodeList: LANGUAGE_CODE_LIST },
};

function asciiLower(s: string): string {
  return s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** The part of the value before the first hyphen, or the whole value. */
export function primaryPart(value: string): string {
  const i = value.indexOf("-");
  return i < 0 ? value : value.slice(0, i);
}

/** Whether `code` is in the pinned list, ignoring ASCII case. */
export function inList(code: string): boolean {
  return CODES.has(asciiLower(code));
}

type AttributeVerdict = { name: LangAttribute; value: string } & (
  | { verdict: "absent" }
  | { verdict: "cannot_tell"; why: string }
  | { verdict: "fault"; code: string }
  | { verdict: "valid"; code: string }
);

function judge(name: LangAttribute, value: string | null): AttributeVerdict {
  if (value === null) return { name, value: "", verdict: "absent" };
  if (value.length === 0) return { name, value, verdict: "cannot_tell", why: "its value is empty" };
  // RECORD: "leading or trailing whitespace" does not say which whitespace;
  // any Unicode white space is counted (JavaScript \s), the wider reading,
  // which can only make the check abstain.
  if (/^\s|\s$/u.test(value)) return { name, value, verdict: "cannot_tell", why: "its value has leading or trailing whitespace" };
  const code = primaryPart(value);
  return inList(code) ? { name, value, verdict: "valid", code } : { name, value, verdict: "fault", code };
}

export async function examine(ctx: CheckContext): Promise<CheckRunResult> {
  const main = mainFrameOrFailure(ctx.frames);
  if ("outcome" in main) return main;
  let doc: DocInfo;
  try {
    doc = await inFrame<DocInfo>(main.frame, "doc-info");
  } catch (e) {
    return checkError(`reading the top-level document failed: ${firstLine(e)}`);
  }
  const type = documentType(doc);
  const required = requiredAttributes(type);
  const verdicts = required.map((name) => judge(name, attributeValue(doc, name)));
  const htmlSnippet = doc.root?.snippet ?? "";
  const typeNote = `document type ${describeType(type)} (content type ${doc.contentType}${doc.publicId ? `, doctype public identifier "${doc.publicId}"` : ""}); required: ${required.join(" and ")}`;
  const listNote = `pinned ISO 639 list ${list.version}, ${list.count} codes`;

  const faults = verdicts.filter((v): v is Extract<AttributeVerdict, { verdict: "fault" }> => v.verdict === "fault");
  if (faults.length > 0) {
    const evidence: RawEvidence[] = faults.map((f) => ({
      kind: "dom_node",
      locator: "html",
      snippet: htmlSnippet,
      note: `Attribute ${f.name}="${f.value}": the part before the first hyphen, "${f.code}", is not in the ${listNote}. ${typeNote}.`,
    }));
    const first = faults[0] as Extract<AttributeVerdict, { verdict: "fault" }>;
    return fault(ID, `${first.name}=${asciiLower(first.code)}`, evidence);
  }
  if (verdicts.every((v) => v.verdict === "absent")) {
    return cannotTell(ID, [
      text(
        `The html element has none of the required attributes (${typeNote}). The default language may be given on each text element instead, which this check does not examine, or be missing, in which case the test does not apply.`,
      ),
    ]);
  }
  if (verdicts.every((v) => v.verdict === "valid")) {
    const codes = verdicts.map((v) => `${v.name}="${v.value}" (code "${v.verdict === "valid" ? v.code : ""}")`).join(", ");
    return noFault(ID, [scope(`The html element of the top-level document: ${codes}, in the ${listNote}. ${typeNote}.`, "html")]);
  }
  const notes = verdicts.map((v) => {
    switch (v.verdict) {
      case "absent":
        return `${v.name} is absent`;
      case "cannot_tell":
        return `${v.name}="${v.value}": cannot tell, ${v.why}`;
      case "valid":
        return `${v.name}="${v.value}": "${v.code}" is in the list`;
      case "fault":
        return "";
    }
  });
  return cannotTell(ID, [{ kind: "dom_node", locator: "html", snippet: htmlSnippet, note: `${notes.join("; ")}. ${typeNote}.` }]);
}

export const langCodeValidProvider: CheckProvider = {
  name: "custom/8-4-default-lang-code-valid",
  checks: [definition],
  async run(ctx) {
    return new Map([[ID, await examine(ctx)]]);
  },
};
