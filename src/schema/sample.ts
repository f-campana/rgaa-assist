/**
 * The sample file (spec 7): written by a person, validated against this schema.
 *
 * Invalid here (schema errors):
 * - no pages (7.1);
 * - a page marked `authenticated` without `session.storageState` (7.1);
 * - a page marked `authenticated` without `expect` (7.3);
 * - a declared state without `expect` (7.3). Every declared state is a state
 *   other than `initial`: the id `initial` is reserved for the page as loaded;
 * - a declared state without steps (see the contract notes);
 * - a step other than the five actions of 7.2;
 * - `model.enabled: true` without a provider and a model id (9);
 * - duplicate ids for pages, states of one page, services or processes.
 *
 * Not errors: everything 7.5 calls a warning (missing fixed kinds, a service
 * with no page, a process step not in `pages`, a `process_step` page in no
 * process, too few random pages). `checkSample` reports those.
 *
 * Locators and step values are stored as written. They must not contain
 * secrets (8.7).
 */
import { z } from "zod";
import { INITIAL_STATE_ID, LocalIdSchema, SizeSchema, TextSchema, duplicates } from "./common.ts";

const HttpUrlSchema = z.url({ protocol: /^https?$/ });

/** A Playwright locator string. Role and label locators are preferred (7.2). */
export const LocatorSchema = TextSchema;

export const FIXED_PAGE_KINDS = [
  "home",
  "contact",
  "legal_notice",
  "accessibility_statement",
  "sitemap",
  "help",
  "authentication",
] as const;
export const FixedPageKindSchema = z.enum(FIXED_PAGE_KINDS);
export type FixedPageKind = z.infer<typeof FixedPageKindSchema>;

export const PAGE_KINDS = [
  ...FIXED_PAGE_KINDS,
  "service",
  "search",
  "process_step",
  "distinct_template",
  "random",
] as const;
export const PageKindSchema = z.enum(PAGE_KINDS);
export type PageKind = z.infer<typeof PageKindSchema>;

// ---------------------------------------------------------------------------
// Steps (7.2): five actions, no more. Each step is an object with one key.
// ---------------------------------------------------------------------------

export const NavigateStepSchema = z.strictObject({ navigate: HttpUrlSchema });
export const ClickStepSchema = z.strictObject({ click: LocatorSchema });
/** `fill` refuses any field of type `password` at run time (7.2, Q17). */
export const FillStepSchema = z.strictObject({
  fill: z.strictObject({ locator: LocatorSchema, value: z.string() }),
});
/** `press` sends a key, to the focused element or to `locator` when given. */
export const PressStepSchema = z.strictObject({
  press: z.strictObject({ key: TextSchema, locator: LocatorSchema.optional() }),
});
export const SetViewportStepSchema = z.strictObject({ setViewport: SizeSchema });

export const StepSchema = z.union([
  NavigateStepSchema,
  ClickStepSchema,
  FillStepSchema,
  PressStepSchema,
  SetViewportStepSchema,
]);
export type Step = z.infer<typeof StepSchema>;

/** The action name of a step: `navigate`, `click`, `fill`, `press` or `setViewport`. */
export const STEP_ACTIONS = ["navigate", "click", "fill", "press", "setViewport"] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];
export function stepAction(step: Step): StepAction {
  return Object.keys(step)[0] as StepAction;
}

// ---------------------------------------------------------------------------
// Expectations (7.3)
// ---------------------------------------------------------------------------

/** What must be true before a target is examined: a visible locator, an address, or both. */
export const ExpectSchema = z
  .strictObject({
    visible: LocatorSchema.optional(),
    url: HttpUrlSchema.optional(),
  })
  .refine((e) => e.visible !== undefined || e.url !== undefined, "expect needs `visible`, `url` or both");
export type Expect = z.infer<typeof ExpectSchema>;

// ---------------------------------------------------------------------------
// Pages and states
// ---------------------------------------------------------------------------

/** A declared state: a page after its own steps (3, 7.4). Never `initial`. */
export const StateSchema = z.strictObject({
  id: LocalIdSchema.refine((id) => id !== INITIAL_STATE_ID, "`initial` is the page as loaded and cannot be declared"),
  steps: z.array(StepSchema).min(1, "a declared state has at least one step"),
  expect: ExpectSchema,
});
export type State = z.infer<typeof StateSchema>;

/** Capture policy for a page (8.7). */
export const CaptureSchema = z.strictObject({
  /** On targets examined with the saved session, screenshots are off unless this is `true`. */
  screenshots: z.boolean().default(false),
  /** Locators of regions blacked out on screenshots. */
  mask: z.array(LocatorSchema).default([]),
});
export type Capture = z.infer<typeof CaptureSchema>;

