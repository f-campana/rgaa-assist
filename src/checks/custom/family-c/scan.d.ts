/** Types of `scan.js`, the in-page reader of family C. */

/**
 * What could hide an element that the visibility helper cannot measure (Q59: visibility needs
 * positive evidence). See `geometry` in `scan.js`.
 */
export type Unmeasured = "clip-path" | "off-chain" | "mask" | "filter" | "opacity" | "transform" | "fixed" | "no-scroll" | "partial-frame";

/** What the caller knows about the frame elements that host this document. */
export interface HostChain {
  /** False when a hosting frame element could not be read: nothing in the document may be faulted. */
  known: boolean;
  notRendered: boolean;
  ariaHidden: boolean;
  inert: boolean;
  opacityZero: boolean;
  /** false: no part at least 4 px square visible; null: unknown (see `unmeasured`). */
  visible: boolean | null;
  /** Why `visible` is null, over every hosting frame element. */
  unmeasured: Unmeasured[];
  /** A hosting frame element is shown only in part (something cuts its box). */
  partial: boolean;
  /** The frame element hosting this document turns scrolling off (scrolling="no"). */
  frameNoScroll: boolean;
}

export interface ScanArg {
  /** `Symbol.for(key)` on `globalThis` holds closed shadow roots and the accessibility look-ups. */
  key: string;
  frameIndex: number;
  /** The host chain of the document scanned (in host mode: of the frame element's document). */
  host: HostChain;
  snippetMax: number;
}

/** Facts about one frame element (iframe, frame, object, embed) as a host. */
export interface HostFacts {
  locator: string;
  notRendered: boolean;
  ariaHidden: boolean;
  inert: boolean;
  opacityZero: boolean;
  /** false: no part at least 4 px square visible; null: unknown (see `unmeasured`). */
  visible: boolean | null;
  unmeasured: Unmeasured[];
  /** Nothing cuts the frame element's box. */
  whole: boolean;
  /** Its scrolling attribute turns scrolling off in the hosted document. */
  noScroll: boolean;
}

export interface ElementBase {
  locator: string;
  snippet: string;
  descriptor: string;
}

export interface FrameElementRecord extends ElementBase {
  title: "absent" | "blank" | "text";
  ariaHidden?: boolean;
  notRendered?: boolean;
  inert?: boolean;
  /** Index in the frame's accessibility look-up list, or null when no look-up was asked. */
  ax?: number | null;
}

export interface LinkRecord extends ElementBase {
  name: "name" | "pua" | "empty";
  isAnchorWithHref: boolean;
  notRendered?: boolean;
  ariaHidden?: boolean;
  inert?: boolean;
  blocking?: boolean;
  altUncomputed?: boolean;
  generated?: boolean;
  attributeName?: boolean;
  ax?: number | null;
}

export interface FieldRecord extends ElementBase {
  /** `field`, or `never:<why>` for elements the record says are cannot_tell, never fault. */
  cls: string;
  notRendered?: boolean;
  ariaHidden?: boolean;
  inert?: boolean;
  mechanisms?: {
    ariaLabelledby: boolean;
    ariaLabel: boolean;
    title: boolean;
    labelsList: boolean;
    labelAncestor: boolean;
  };
}

export interface SelectRecord {
  locator: string;
  snippet: string;
  inForm: boolean;
  notRendered: boolean;
  ariaHidden: boolean;
  inert: boolean;
  opacityZero: boolean;
  /** false: no part at least 4 px square visible; null: unknown (see `unmeasured`). */
  visible: boolean | null;
  /** Why `visible` is null (on the select, an ancestor or a hosting frame element); empty otherwise. */
  unmeasured: Unmeasured[];
  ax: number | null;
}

export interface OptgroupRecord extends ElementBase {
  select: number;
  parentIsSelect: boolean;
  hiddenAttr: boolean;
  displayNone: boolean;
  ariaHidden: boolean;
  inertAttr: boolean;
  legendChild: boolean;
  hasLabel: boolean;
}

export type Part<T> = { ok: true; value: T } | { ok: false; error: string };

export interface ScanResult {
  url: string;
  frames: Part<FrameElementRecord[]>;
  links: Part<LinkRecord[]>;
  fields: Part<FieldRecord[]>;
  optgroups: Part<{ selects: SelectRecord[]; groups: OptgroupRecord[] }>;
  axCount: number;
}

export declare function familyC(arg: ScanArg): ScanResult;
export declare function familyC(element: unknown, arg: ScanArg): HostFacts;
