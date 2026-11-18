import { FIXED_PAGE_KINDS } from "../../schema/index.ts";
import type { SampleFile, SampleWarning } from "../../schema/index.ts";

/**
 * Warnings about a sample (spec 7.5). Never blocks a run. Ruleset-neutral.
 *
 * Warnings, in this order:
 * 1. `fixed_kind_missing`, in `FIXED_PAGE_KINDS` order, for each fixed kind
 *    that no page has and `absentKinds` does not list;
 * 2. `service_without_page`, in `services` order, for each declared service
 *    that no page names in `service`;
 * 3. `process_step_not_in_pages`, in process then step order, for each step
 *    id that is not a page id;
 * 4. `process_step_without_process`, in page order, for each page with kind
 *    `process_step` that no process lists;
 * 5. `too_few_random_pages`, when `randomPages < required`, where
 *    `randomPages` counts pages whose only kind is `random`, `otherPages` is
 *    the number of the other pages, and `required = ceil(otherPages / 10)`.
 *    Pages are counted, not states.
 *
 * What the check cannot verify is `SAMPLE_UNVERIFIABLE`, carried by the
 * statements of every output, not returned here.
 */
export function checkSample(sample: SampleFile): SampleWarning[] {
  const warnings: SampleWarning[] = [];

  const kindsPresent = new Set(sample.pages.flatMap((p) => p.kinds));
  const absent = new Set<string>(sample.absentKinds);
  for (const kind of FIXED_PAGE_KINDS) {
    if (!kindsPresent.has(kind) && !absent.has(kind)) warnings.push({ code: "fixed_kind_missing", kind });
  }

  const servicesUsed = new Set(sample.pages.flatMap((p) => (p.service === undefined ? [] : [p.service])));
  for (const service of sample.services) {
    if (!servicesUsed.has(service.id)) warnings.push({ code: "service_without_page", service: service.id });
  }

  const pageIds = new Set(sample.pages.map((p) => p.id));
  for (const process of sample.processes) {
    for (const step of process.steps) {
      if (!pageIds.has(step)) warnings.push({ code: "process_step_not_in_pages", process: process.id, step });
    }
  }

  const listedSteps = new Set(sample.processes.flatMap((p) => p.steps));
  for (const page of sample.pages) {
    if (page.kinds.includes("process_step") && !listedSteps.has(page.id)) {
      warnings.push({ code: "process_step_without_process", page: page.id });
    }
  }

  const randomPages = sample.pages.filter((p) => p.kinds.length === 1 && p.kinds[0] === "random").length;
  const otherPages = sample.pages.length - randomPages;
  const required = Math.ceil(otherPages / 10);
  if (randomPages < required) warnings.push({ code: "too_few_random_pages", randomPages, otherPages, required });

  return warnings;
}
