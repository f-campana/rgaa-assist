/** The RGAA 4.1.2 plug-in (spec 5.2). */
import type { RulesetPlugin } from "../contract.ts";
import { checkSample, deriveFindings, reduce } from "../shared/index.ts";
import { loadCoverageMap } from "./coverage-map.ts";
import { loadOfficialData } from "./official-data.ts";

export const RGAA_412_ID = "rgaa-4.1.2";
export const RGAA_412_VERSION = "4.1.2";

/**
 * Load the plug-in: official data, then the coverage map checked against it.
 * Throws with every problem listed when the coverage map is invalid.
 */
export function loadRgaa412(): RulesetPlugin {
  const official = loadOfficialData();
  const loaded = loadCoverageMap(official);
  if (!loaded.ok) {
    const lines = loaded.problems.map((p) => `${p.file} ${p.path.join(".")}: ${p.message}`);
    throw new Error(`invalid coverage map for ${RGAA_412_ID}:\n${lines.join("\n")}`);
  }
  const criteria = [...official.criteria.values()].map((c) => ({ id: c.id, tests: c.tests }));
  return {
    id: RGAA_412_ID,
    version: RGAA_412_VERSION,
    official,
    coverage: loaded.map,
    deriveFindings: (input) => deriveFindings({ ...input, ruleset: RGAA_412_ID }),
    reduce: (input) => reduce({ ...input, ruleset: RGAA_412_ID, criteria }),
    checkSample: (sample) => checkSample(sample),
  };
}

export { loadOfficialData, OFFICIAL_SOURCE, OFFICIAL_SHA256 } from "./official-data.ts";
export { loadCoverageMap } from "./coverage-map.ts";
export { checkCitation, checkEntryCitations, citationSourceForms } from "./citations.ts";
