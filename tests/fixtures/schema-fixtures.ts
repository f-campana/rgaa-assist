/**
 * Small fixtures for the schema unit tests. Each function returns a fresh,
 * mutable copy.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dirname;

/** A valid coverage entry for test 1.1.6 with verbatim quotes, at level none. Plain JSON. */
export function entry116(): Record<string, any> {
  return JSON.parse(readFileSync(join(here, "entry-1.1.6.json"), "utf8")) as Record<string, any>;
}

/** A registry that knows the checks the fixtures link. */
export function registry(): { schemaVersion: 1; checks: { id: string; kind: "axe" | "custom" | "model"; examines: string; exists: boolean }[] } {
  return {
    schemaVersion: 1,
    checks: [
      { id: "axe/object-alt", kind: "axe", examines: "object elements: text alternative only", exists: true },
      {
        id: "custom/object-image-alternatives",
        kind: "custom",
        examines: "every image object: all three routes of 1.1.6",
        exists: false,
      },
    ],
  };
}

/** The 1.1.6 entry raised to candidate full with a resolving custom link that proves failure. */
export function entry116Full(): Record<string, any> {
  const e = entry116();
  e.links.push({
    check: "custom/object-image-alternatives",
    requirement: "object-alternative",
    routes: ["text-alternative-and-role", "adjacent-link", "replace-mechanism"],
    scope: "whole",
    faultMeans: "failure",
  });
  e.candidate = "full";
  e.applicability = "structural";
  return e;
}

/** An established target in its initial state. */
export function targetInitial(): Record<string, any> {
  return {
    targetId: "home/initial",
    requestedUrl: "https://example.com/",
    effectiveUrl: "https://example.com/",
    viewport: { requested: { width: 1280, height: 800 }, applied: { width: 1280, height: 800 } },
    sessionLoaded: false,
    prerequisitesMet: [],
    steps: [],
    expect: { declared: false, metBeforeSteps: null, met: null },
    established: true,
  };
}

/** An established declared state. */
export function targetState(): Record<string, any> {
  return {
    ...targetInitial(),
    targetId: "home/menu-open",
    prerequisitesMet: ["state"],
    steps: [{ action: "click", ok: true }],
    expect: { declared: true, metBeforeSteps: false, met: true },
  };
}

export function observation(over: Record<string, unknown> = {}): Record<string, any> {
  return {
    id: "obs-1",
    checkId: "axe/object-alt",
    checkVersion: "4.14.0",
    options: {},
    targetId: "home/initial",
    outcome: "no_fault",
    evidence: [{ id: "ev-1", kind: "scope_examined", note: "2 object elements examined" }],
    fingerprint: "fp-1",
    ...over,
  };
}

export function finding(over: Record<string, unknown> = {}): Record<string, any> {
  return {
    ruleset: "rgaa-4.1.2",
    test: "1.1.6",
    targetId: "home/initial",
    status: "needs_review",
    reason: "not_enabled",
    complete: true,
    notRun: [],
    requirementFacts: { "object-alternative": ["unresolved"] },
    observations: ["obs-1"],
    ...over,
  };
}

/** The sample of spec section 7, as written there. */
export function specSample(): Record<string, any> {
  return {
    project: { name: "Example site", ruleset: "rgaa-4.1.2", regime: "to_confirm", reportLanguage: "en" },
    model: { enabled: false, allowAuthenticated: false },
    session: { storageState: "./.auth/state.json" },
    viewport: { width: 1280, height: 800 },
    absentKinds: ["sitemap", "help"],
    services: [
      { id: "contact-request", name: "Send a message" },
      { id: "account", name: "Manage my account" },
    ],
    processes: [{ id: "signup", name: "Sign up", steps: ["signup-1", "signup-2"] }],
    documents: [{ url: "https://example.com/terms.pdf", service: "account" }],
    pages: [
      {
        id: "home",
        url: "https://example.com/",
        kinds: ["home"],
        states: [
          {
            id: "menu-open-mobile",
            steps: [{ setViewport: { width: 375, height: 812 } }, { click: "role=button[name='Menu']" }],
            expect: { visible: "role=button[name='Menu'][expanded=true]" },
          },
        ],
      },
      {
        id: "account-home",
        url: "https://example.com/account",
        kinds: ["service"],
        service: "account",
        authenticated: true,
        expect: { url: "https://example.com/account", visible: "role=heading[name='My account']" },
        capture: { screenshots: false, mask: [] },
      },
      { id: "signup-1", url: "https://example.com/signup", kinds: ["process_step"] },
      { id: "signup-2", url: "https://example.com/signup/details", kinds: ["process_step"] },
    ],
  };
}
