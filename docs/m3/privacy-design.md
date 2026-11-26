# M3 privacy-sweep design

Kickoff step 2, for Codex's review before anything is built (Q66 item 8). Written against `306153c`. Read from the code, not from memory: every file and function named below was opened. Where I could not settle a point by reading, the text says so.

Terms. **Editable box**: an element with `contenteditable` other than `false`, or a first `role` attribute whose tokens include one of `src/engine/editable-box.json` (`textbox`, `searchbox`, `combobox`), or any element of a document in `designMode` (Q56, Q61). **Form field**: `input`, `textarea`, `select` and their options. **Editable context**: the element is a form field, is inside an editable box in the flat tree, or sits in a document hosted (at any depth) by a frame element in an editable context (Q63). **Mask**: replace by `[redacted]` (`MASK` in `src/engine/sanitise.ts`) and count.

## 1. Inventory

Every route by which text from a page, a URL, an error or the sample reaches the run folder (today: `run.json` only) or the console. "Guard" is what applies today. "Test" names the test file that covers the route with a planted value, if any.

### 1.1 Evidence written by checks

The engine sanitises every evidence string in `sanitiseEvidence` (`src/engine/run-checks.ts`): `locator` and `note` through `Sanitiser.text` (URLs, then tokens), `snippet` through `Sanitiser.snippet` (editable boxes by markup, form values, URL attributes, tokens, cap). The fingerprint goes through `text`; error messages through `text` in `errorObservation`. Everything else depends on what the check put in the string.

