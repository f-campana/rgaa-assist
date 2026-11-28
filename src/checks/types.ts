/**
 * The check interface (spec 5, 5.1, 8.3, 8.5). Fixed by the M2 orchestrator
 * before builders work in parallel. Changing it goes through the orchestrator,
 * like the ruleset contract (14.2).
 *
 * A check knows nothing about rulesets (5.1). It examines one established
 * target and says what it saw, under a stable check id from the registry
 * (`src/rulesets/rgaa-4.1.2/checks.json`). The engine turns each result into
 * an `Observation` (8.5): it numbers the evidence, passes every string through
 * the sanitiser (8.7), records the effective options and validates the result
 * against `ObservationSchema`. A check never writes to disk and never sends
 * anything anywhere.
 *
 * M2 runs read-only checks only, on the `initial` target only. A check must
 * not change the page: no clicks, no focus moves, no scrolling, no style or
 * DOM changes that outlive its own evaluation, no navigation.
 *
 * Types only. The engine implements the context (`src/engine/`); each check
 * family implements providers (`src/checks/axe/`, `src/checks/custom/`).
 */
import type { CDPSession, Frame, JSHandle, Page } from "playwright";
import type { CheckId, Evidence, Outcome } from "../schema/index.ts";

/**
 * Evidence as a check returns it. The engine assigns `id` (unique inside the
 * observation) and `redactions` (counted by the sanitiser). Strings are raw:
 * the engine sanitises `locator`, `snippet` and `note` before anything is
 * written. `file` and `sha256` stay unset in M2 (screenshots are off).
 */
export type RawEvidence = Omit<Evidence, "id" | "redactions" | "file" | "sha256">;

/** What a check concluded on one target. */
export interface CheckResult {
  /**
   * Meanings fixed by spec 8.3 and `ObservationSchema`:
   * - `fault`: carries at least one evidence item that lets a human find the element (locator and snippet).
   * - `no_fault`: at least one element in scope examined, none faulty. Carries `scope_examined` evidence: how many, and a capped list of locators.
   * - `inapplicable`: the whole scope examined, nothing in scope. Carries `scope_examined` evidence: what was searched for and in which frames.
   * - `cannot_tell`: the check abstains; evidence says why.
   */
  outcome: Exclude<Outcome, "error">;
  evidence: RawEvidence[];
  /**
   * The same fault elsewhere gives the same value (8.5). Built from the check
   * id and a description of the fault that does not depend on the page's
   * address or on generated ids: for example `custom/8-2-id-duplicate:id=formulaire`.
   * For outcomes other than `fault`, the check id followed by the outcome.
   */
  fingerprint: string;
  /**
   * M3 (privacy design 3.2), optional until providers emit sources (build
   * part 5): evidence and fingerprint as references and typed derivations.
   * The engine reads, judges and writes every page-derived piece itself
   * (`src/engine/editable-context.ts`). Not yet read by `run-checks.ts`.
   */
  sourced?: SourcedResult;
}

/**
 * A check that could not run, or could not read part of its scope.
 * `scope_unreadable` when part of the scope could not be read (a frame the
 * engine could not enter, for example) and the check's record does not say to
 * answer `cannot_tell` in that case; otherwise `check_error`. A provider that
 * throws gives `check_error` for each of its checks; the engine records the
 * message after sanitising it.
 */
export interface CheckFailure {
  outcome: "error";
  kind: "check_error" | "scope_unreadable";
  message: string;
}

export type CheckRunResult = CheckResult | CheckFailure;

/** One frame of the target, as the engine found it when it began examining. */
export interface FrameInfo {
  frame: Frame;
  /** `null` for the main frame. */
  parent: FrameInfo | null;
  /** The frame's origin differs from the main frame's origin. */
  crossOrigin: boolean;
  /**
   * The engine could run a script in this frame (Playwright reaches
   * cross-origin frames too). `false` with `unreadableReason` when it could
   * not: detached, never loaded, or the evaluation failed.
   */
  readable: boolean;
  unreadableReason?: string;
}

/** What the engine gives a provider for one target. */
export interface CheckContext {
  /** `<pageId>/initial` in M2. */
  targetId: string;
  /** The established page. Its context is fresh and carries no saved session (7.4). */
  page: Page;
  /** Every frame of the page, main frame first, then in document tree order (depth first). */
  frames: readonly FrameInfo[];
  /**
   * A Chrome DevTools Protocol session attached to the frame's own target:
   * the page's for the main frame and same-process frames, a separate one for
   * an out-of-process (cross-site) frame. For reading the accessibility tree
   * (`Accessibility.getFullAXTree`) and backend node ids. Sessions are owned
   * and detached by the engine. A check must not enable a domain that changes
   * the page's behaviour.
   */
  cdpFor(frame: Frame): Promise<CDPSession>;
  /** Effective options for each check of this provider, by check id. */
  options: ReadonlyMap<CheckId, Readonly<Record<string, unknown>>>;
  /** Aborted when the engine's per-provider timeout expires. */
  signal: AbortSignal;
}