export const PageSchema = z
  .strictObject({
    id: LocalIdSchema,
    url: HttpUrlSchema,
    kinds: z.array(PageKindSchema).min(1),
    /** Id of a declared service this page belongs to. */
    service: LocalIdSchema.optional(),
    /** Examine this page with the saved session (7.1). Requires `session.storageState` and `expect`. */
    authenticated: z.boolean().default(false),
    /** Checked after loading, before any state's steps. Required when `authenticated` (7.3). */
    expect: ExpectSchema.optional(),
    states: z.array(StateSchema).default([]),
    capture: CaptureSchema.optional(),
  })
  .superRefine((page, ctx) => {
    if (page.authenticated && page.expect === undefined) {
      ctx.addIssue({ code: "custom", path: ["expect"], message: "a page marked authenticated needs `expect` (7.3)" });
    }
    for (const id of duplicates(page.states.map((s) => s.id))) {
      ctx.addIssue({ code: "custom", path: ["states"], message: `duplicate state id: ${id}` });
    }
    for (const kind of duplicates(page.kinds)) {
      ctx.addIssue({ code: "custom", path: ["kinds"], message: `duplicate kind: ${kind}` });
    }
  });
export type Page = z.infer<typeof PageSchema>;

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

export const RegimeSchema = z.enum(["rgaa_article_47", "eaa", "none", "to_confirm"]);
export const ReportLanguageSchema = z.enum(["en", "fr"]);

export const SampleModelSchema = z
  .strictObject({
    enabled: z.boolean().default(false),
    /** Content from targets examined with the saved session may be sent only when this is also `true` (8.7, 9). */
    allowAuthenticated: z.boolean().default(false),
    provider: TextSchema.optional(),
    model: TextSchema.optional(),
  })
  .refine(
    (m) => !m.enabled || (m.provider !== undefined && m.model !== undefined),
    "model.enabled needs a provider and a model id (9)",
  );

export const SampleFileSchema = z
  .strictObject({
    project: z.strictObject({
      name: TextSchema,
      ruleset: TextSchema,
      /** The user's own statement, printed in the report. It changes nothing else. */
      regime: RegimeSchema.default("to_confirm"),
      reportLanguage: ReportLanguageSchema.default("en"),
    }),
    model: SampleModelSchema.default({ enabled: false, allowAuthenticated: false }),
    session: z
      .strictObject({
        /** Path to a Playwright storage-state file. Read only, never copied, never logged (8.7). */
        storageState: TextSchema.optional(),
      })
      .optional(),
    viewport: SizeSchema.optional(),
    /** Fixed page kinds that do not exist on this site. */
    absentKinds: z.array(FixedPageKindSchema).default([]),
    services: z.array(z.strictObject({ id: LocalIdSchema, name: TextSchema })).default([]),
    processes: z
      .array(z.strictObject({ id: LocalIdSchema, name: TextSchema, steps: z.array(LocalIdSchema).min(1) }))
      .default([]),
    /** Listed for the human. Never examined (Q28). */
    documents: z.array(z.strictObject({ url: HttpUrlSchema, service: LocalIdSchema.optional() })).default([]),
    pages: z.array(PageSchema).min(1, "a sample with no pages is invalid (7.1)"),
    /** Query-string parameter names whose values may be kept in outputs. All others are masked (8.7). */
    safeQueryParams: z.array(TextSchema).default([]),
  })
  .superRefine((sample, ctx) => {
    const hasSession = sample.session?.storageState !== undefined;
    sample.pages.forEach((page, i) => {
      if (page.authenticated && !hasSession) {
        ctx.addIssue({
          code: "custom",
          path: ["pages", i, "authenticated"],
          message: "a page marked authenticated needs session.storageState (7.1)",
        });
      }
    });
    for (const id of duplicates(sample.pages.map((p) => p.id))) {
      ctx.addIssue({ code: "custom", path: ["pages"], message: `duplicate page id: ${id}` });
    }
    for (const id of duplicates(sample.services.map((s) => s.id))) {
      ctx.addIssue({ code: "custom", path: ["services"], message: `duplicate service id: ${id}` });
    }
    for (const id of duplicates(sample.processes.map((p) => p.id))) {
      ctx.addIssue({ code: "custom", path: ["processes"], message: `duplicate process id: ${id}` });
    }
  });
export type SampleFile = z.infer<typeof SampleFileSchema>;
/** The sample as written, before defaults are applied. */
export type SampleFileInput = z.input<typeof SampleFileSchema>;