| # | Source | Field | Guard today | Test | Gap |
|---|---|---|---|---|---|
| E1 | axe adapter: `node.html` (`src/checks/axe/map.ts`, `nodeEvidence`, `untestedFramesOf`) | `snippet` | `guardEditableSnippets` (`src/checks/axe/editable.ts`) wraps the node in its editable ancestor's start tag, across frames and open shadow trees; unresolved nodes wrapped and listed in `UNRESOLVED`; then `Sanitiser.snippet` | `tests/checks/axe/editable-resolved.test.ts`, `tests/engine/editable-role-ancestors.test.ts` | Form-field context is left to markup: `<option>` text and `selected`/`checked` state are kept (see 2.1). |
| E2 | axe adapter: `node.target` (`locatorOf`) | `locator` | `Sanitiser.text` only | none | Selectors can carry ids, classes and attribute values of elements inside an editable box. No editable guard. |
| E3 | axe adapter: `failureSummary` or check messages (`messagesOf`) | `note` | `Sanitiser.text` only | none | axe messages interpolate data from the node (attribute values, duplicate id values). Not guarded for editable context. |
| E4 | axe adapter: pass lists (`mapRule`, up to `passLocatorCap` locators) | `locator` (JSON array) | `Sanitiser.text` | none | As E2, for up to 25 elements per rule. |
| E5 | axe adapter: `faultFingerprint` | `fingerprint` | `Sanitiser.text` (no effect on a hex digest) | none | 64-bit SHA-256 prefix of the **raw** `node.html`, `value` attributes included. A short value can be confirmed by guessing. Not a byte leak; a derived one. |
| E6 | axe adapter: frame gaps (`src/checks/axe/frames.ts`, `info.frame.url()`) | `note` | `Sanitiser.text` (query and fragment masked) | `tests/engine/sanitise.test.ts` (rule only) | Path segments kept, as spec 8.7 says. |
| E7 | Family A, 8.3.1 witness (`src/checks/custom/family-a/page/witness.js`, `test`) | `snippet`, `locator` | Editable and field text is never a witness (`editableAttr`, `fieldElement`); elements with any `role` are not entered (`FORBIDDEN`); main document only | `tests/engine/editable-role-ancestors.test.ts` (8.3.1 case), `tests/checks/custom/8-3-default-lang-present/8-3-default-lang-present.test.ts` (`designMode` case) | `startEditable` looks for `contenteditable` above `body` but not for a textbox role (`<html role="textbox">`). The snippet is `C.openTag(parent) + text`, not passed through `guardEditable`. Edge case; the harness plants it. |
| E8 | Family A, 8.5.1 title (`title-main.js`) | `snippet` | `C.guardEditable` (`family-a/page/common.js`: `contenteditable`, roles, `designMode`, flat tree) | `tests/engine/editable-frame-context.test.ts` (framed title) | None found. Family A builds no snippet from framed documents (`frame-doc.js`, `family-a/frames.ts` return facts only), so Q63 inheritance has nothing to act on there today. |
| E9 | Family A, 8.2.1 duplicate ids (`ids.js`; `8-2-id-duplicate/index.ts`) | `snippet` (`C.openTag`), `locator` (`C.locator`), `note` (id value) | `Sanitiser` only | none | Start tag and id of elements inside an editable box are written. The id value is also in the note. |
| E10 | Family A, 8.4.1 (`8-4-default-lang-code-valid/index.ts`) | `snippet` (`html` start tag), `note` (`lang` value) | `Sanitiser` only | none | Only the root element's attributes. Reachable only if `html` itself is an editable box; harness row. |
| E11 | Family B, 10.1.1 and 10.1.2 (`family-b/scan.ts` `record`, `closed-shadow.ts`) | `snippet` (`startTag(el)`), `locator`, `note` (element and attribute names) | `Sanitiser` only; **no editable guard at all** | none | Rich-text editors produce `<font>`, `align`, `<center>` inside `contenteditable`. The start tag carries every attribute of that element. Covers tree, shadow (closed included), `template` content and `noscript` text. |
| E12 | Family C, 2.1.1, 6.2.1, 11.1.1, 11.8.2 (`family-c/scan.js` `snippetOf`, `guardEditable`) | `snippet` (`outerHTML`, wrapped) | `guardEditable` + `documentEditable` with `arg.host.editable` from the frame chain (`family-c/read.ts`, `hostFacts`; unknown host counts as editable) | `tests/engine/editable-role-ancestors.test.ts`, `tests/engine/editable-frame-context.test.ts`, `tests/engine/editable-privacy.test.ts` | `select` snippets (11.8.2) keep `<option>` text (2.1). |
| E13 | Family C locators (`locatorOf`, `selectorIn`) and frame prefixes (`read.prefix`) | `locator` | `Sanitiser.text` | none | Ids of elements inside an editable box. |
| E14 | Family C notes (`family-c/result.ts`: frame URLs, `u.reason`, `v.branch`) | `note` | `Sanitiser.text` | none | `u.reason` holds an evaluation error message (see E16). |
| E15 | Family C fingerprints (`descriptorOf`: tag, type, role, two classes, iframe `src` origin and path) | `fingerprint` | `Sanitiser.text` | none | Path of a framed URL and class names of elements inside an editable box. |
| E16 | Any provider: thrown or returned error messages (`runProvider`, `toObservation`) | `error.message` | `Sanitiser.text` | none | An evaluation error can carry text the page controls (a page can replace DOM methods and throw its own message). Pattern masking only. |

### 1.2 Records the engine writes itself