/** One check a provider produces. */
export interface CheckDefinition {
  /** Must exist in the check registry. */
  id: CheckId;
  /**
   * Version of the implementation. Change it whenever the check's behaviour
   * changes: an enabled entry runs as `none` while a linked check differs
   * from the version its corpus cases were measured on (6.3).
   */
  version: string;
  /** Options used when the run gives none. Recorded in the observation and the manifest. */
  defaultOptions: Readonly<Record<string, unknown>>;
  /**
   * M3 (privacy design 3.2): check-owned text, declared before any page
   * exists: note templates, fingerprint labels and enumeration values a
   * sourced result may use. The engine refuses anything not declared here.
   */
  declared?: DeclaredText;
}

/**
 * A unit the engine runs once per target. The axe adapter is one provider
 * for every axe check it supports; a custom check family may group its
 * checks in one provider or give each its own.
 *
 * `run` returns one result per declared check. A declared check with no
 * result in the map is recorded by the engine as `error` (`check_error`,
 * "no result"). A result for an undeclared check id is a bug and is refused.
 */
export interface CheckProvider {
  /** Short, stable, for logs: `axe`, `custom/8-x`. */
  readonly name: string;
  readonly checks: readonly CheckDefinition[];
  run(ctx: CheckContext): Promise<ReadonlyMap<CheckId, CheckRunResult>>;
}

/* M3 sources and derivations (privacy design 3.2). Additions only: nothing
 * here reaches the run file, and no frozen schema changes. */

/**
 * Frame identity (3.3): the Playwright frame and, when known, its CDP
 * `frameId` and its document's `loaderId`. A detached frame, a frame not in
 * `ctx.frames`, or a different `loaderId` is stale.
 */
export interface FrameKey {
  readonly frame: Frame;
  readonly frameId?: string;
  readonly loaderId?: string;
}

/** A reference to one node (3.2): a CDP backend id, a Playwright handle, or an axe target (3.3). */
export type NodeRef =
  | { readonly frame: FrameKey; readonly backendNodeId: number }
  | { readonly frame: FrameKey; readonly handle: JSHandle }
  | { readonly axeTarget: readonly unknown[] };

/** The source of one piece. */
export type Source = { readonly node: NodeRef } | { readonly frame: FrameKey };

/**
 * Snippet shapes (3.2, 3.4a). `outer`, `startTagAndText` and `textRange` are
 * composites. For `startTagAndText` the source is the text node and the start
 * tag is its parent's. For `textRange` the range counts characters of the
 * concatenated text of the source's emitted text nodes.
 */
export type SnippetShape = "outer" | "startTag" | "startTagAndText" | "textRange";

/** One typed derivation, tied to its own source (3.2). */
export type Derivation =
  | { readonly source: Source; readonly kind: "snippet"; readonly shape: "outer" | "startTag" | "startTagAndText" }
  | { readonly source: Source; readonly kind: "snippet"; readonly shape: "textRange"; readonly start: number; readonly end: number }
  | { readonly source: Source; readonly kind: "locator" }
  | { readonly source: Source; readonly kind: "attr"; readonly name: string }
  | { readonly source: Source; readonly kind: "id" }
  | { readonly source: Source; readonly kind: "accname" }
  | { readonly source: Source; readonly kind: "accvalue" }
  | { readonly source: Source; readonly kind: "frameUrl" };

/** A note slot: a number, a declared enumeration value, or a derivation (3.2). */
export type NoteSlot = number | { readonly enumeration: string; readonly value: string } | Derivation;

/** A note as a declared template and its slots (3.2). */
export interface SourcedNote {
  readonly template: string;
  readonly slots: readonly NoteSlot[];
}

/** An evidence item as references and derivations (3.2). */
export interface SourcedEvidence {
  readonly kind: Evidence["kind"];
  readonly snippet?: Derivation;
  readonly locator?: Derivation;
  /** Each member is its own derivation with its own source. */
  readonly locatorList?: readonly Derivation[];
  readonly note?: SourcedNote;
}

/** A fingerprint as a declared label and derived parts (3.6). */
export interface SourcedFingerprint {
  readonly label: string;
  readonly parts: readonly Derivation[];
}

/** The sourced form of a result's evidence and fingerprint. */
export interface SourcedResult {
  readonly evidence?: readonly SourcedEvidence[];
  readonly fingerprint?: SourcedFingerprint;
}

/** Check-owned constants, declared on the definition at load time (3.2). */
export interface DeclaredText {
  readonly templates?: readonly string[];
  readonly fingerprintLabels?: readonly string[];
  readonly enumerations?: Readonly<Record<string, readonly string[]>>;
}
