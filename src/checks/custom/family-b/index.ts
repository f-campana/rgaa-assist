/**
 * Family B (presentation): one provider for `custom/10-1-presentation-elements`
 * (10.1.1) and `custom/10-1-presentation-attributes` (10.1.2). Both read the
 * same thing, the generated source of the page as loaded, hidden elements
 * included, so the page is read once (`read.ts`) and each check decides from
 * that reading in its own module.
 *
 * Read only: one evaluation per frame and one `DOM.getDocument` per CDP target.
 */
import type { CheckId } from "../../../schema/index.ts";
import type { CheckContext, CheckFailure, CheckProvider, CheckRunResult } from "../../types.ts";
import { ATTRIBUTES_CHECK_ID, ATTRIBUTE_LISTS, attributesDefinition, decideAttributes } from "../10-1-presentation-attributes/index.ts";
import { ELEMENTS_CHECK_ID, ELEMENT_LISTS, decideElements, elementsDefinition } from "../10-1-presentation-elements/index.ts";
import { TopUnreadable, readPage } from "./read.ts";
import type { PageReading } from "./read.ts";
import type { ScanInput } from "./scan.ts";

function positive(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export const presentationProvider: CheckProvider = {
  name: "custom/10-1-presentation",
  checks: [elementsDefinition, attributesDefinition],
  async run(ctx: CheckContext): Promise<ReadonlyMap<CheckId, CheckRunResult>> {
    const eOptions = ctx.options.get(ELEMENTS_CHECK_ID) ?? elementsDefinition.defaultOptions;
    const aOptions = ctx.options.get(ATTRIBUTES_CHECK_ID) ?? attributesDefinition.defaultOptions;
    const max = (key: string, fallback: number): number => Math.max(positive(eOptions[key], fallback), positive(aOptions[key], fallback));

    const input: ScanInput = {
      presentationElements: ELEMENT_LISTS.presentationElements,
      otherObsoleteElements: ELEMENT_LISTS.otherObsoleteElements,
      presentationAttributes: ATTRIBUTE_LISTS.presentationAttributes,
      exceptedPairs: ATTRIBUTE_LISTS.exceptedPairs,
      dimensionPairs: ATTRIBUTE_LISTS.dimensionPairs,
      definedPairs: ATTRIBUTE_LISTS.definedPairs,
      obsoleteAttributes: ATTRIBUTE_LISTS.obsoleteAttributes,
      sampleCap: max("sampleCap", 20),
      faultCap: max("faultCap", 1000),
    };

    let reading: PageReading;
    try {
      reading = await readPage(
        ctx,
        input,
        {
          elementNames: [...ELEMENT_LISTS.presentationElements, ...ELEMENT_LISTS.otherObsoleteElements],
          attributeNames: [...ATTRIBUTE_LISTS.presentationAttributes, ...Object.keys(ATTRIBUTE_LISTS.obsoleteAttributes)],
        },
        max("frameTimeoutMs", 15000),
      );
    } catch (e) {
      if (!(e instanceof TopUnreadable)) throw e;
      const failure: CheckFailure = { outcome: "error", kind: "scope_unreadable", message: e.message };
      return new Map([
        [ELEMENTS_CHECK_ID, failure],
        [ATTRIBUTES_CHECK_ID, failure],
      ]);
    }

    return new Map<CheckId, CheckRunResult>([
      [ELEMENTS_CHECK_ID, decideElements(reading, eOptions)],
      [ATTRIBUTES_CHECK_ID, decideAttributes(reading, aOptions)],
    ]);
  },
};