| # | Source | Field | Guard today | Test | Gap |
|---|---|---|---|---|---|
| R1 | Sample URLs (`sanitiseSample`, `src/engine/run-file.ts`) | `sample.pages[].url`, `expect.url`, `navigate` steps, `documents[].url` | `Sanitiser.url` | `tests/engine/sanitise.test.ts` (schema validity) | None for URLs. |
| R2 | Rest of the sample copy: names, ids, `fill` values, locators, `session.storageState` path | `sample.*` | None, by spec 8.7 ("stored as written") | none | Policy, not a bug: the harness asserts that these values appear in the sample copy and nowhere else. The storage-state path may carry a home-folder user name. |
| R3 | Sample warnings (`plugin.checkSample`) | `sampleWarnings` | None; only ids from the sample | none | None. |
| R4 | `TargetExecution` URLs (`establishTarget`, `src/engine/target.ts`) | `requestedUrl`, `effectiveUrl` | `Sanitiser.url` | none at run level | A redirect target's query is masked; its path is kept. |
| R5 | `TargetExecution.steps[].error` | `steps` | Not reachable: `establishTarget` refuses non-`initial` targets and writes `steps: []` | — | **Enters at kickoff step 4.** Playwright errors carry the locator, the URL and a call log that can print the resolved element's markup (`<input value="…">`). |
| R6 | `TargetExecution.expect` | `expect` | Booleans only; not reachable (always `declared: false`) | — | Enters at step 4. Booleans; the `visible` locator stays in the sample copy (R2). |
| R7 | Not-established reason (`establishTarget`, `firstLine` then `Sanitiser.text`) | console messages (`RunAuditResult.messages`); **run file from Q66 item 7** | `Sanitiser.text` | none | Becomes a run-file field in M3. |
| R8 | Manifest (`runAudit`) | `manifest` | No page text: versions, OS, locale, timeouts, options, sample hash, times | none | None. |
| R9 | Statements, findings, reduced results | — | Ids, enums and counts only | none | None. |
| R10 | Evidence files and screenshots | `evidenceFiles`, `Evidence.file`, `sha256` | Not reachable: `evidenceFiles: []`, `file` unset (`RawEvidence` omits it) | — | **Enters at step 6.** File names must come from target and evidence ids, never from page text or URLs. Pixels are a new channel (4.6). |
| R11 | Model payload | — | Not reachable: `parseSample` refuses `model.enabled: true`; no model client exists | none at run level | Stays refused in M3 (Q66 item 3). |

### 1.3 Console and files outside the run file

| # | Source | Channel | Guard today | Test | Gap |
|---|---|---|---|---|---|
| C1 | `parseSample` JSON error (`src/engine/sample.ts`) | stderr via `auditCommand` / `checkSampleCommand` | **None** | none | V8's `JSON.parse` message quotes an excerpt of the input. A URL with a token in an invalid sample is printed as is. |
| C2 | `parseSample` schema issues | stderr | None | none | Zod issue messages; I did not confirm whether the installed zod quotes received values. The harness plants one. |
| C3 | `runAudit` messages: target ids, observation counts, not-established reasons, run-file path | stdout | R7 for reasons; ids are the user's own | none | None beyond R7. |
| C4 | `src/cli/main.ts` internal error | stderr | **None**: prints `e.stack` | none | Any error that escapes `runAudit` (a Playwright failure in `newContext`, `EngineBugError` with `JSON.stringify(derived.rejections)`, `writeRunFile`'s validation issues) is printed raw. I did not read the rejection payload's shape. |
| C5 | `check-sample` output (`describeWarning`) | stdout | Ids from the sample | none | None. |
| C6 | Playwright's own logging (`DEBUG=pw:*`) | stderr | Outside the tool | — | Out of scope; stated in 5. |
| C7 | Storage-state file (M3) | — | Not reachable (`parseSample` refuses `session`) | — | **Enters at step 5.** Never copied, never printed: a missing, unreadable or invalid file is reported by path and error code only, never by `JSON.parse`'s message (C1's trap again). |

## 2. Contexts

### 2.1 How today's guards decide

| Context | Sanitiser (markup) | axe guard | Family A | Family B | Family C |
|---|---|---|---|---|---|
| `input` `value` attribute | masked | via sanitiser | not a witness | start tag kept, value masked by sanitiser | via sanitiser |
| Live field value (typed, autofilled) | not in markup | not in markup | — | — | — |
| `textarea` content | masked | via sanitiser | not a witness | — | via sanitiser |
| `placeholder` | kept | kept | — | kept | kept |
| `<option>` text, `selected`, `checked` | **kept** (only `option[value]` masked) | kept | not a witness (`select` is a field) | kept | kept |
| `contenteditable` (not `false`) | masked | resolved | guarded | **none** | guarded |
| Textbox roles | masked | resolved | guarded (8.5.1); not entered (8.3.1) | **none** | guarded |
| `designMode` own document | — (markup cannot show it) | resolved | guarded | **none** | guarded |
| Open shadow tree | markup has none | resolved (shadow-piercing target) | flat tree in `guardEditable`; 8.3.1 does not enter shadow hosts | walked, unguarded | flat tree, guarded |
| Closed shadow tree | — | axe does not enter it | 8.3.1 excludes text under closed hosts | walked through CDP (`closed-shadow.ts`), unguarded | registered through CDP and scanned; `host` walk works upward |
| Slots, assigned nodes | — | `assignedSlot` first | `assignedSlot` first | — | `assignedSlot` first |
| Same-origin frame | — | frame chain via `levelOf` | no snippets from frames | top-level document only (notes say so) | host chain via `hostFacts` |
| Cross-origin frame | — | same; Playwright evaluates in it | — | — | same |
| Frame the engine cannot read (`FrameInfo.readable` false) | — | masked, counted in `UNRESOLVED` | — | — | host unknown, counted as editable |

The live value of a field never appears in markup, so no snippet carries it. It does reach the accessibility tree (a textbox's value; a link's name computed from an `input` inside it). No check writes an accessibility name into evidence today, by my reading; the harness plants one so that a future check that does is caught.

**A definition question for Codex.** The spec drops "values of form fields". The sanitiser masks `option[value]` but keeps the option's text and the `selected` attribute, which together say what the user chose on a page examined with a session. I propose: inside `select`, mask every `option`'s content and drop `selected`; drop `checked` on `input`; keep `placeholder` (author text, not a value). This touches only the snippet rule.

### 2.2 Combinations

The rule is transitive: one editable link anywhere in the chain (element, flat-tree ancestors, hosting frame elements up to the top) puts the element in editable context. Today's guards implement that for the axe adapter and family C. The harness covers these combinations, each with a control:

1. Editable host > open shadow root > slot > link (axe and family C).
2. Editable host > iframe (same-origin, cross-origin) > link.
3. Editable host > iframe > iframe > open shadow root > link.
4. Plain iframe in a `designMode` document > link (inherited), and a framed document itself in `designMode` (gate item 16).
5. `contenteditable="false"` island inside an editable box: still inside the box by the sanitiser's rule (outermost box wins), so masked. The other guards agree (they take the outermost ancestor). Stated so nobody "fixes" it.
6. Closed shadow root under an editable host; editable host inside a closed shadow root.

**What no guard can resolve.**
- An axe node whose target does not lead to exactly one element (`frameElementExpression` needs one match; `candidates` may find none). Masked and counted.
- A frame the engine marks unreadable (detached, never loaded, evaluation failed or timed out in `probeFrame`), or a frame created after `collectFrames` ran: its Frame object is not in `ctx.frames`, so `readable.has(child)` is false. Masked (axe) or host unknown (family C).
- Pages that defeat the in-page scripts (replaced `getAttribute`, `attachShadow` patched). Results are then wrong in either direction; masking holds only where the script fails loudly.
Closed shadow roots and cross-origin frames are **not** in this list: CDP and Playwright reach both. The limit is the in-page selector route, not the browser.

**reCAPTCHA (gate item 13).** By reading, three causes fit: a non-unique frame selector, the anchor frame re-navigating after `collectFrames`, or a probe timeout on a slow third-party frame. I cannot tell which without the page, and M3 forbids real sites for builders. The harness reproduces each with a cross-origin fixture; the build fixes the cause the fixtures show (most likely: resolve the frame element by Playwright's `frameElement()` from `ctx.frames`, or refresh the frame list, instead of re-querying by selector). Until a fixture proves a node resolved, the snippet stays masked.

## 3. Where the guard lives

### 3.1 The options

**(a) Today.** Four in-page copies of the predicate (`axe/editable.ts` `libSource`, `family-a/page/common.js` `guardEditable`, `family-a/page/witness.js` `editableAttr`, `family-c/scan.js` `editableAncestor`) plus the markup predicate in `sanitise.ts` `isEditableBox`. They share only the role list. Each guards snippets only. Family B has none. Five holds came from this shape (Q56, Q60 to Q63), one route at a time; the inventory finds more of the same kind (E2 to E4, E7, E9, E11, E13).

**(b) One engine guard.** After a provider returns and before `toObservation`, the engine resolves each evidence item's element in the live page and applies one rule. It needs a reference per item. It masks what it cannot resolve.

### 3.2 What (b) needs

- **From each check: a node reference per `dom_node` item**, one of:
  - `{ frame, handle }`: a Playwright `ElementHandle` (family C and family A already hold one or can return one);
  - `{ frame, backendNodeId }`: from CDP (8.3.1, family B closed roots, family C exposure);
  - `{ axeTarget }`: the engine resolves it as `guardEditableSnippets` does now (moved to the engine).
  Pass lists (E4, family C `no_fault`) need one reference per listed locator.
- **No frame chain from the check.** The engine has `ctx.frames` and walks frame elements itself, as `hostFacts` and `levelOf` do now.
- **`src/checks/types.ts` changes** (orchestrator-owned; the kickoff lets the builder make and log it): `RawEvidence` gains `ref?: NodeRef` (and `refs?: NodeRef[]` for lists). The engine strips them before validation, so the run file never sees them.
- **No frozen-schema change.** `EvidenceSchema` already has `locator`, `snippet`, `note`, `redactions`. Resolution failures go into `note` text and `redactions`. Q66 item 7 (not-established reason) is already authorised; nothing else is needed.

### 3.3 The rule the engine applies

For an item in editable context, or whose context is unknown:
- `snippet`: the box's start tag (or a neutral `<div contenteditable="true">` for `designMode`, frame inheritance or unknown) followed by `MASK`. The sanitiser then counts it as today.
- `locator`: the box's locator, built by the engine, followed by ` >> [redacted]`. For unknown context, the check's locator is replaced by `[redacted]`.
- `note`: replaced by a fixed engine note ("Element in an editable box: snippet, locator and note masked." or "…context could not be resolved…"). The check's note is dropped, because the engine cannot tell its page-derived parts from its own.
- Outcome and fingerprint are not touched by the engine.

Items without an element (`scope_examined`, `text`) keep today's treatment. A `dom_node` item with no reference is treated as unknown and masked, so a check that forgets a reference fails closed and the harness's controls catch the over-masking.

### 3.4 Effects

- **Check versions.** Every check that adds references or loses its in-page guard changes version: the axe adapter (`ADAPTER_VERSION`), families A, B and C. Outcomes do not change. Nothing is enabled (Q66 "Not covered"), so no effective level drops; the working set is rerun at step 11.
- **Records.** Not changed. The rule is about evidence, not about what a check decides. One check-side fix is needed anyway: E5, hash the sanitised snippet instead of the raw `node.html` (axe adapter version bump, display-only grouping).
- **Over-masking (gate item 15).** Token masking is separate from editable context. The `base64` pattern masks 32+ mixed-case alphanumeric runs, which hits CSS-module and hashed class names in locators. The harness measures it with controls (4.2). I propose no change before the measurement; if controls fail, the candidate fix is to exempt only locator segments after `.` or `#` that match a known generated-name shape **and** stay below a length bound, never in snippets or notes. That is a judgement call for Codex.
- **reCAPTCHA (gate item 13).** (b) moves the axe resolution into the engine; the fix of 2.2 lands there once.
- **Screenshots (Q66 item 4).** The same engine module exports `editableRegions(target)`: every form field and editable box in every frame, through CDP (`DOM.getDocument` with `pierce: true` per frame session, then `DOM.getContentQuads`), with frame offsets; a document in editable context contributes its frame element's box. It returns `complete: false` when any frame is unreadable, a CDP session fails, or a region has no quads while rendered. `complete: false` means no screenshot (Q66). One predicate serves both the evidence rule and the screenshot regions.

### 3.5 Recommendation

**A hybrid that converges on (b).** One predicate and one resolver, in `src/engine/editable-context.ts`, used by the engine on every `dom_node` item and by screenshots. Its in-page predicate is exported as one source string and handed to checks that must decide context while they examine (8.3.1's "never a witness" is a decision, not a mask: it stays in the check, using the shared predicate). The four snippet guards are removed in the same build, so there is one definition and one place that writes masks. The sanitiser's markup rule stays as a second layer: it costs nothing and catches snippets built from markup that already carries the box.

Reasons: it ends the one-route-at-a-time pattern by making the engine fail closed for every check, present and future; it covers locators and notes, which no current guard touches; it gives screenshots the same definition for free; and it needs no frozen-schema change.

Cost: every provider changes to return references (medium for axe, family C and family A; small for family B), and the engine gains a resolver (medium). Risk: a reference that resolves to the wrong node. The harness's controls catch over-masking; the planted markers catch under-masking.

## 4. The harness

### 4.1 Shape

- **Fixtures.** Synthetic pages served by `serveFixture` (`src/engine/testing/index.ts`) on both origins (`127.0.0.1` main, `localhost` cross via `__CROSS_ORIGIN__`). Pages are grouped so each one triggers the checks that will carry its markers (a link with `aria-hidden` content for 6.2.1 and `axe/link-name`; duplicate ids for 8.2.1; `<font align>` for 10.1; a `select` with an unlabelled `optgroup` for 11.8.2; an unlabelled field for 11.1.1; an untitled iframe for 2.1.1; a page without `lang` for 8.3.1; and so on).
- **Run.** The real `runAudit` with `allProviders()`, one sample per group, written into a fresh temporary folder; plus `runCli` with captured `out`/`err` for the CLI routes (C1 to C5), and one child-process run of `src/cli/main.ts` for C4.
- **Search.** Every file under the run folder (recursive, as bytes), plus captured stdout and stderr. Each marker is searched in its raw form, percent-encoded, HTML-escaped, and as its first 12 characters (a snippet cap can cut it). Markers are lowercase ASCII letters and hyphens, under 32 characters, with no digits, so JSON escaping is the identity and token masking never hides them by accident. Token-channel markers are the exception: they are built token-shaped on purpose.
- **Reach.** Absence alone proves nothing: a marker in an element no check reports is trivially absent. Every sensitive marker has a **carrier**: a non-secret id or attribute on the same element whose evidence item must be present in the run file, with `redactions > 0`. A missing carrier fails the case as "not reached".
- **Controls.** The same structure outside any editable context, with its own markers, which must appear in the stated field. A guard that masks everything fails the controls.

### 4.2 Expectation table (M3 step 3)

Places: **Obs** = observation evidence; **Tgt** = `TargetExecution`; **Smp** = sample copy; **Out** = stdout/stderr; **none** = nowhere in the run folder or the console.

| Marker | Context | Channel | Allowed |
|---|---|---|---|
| `qx-ce-snippet` | link text in `contenteditable` | snippet (axe, 6.2.1) | none |
| `qx-ce-attr` | `title` on `<font>` in `contenteditable` | snippet (10.1), axe note | none |
| `qx-ce-id` | duplicate id inside `contenteditable` | locator, snippet, note (8.2.1, axe) | none |
| `qx-role-tb`, `qx-role-sb`, `qx-role-cb` | link in each textbox role | snippet | none |
| `qx-html-role` | text in `<html role="textbox">`, no `lang` | 8.3.1 snippet | none |
| `qx-dm-own` | link in a framed document in `designMode` | snippet | none |
| `qx-dm-host` | link in a plain frame of a `designMode` document | snippet | none |
| `qx-shadow-open` | link in open shadow root of a role host | snippet, locator | none |
| `qx-shadow-closed` | `<font>` in a closed shadow root under `contenteditable` | snippet (10.1) | none |
| `qx-slot` | slotted link, role host with a slot | snippet | none |
| `qx-frame-same`, `qx-frame-cross` | link in a same-origin / cross-origin frame under a role host | snippet, locator | none |
| `qx-frame-nest` | editable > frame > frame > shadow > link | snippet | none |
| `qx-frame-late` | link in a cross-origin frame that re-navigates after load | snippet | none (masked as unknown) |
| `qx-frame-dup` | link in one of two frames with the same selector | snippet | none |
| `qx-val-input` | `input value` | snippet (11.1.1, axe) | none |
| `qx-val-textarea` | `textarea` content | snippet | none |
| `qx-val-option`, `qx-val-selected` | option text and `selected` (2.1 proposal) | snippet (11.8.2) | none if 2.1 is accepted; else Obs |
| `qx-val-live` | value typed by a page script into an input inside a link | accessibility name, any note | none |
| `qx-placeholder` | `placeholder` | snippet | Obs (control-like; author text) |
| `qx-url-query`, `qx-url-frag` | sample URL query and fragment | Smp, Tgt, Out | none (masked) |
| `qx-url-path` | sample URL path segment | Smp, Tgt | Smp, Tgt, Out |
| `qx-redirect-query` | query of a redirect target | `effectiveUrl` | none |
| `qx-frame-src-query` | query in an iframe `src` | snippet, note, fingerprint | none |
| `qx-fill-value`, `qx-locator` | sample `fill` value, sample locator | sample copy | Smp only |
| `qx-sample-json` | inside a deliberately invalid sample | Out (C1) | none |
| `qx-sample-enum` | invalid enum value in a sample | Out (C2) | none |
| `qx-error-page` | message thrown by a page-patched DOM method | `error.message`, notes | none (pattern masking does not catch this: expected to fail today; see 5) |
| token markers (JWT, `sk_live_…`, hex, base64, `password=`) | page text outside any box | snippet, note, locator | none (masked) |
| `qx-plain-link` (control) | link text, no editable context | snippet | Obs |
| `qx-plain-id` (control) | duplicate id, no editable context | locator, snippet, note | Obs |
| `qx-plain-frame` (control) | link in a plain cross-origin frame | snippet | Obs |
| `qx-plain-font` (control) | `<font title>` outside any box | snippet | Obs |
| generated names (control, item 15) | `class="Button_primary__a1B2c3D4e5F6g7H8i9J0kLmN"`, `sc-` names, Tailwind arbitrary classes | locator | Obs (measured; today's rule may mask them: reported, not hidden) |

Gate item 16 is in the table (`qx-dm-own`, `qx-frame-nest`, and every framed row reports nodes whose axe target has more than one entry). The reCAPTCHA causes are `qx-frame-late`, `qx-frame-dup` and a slow-frame variant of `qx-frame-cross`.

### 4.3 Model payload

`model.enabled: true` gives exit 2 with the `parseSample` message; the harness also asserts that no module under `src/` imports a model SDK or opens a connection to a non-fixture host during the run (a context route that records every request outside the two fixture origins, as `blockedRequests` already does for check tests).

### 4.4 Steps and `expect` (step 10, after step 4)

- A `fill` step on a field whose value is `qx-step-fill`, then a failing `click` on a locator whose element carries `qx-step-markup` in a `value` attribute: the step error (R5) may hold the locator as written (Smp marker) but neither the value nor the resolved element's markup.
- A navigation error on a URL with `qx-step-query`: masked in `steps[].error`.
- `expect.visible` on an element whose text is `qx-expect-text`: booleans only in Tgt.
- A state whose steps type into a `contenteditable` (`qx-step-typed`): none.

### 4.5 Saved sessions (step 10, after step 5)

A **synthetic** storage-state file generated by the harness into its temporary folder, never a real one, with `qx-ss-cookie`, `qx-ss-local`, `qx-ss-origin` in its values. The fixture server reads the synthetic cookie and serves personal content.
- **Case 1, spec 8.7: a public page showing personal content when logged in.** The page, marked `authenticated`, shows `qx-pers-text` (ordinary text: allowed in Obs under Q66 item 5), `qx-pers-value` (field value: none), `qx-pers-token` (token-shaped: none). The same page without the session must not show any of them.
- **Case 2: a state that navigates to an account page.** The state's steps lead to `/account?ref=qx-acct-query`; `sessionLoaded` is true; `qx-acct-query` masked everywhere; `qx-pers-text` allowed in Obs only.
- Storage-state markers: none, anywhere. The file's path: Smp only.
- Error cases: missing file, unreadable file, invalid JSON containing `qx-ss-badjson`: exit 2, path and error code in Out, the marker nowhere.

### 4.6 Screenshots (step 10, after step 6)

Byte search cannot see pixels. Each sensitive region is painted in a unique solid colour (fields and boxes in one colour, a control block in another). The harness decodes each screenshot and asserts: no pixel of the sensitive colour; the control colour present; `capture.mask` regions black. It also byte-searches the PNG (metadata chunks) and checks file names (target and evidence ids only). A target with an unreadable frame gets no screenshot; a target examined with the session gets none unless `capture.screenshots: true`; a target not established gets none.

### 4.7 Failure reports

A failure names the marker, the file (path relative to the run folder, or `stdout`/`stderr`), the byte offset, and, for JSON files, the JSON pointer of the enclosing string. It never prints the bytes around the match. The harness writes nothing outside its temporary folder, and deletes the folder on success; on failure it keeps it and prints its path.

## 5. Limits

- Pattern and marker tests cannot show that no secret ever reaches the run folder (spec 8.7). They show that the planted contexts and channels behave as stated.
- Derived channels are invisible to byte search: the fingerprint hash (E5), counts, lengths, and any value that only influences an outcome. E5 is fixed in code, not tested.
- Page-controlled error messages (E16, `qx-error-page`) are only pattern-masked. I expect that row to fail today; the build either replaces page-originated messages with fixed text, or the row is accepted as a known weak point by Fabien.
- Pages that patch DOM methods can make any in-page script lie. The harness tests one such page (E16); it does not prove robustness against hostile pages.
- The live value of a field in the accessibility tree: no check writes it today; the harness can only catch a future check that does, on the planted pages.
- Playwright debug logging (C6) and anything the user's shell records are outside the tool.
- Real third-party frames (reCAPTCHA) are reproduced by structure, not by the real page; the live run of Q66 item 6 is the only real check, and it is logged out.

## 6. Build plan (kickoff step 3)

One writer per directory. The fixture and expectation writer never writes the guard code (10.5).

| Part | Owner (directory) | Writer | Size |
|---|---|---|---|
| 1. Harness runner: run folder and console capture, byte search, carriers, failure report | `tests/privacy/` (runner only) | test agent A | medium |
| 2. Planted fixtures and the expectation table as data | `tests/privacy/fixtures/` | test agent A (does not touch `src/`) | large |
| 3. Run the harness on today's code; record what fails | — | orchestrator | small |
| 4. `editable-context.ts`: predicate, frame-chain resolver, axe-target resolver (moved from `axe/editable.ts`), evidence rule; `types.ts` `ref`; `run-checks.ts` hook; sanitiser option rule (2.1, if accepted); C1, C4 fixes; item 13 fix | `src/engine/`, `src/checks/types.ts` | core builder B | large |
| 5. Providers return references; in-page snippet guards removed; 8.3.1 uses the shared predicate; E5 fingerprint; version bumps | `src/checks/` | builder C, after part 4's interface is merged | medium |
| 6. Rerun the harness; item 15 measurement to Codex; fix rounds | — | orchestrator, then B or C | small to medium |
| 7. Extensions of 4.4 to 4.6, with steps 4 to 6 | `tests/privacy/` | test agent A | medium |

Parts 1 and 2 run in parallel with part 4. Part 5 waits for part 4's `types.ts` change. Existing tests in `tests/engine/editable-*.test.ts` and `tests/checks/axe/editable-resolved.test.ts` stay and must keep passing; where a guard moves, their assertions on the saved run file still hold.
