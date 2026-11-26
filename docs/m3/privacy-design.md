# M3 privacy-sweep design

Kickoff step 2. The first version, `56874a1`, was held by Codex. The second, `a17b64f`, revised it after that hold (Q68) and was held again (`rgaa-m3-privacy-design-review-2-2026-11-26.md`). This third version answers the second hold under Q69. A third Codex review comes before any code (Q69 item 5). Section 9 maps every finding, from both reviews, to its answer.

Code references are to main `797871f`. Its code is the same as `4d4b224`. I opened every file and function named here; where reading could not settle a point, the text says so.

**The main change in this version.** Providers no longer hand page text to the engine. They hand **references and typed derivations**, and the engine reads every page-derived string itself, from the referenced node or frame, at the moment it applies the context rule. A wrong reference then yields the referenced node's own text, judged by that node's own context. It can no longer carry another node's locator or note. Privacy stops depending on the provider choosing the right node or on axe selector identity. Both stay correctness matters, and the engine still withholds when it cannot establish them (3.3).

## 0. Terms

- **Editable box**: an element with `contenteditable` other than `false`; or whose first `role` attribute has a token from `src/engine/editable-box.json`; or any element of a document in `designMode` (Q56, Q61).
- **Form field**: `input`, `textarea`, `select`.
- **Form-field value** (Q68 item 1): an `input`'s `value`; a `textarea`'s content; the text, `label` and `value` of every `option`; the `selected` and `checked` state; any live value; and any accessible name or value computed from a field. The design adds (Q69 item 1) the field's **reflected values**: its live value echoed into its own attributes, locator, note slots or fingerprint parts (2.1).
- **Protected context**: inside an editable box in the flat tree; or content of a form field (an `option`, a `textarea`'s text); or in a document hosted, at any depth, by a frame element in protected context (Q63). The field element itself is not protected context: its derived pieces go through the field rule (2.1).
- **Piece**: one page-derived string in the output (a snippet, a locator, one list member, one note slot, one fingerprint part). Each piece has its own source (3.2).
- **Plain**: the piece's source resolved, its context ruled out as protected, and, for a field, the field rule passed.
- **Withheld**: the piece is replaced by exactly `[redacted]` and counted (3.5).

## 1. Inventory

Every route by which page-derived text reaches the run folder (today, `run.json`) or the console. **Guard** is today's guard; **Test** names a test that plants a value on the route. **Fix** names the section that closes it. Today the engine sanitises evidence strings in `sanitiseEvidence` (`src/engine/run-checks.ts`): `locator` and `note` through `Sanitiser.text`, `snippet` through `Sanitiser.snippet`, the fingerprint and error messages through `text`. Nothing depends on context.

### 1.1 Evidence and fingerprints from checks

| # | Source | Field | Guard today | Test | Gap | Fix |
|---|---|---|---|---|---|---|
| E1 | axe `node.html` (`axe/map.ts` `nodeEvidence`) | snippet | `guardEditableSnippets` (`axe/editable.ts`) wraps in the ancestor's start tag; sanitiser | `tests/checks/axe/editable-resolved.test.ts` | Selector resolved after the fact; options and state kept | 3, 2.1 |
| E2 | axe `node.target` (`locatorOf`) | locator | `text` | none | Ids and attributes of protected elements | 3 |
| E3 | axe `failureSummary`, check messages (`messagesOf`) | note | `text` | none | Messages quote attribute and id values | 3.2 |
| E4 | axe pass list (`map.ts:145`) | `scope_examined` locator array | `text` | none | Each member as E2 | 3 |
| E5 | axe `faultFingerprint` | fingerprint | none useful | none | Hash of the raw `node.html`, `value` included | 3.6 |
| E6 | axe frame gaps (`untestedFramesOf`; `axe/frames.ts` reasons with `frame.url()`) | `scope_examined` locator, snippet, note | guard on probe nodes; `text` | none | Protected frame elements; browser error text | 3, 5 |
| E7 | 8.3.1 witness (`family-a/page/witness.js` `test`) | snippet, locator | editable and field text never a witness; `role` elements not entered; main document only | `tests/engine/editable-role-ancestors.test.ts` | Textbox role above `body` ignored; no `guardEditable` | 3 |
| E8 | 8.5.1 title (`title-main.js`) | snippet | `C.guardEditable` | `tests/engine/editable-frame-context.test.ts` | Box start tag reused as wrapper | 3.5 |
| E9 | 8.2.1 (`ids.js`, `8-2-id-duplicate/index.ts`) | snippet, locator, note (id value) | sanitiser | none | Id and start tag of protected elements | 3 |
| F1 | 8.2.1 fingerprint (`8-2-id-duplicate/index.ts:56`, `` `id=${r.pair.value}` ``) | fingerprint | `text` | none | The id value itself | 3.6 |
| E10 | 8.4.1 (`8-4-default-lang-code-valid/index.ts`) | snippet, note (`lang`) | sanitiser | none | Only if `html` is protected | 3 |
| E11 | family B (`family-b/scan.ts` `record`, `closed-shadow.ts`) | snippet, locator, note | sanitiser; **no context guard** | none | `<font>`, `align` in boxes; closed shadow, `template`, `noscript` text | 3 |
| E12 | family C snippets (`family-c/scan.js` `snippetOf`, `guardEditable`) | snippet | `guardEditable` + host chain (`family-c/read.ts` `hostFacts`) | Q61, Q63 tests, `editable-privacy.test.ts` | Box start tag reused; options kept | 3.5, 2.1 |
| E13 | family C locators (`locatorOf`, `selectorIn`, `read.prefix`) | locator | `text` | none | Ids of protected elements and frames | 3 |
| E14 | family C pass list (`family-c/result.ts:127`) | `scope_examined` locator array | `text` | none | Each member as E13 | 3 |
| E15 | family C notes (`result.ts` `frameName`, `framesList`, `u.reason`, `v.branch`) in `scope_examined` and `text` | note | `text` | none | Frame URLs; evaluation errors | 3.2, 5 |
| F2 | family C fingerprints (`descriptorOf`) | fingerprint | `text` | none | Classes; protected frame paths | 3.6 |
| E16 | family B notes (`family-b/evidence.ts` frame URLs, `unparsedNoscript.reason`) | note | `text` | none | Frame URL; parser message | 3.2, 5 |
| E17 | any provider: thrown or returned messages | `error.message` | `text` | none | Page-controlled text | 5 |

### 1.2 Records the engine writes

| # | Source | Field | Guard today | Gap | Fix |
|---|---|---|---|---|---|
| R1 | sample URLs (`sanitiseSample`) | sample copy | `Sanitiser.url` | none | — |
| R2 | rest of the sample copy (names, ids, `fill` values, locators, storage-state path) | sample copy | none, by spec 8.7 | Allowed in the sample copy only | 4.3 |
| R3 | sample warnings | `sampleWarnings` | ids only | none | — |
| R4 | target URLs (`establishTarget`) | `requestedUrl`, `effectiveUrl` | `Sanitiser.url` | Path kept, by spec | — |
| R5 | `steps[].error` | steps | not reachable | Enters at step 4: Playwright errors carry the locator, URL and a call log with markup | 5 |
| R6 | `expect` | expect | booleans; not reachable | none | — |
| R7 | not-established reason (`firstLine`, `text`) | console; run file (Q66 item 7) | `text` | Browser error text | 5 |
| R8 | manifest, statements, findings, reduced results | — | no page text | none | — |
| R9 | evidence files, screenshots | `evidenceFiles`, `file` | not reachable | Enters at step 6 | 6 |
| R10 | model payload | — | refused by `parseSample` | Stays refused (Q66 item 3) | 4.7 |

### 1.3 Console and other output

| # | Source | Channel | Guard today | Gap | Fix |
|---|---|---|---|---|---|
| C1 | `parseSample` JSON error (`src/engine/sample.ts`) | stderr | none | V8 quotes an excerpt of the input | 5 |
| C2 | `parseSample` schema issues | stderr | none | Not confirmed whether zod quotes values | 5 |
| C3 | `runAudit` messages | stdout | R7 | as R7 | 5 |
| C4 | `src/cli/main.ts` internal error | stderr | none: `e.stack` | Message, function names and paths | 5 |
| C5 | `check-sample` output | stdout | ids only | none | — |
| C6 | Playwright debug logging | stderr | outside the tool | — | 7 |
| C7 | storage-state file (step 5) | — | not reachable | Same JSON-excerpt trap as C1 | 5 |
| C8 | temporary and crash output | disk | none written today | Screenshots, partial files, Playwright artifact folders | 5, 6 |

## 2. Contexts

### 2.1 Form fields, including reflected values (Q68 item 1, Q69 item 1)

The engine derives a field's pieces itself (3.2). On a field element:
- **Start tag, allow-list.** Attribute values are kept only for attributes on a fixed list: `type`, `name`, `id`, `class`, `form`, `list`, `autocomplete`, `inputmode`, `required`, `disabled`, `readonly`, `multiple`, `size`, `minlength`, `maxlength`, `min`, `max`, `step`, `pattern`, `accept`, `alt`, `src`, `width`, `height`, `title`, `placeholder` (Q68), `role`, `tabindex`, `hidden`, `lang`, `dir`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-required`, `aria-invalid`, `aria-hidden`, `aria-autocomplete`, `aria-controls`, `aria-expanded`. Every other attribute (`value`, `aria-valuetext`, `aria-valuenow`, `data-*`, `style`, unknown attributes) keeps its name and has its value withheld. `checked` and `selected` are dropped altogether, name included.
- **Contents.** A `textarea`'s text, and every `option`'s text, `label` and `value`, are withheld, wherever the option sits (`select`, `datalist`).
- **Live-value match.** In the same in-page evaluation that reads the pieces, the engine reads the field's values: `value`, `defaultValue`, `checked`, and the text, `label` and `value` of every option. Any piece derived from the field (an allow-listed attribute value, its locator, a note slot, a fingerprint part) that **contains** one of those values is withheld. Matching is case-folded with whitespace collapsed. Values shorter than 3 characters match only a whole attribute value or a whole class or id token, so that short common values do not withhold everything.
- **Accessible names and values.** A piece of kind `accname` or `accvalue` is withheld if its node is, or contains, a form field or an editable box: accname embeds control values.
- **`placeholder`.** Kept (Q68). Limit: a page can generate it from user data. Inside protected context it is withheld like everything else, and the live-value match applies to it.

**What this identifies.** The field's own values, echoed verbatim (modulo case and whitespace) into the field's own attributes, locator, note slots or fingerprint parts, and any value held in an attribute that is not on the allow-list.
**What it does not.** A transformed echo (hashed, reformatted, truncated below the match); an echo on another element, or in ordinary text, which is ordinary page text by spec 8.7; a value that differs from the current one (an earlier value left in an allow-listed attribute); a value of 1 or 2 characters inside a longer string. These are stated in section 7, not tested as protected.

**Cost.** Benign `data-*` and `aria-*` values on fields are withheld too. The controls measure that cost (4.3, qx207 to qx209).

### 2.2 How today's guards decide

| Context | Sanitiser | axe guard | Family A | Family B | Family C |
|---|---|---|---|---|---|
| `contenteditable` | markup | selector | guarded | **none** | guarded |
| textbox roles | markup | selector | guarded (8.5.1); not entered (8.3.1) | **none** | guarded |
| `designMode` | invisible | selector | guarded | **none** | guarded |
| open shadow tree | — | piercing selector | flat tree | unguarded | flat tree |
| closed shadow tree | — | not entered | excluded | via CDP, unguarded | via CDP, guarded |
| slots | — | `assignedSlot` | `assignedSlot` | — | `assignedSlot` |
| frames | — | selector chain (`levelOf`) | no frame snippets | top level only | `frameElement()` chain |
| unreadable frame | — | masked | — | — | counted as editable |

### 2.3 Combinations

Protection is transitive along the element, its flat-tree ancestors and every hosting frame element up to the top. The harness covers these cases, each with a plain control:
1. editable host > open shadow root > slot > link;
2. editable host > same-origin frame, and > cross-origin frame;
3. editable > frame > cross-origin frame > closed shadow root > link;
4. a plain frame in a `designMode` document, and a framed document itself in `designMode` (gate item 16);
5. a `contenteditable="false"` island inside a box (protected: the outermost box wins);
6. a closed shadow root under an editable host, and an editable host inside a closed shadow root;
7. a manual-slot shadow root.

**reCAPTCHA (gate item 13).** Three causes fit the code: a frame selector that is not unique, a frame re-navigated after `collectFrames`, or a probe timeout. Frame elements are now found by `frameElement()`, not by selector, which removes the first cause. The other two withhold by design. Fixtures can test these hypotheses but cannot name the real cause. The logged-out live run (Q66 item 6) shows whether masking persists; persisting masking is acceptable.

## 3. The guard

### 3.1 Recommendation

One guard in the engine (`src/engine/editable-context.ts`): **providers give references and typed derivations; the engine reads, judges and writes every page-derived piece; anything it cannot establish is withheld.** The four in-page snippet guards (`axe/editable.ts` `libSource`, `family-a/page/common.js` `guardEditable`, `witness.js` `editableAttr`, `family-c/scan.js` `editableAncestor`) are removed in the same build. 8.3.1's "never a witness" is a decision, so it stays in the check, using the shared in-page predicate source. The sanitiser runs last on every plain piece. The evidence kind decides nothing.

### 3.2 What providers give (`src/checks/types.ts`)

`types.ts` changes (orchestrator-owned; the builder makes and logs the change). **No frozen schema changes**: none of the following reaches the run file.

- **Sources.** `{ node: NodeRef }` or `{ frame: FrameKey }`. A `NodeRef` is `{ frame: FrameKey, backendNodeId }` (CDP), `{ frame: FrameKey, handle }` (Playwright), or `{ axeTarget }` (3.3).
- **Derivations**, each tied to its **own** source:
  - `snippet`: one of `outer` (`outerHTML`), `startTag`, `startTagAndText` (the parent's start tag and one text node, for 8.3.1), `textRange` (a character range of a node's text, for family B's `noscript` text, which has no live elements);
  - `locator`: the engine builds it from the node (one syntax for all checks: ` >> ` into shadow roots, ` >>> ` into frames);
  - `attr` (a named attribute), `id`, `accname`, `accvalue`, `frameUrl`.
  An evidence item is `{ kind, snippet?: Derivation, locator?: Derivation, locatorList?: Derivation[], note?: { template, slots } }`. A list member is its own derivation with its own source.
- **Check-owned text** comes only from constants declared on the provider's `CheckDefinition` at load time, before any page exists: note templates, fingerprint labels, enumerations. Template slots take numbers, a declared enumeration value, or a derivation. The engine refuses a template that is not declared.
- **Errors** are classes (section 5), never strings from the page.
- **Safe by default at the boundary.** A raw string where a derivation is expected (legacy `snippet`, `locator`, `note` or `fingerprint` text) is not trusted. The engine withholds it and counts it, and the harness's adversarial rows (4.4) check this. The static test (4.6) is a supplemental control, not the proof.

**The provider trust boundary.** The engine guarantees that every page-derived piece comes from its declared source and is judged by that source's context. It does not, and cannot, guarantee that a provider (a) chose the node it meant to report, or (b) declares no constant, enumeration or number that encodes page data, a covert channel. (a) is a correctness risk, not a privacy one: a wrong source yields that source's own text, judged by its own context. (b) is ruled out by construction for templates (declared before any page loads), and left to review for numbers and enumeration choices (section 7). Adversarial tests (4.4) exercise the boundary. They are written by the test agent, not the builder.

### 3.3 Identity, association and lifetime

- **Association.** Each piece is derived from its own source, in the same in-page evaluation that reads that node's context. A single evaluation is one task in the page, so no page script runs between reading the text and reading the context. The frame chain spans documents. For it, the engine reads each hosting frame element's context and each hosting document's `designMode` before and after the evaluation, and requires both reads to match.
- **Frame identity (`FrameKey`).** Set in `collectFrames`: the Playwright `Frame`, its CDP `frameId`, and its document's `loaderId` (`Page.getFrameTree` on the frame's own session). A different `loaderId`, a detached frame, or a frame not in `ctx.frames` is stale.
- **When a source fails.** A missing source, zero or several matches, a stale frame, a detached node, a resolution past the guard timeout, an unknown source kind, an unreadable frame, or a chain whose two reads differ: **every piece derived from that source is withheld.** That means the snippet, locator, note slots, list member and fingerprint parts tied to it. If an item's snippet or locator source fails, every piece of that item is withheld, whatever its own source. No piece is re-derived by selector after a failure. **There is no wrong-reference exception.** The second version's section 7 limit ("matching snippet, another node's locator") is gone, because the provider no longer supplies the locator.
- **axe: conditional selector identity, never called proven.** axe returns selectors. Privacy does not rest on them: the engine derives text and context from whatever node a selector resolves to. A selector is accepted as naming the node axe read only under this condition, to limit wrong evidence:
  - **Covered selectors.** axe's `getSelector` output: tag names, ids, classes, attribute selectors, `:nth-child`/`:nth-of-type`, and shadow-piercing chains. Their match set depends only on tree structure, attributes and shadow attachment.
  - **Covered changes.** On the engine's own CDP session per frame target, separate from `cdpFor`: `DOM.enable`, then `DOM.getDocument({ depth: -1, pierce: true })`. Then it logs `childNodeInserted`, `childNodeRemoved`, `childNodeCountUpdated`, `attributeModified`, `attributeRemoved`, `shadowRootPushed`, `shadowRootPopped`, `pseudoElementAdded`, `documentUpdated`, and `Page.frameNavigated`, `frameAttached`, `frameDetached`.
  - **Timing.** Logging starts before the axe provider runs (before axe is injected) and stops after the guard has derived the last piece. So it spans axe's read and the resolution.
  - **Accepted** only if the node's document and every hosting document logged none of those events, set-up succeeded on every session in the chain, and the target resolves to exactly one element, frames walked by `frameElement()`. Otherwise the item is withheld.
  - **CDP assumptions, each validated by a synthetic test before the rule is trusted.** Events fire for every node made known by a pierced `getDocument`, closed shadow roots and same-process frame documents included. An out-of-process frame needs its own session. A frame created after set-up appears as `frameAttached` in its parent. `attributeModified` fires for every attribute. **If a test refutes an assumption, the condition counts as unavailable for the class it covers, and those items are withheld.**
  - Constantly changing pages lose their axe evidence; Codex accepts that. A node reference captured at axe's read would be stronger. It would mean running axe in the page with element references, and is left as a later option.
- **axe messages.** Withheld as page-derived (E3). The note carries the failing axe check ids and the rule's `help` text from axe's rule metadata, which is fixed per axe version.
- **Lifetime.** References live from the provider's return until the guard finishes for that provider. Providers do not dispose referenced handles. 8.3.1 may keep releasing its object group early (`8-3-default-lang-present/index.ts:165`) because its sources are backend ids; the engine resolves them in its own object group and releases it in `finally`. On success, error and timeout, the engine disposes handles and object groups. Closing the context is the backstop. References and derivations are stripped before `ObservationSchema` validation.

### 3.4 The rule per piece

| Piece | Plain | Otherwise |
|---|---|---|
| snippet | field rule (2.1), then sanitiser | withheld |
| locator | field rule, then `text` | withheld |
| each list member | field rule, then `text` | that member withheld; the list keeps its length |
| note slot (derived) | field rule, then `text` or `Sanitiser.url` for `frameUrl` | slot withheld |
| `accname` / `accvalue` | `text`, unless its node is or contains a field or box | withheld |
| fingerprint part | 3.6 | 3.6 |

Required scope evidence is kept: a `scope_examined` item keeps its template note, and its list keeps its length, with withheld members. When an item's main source fails, its note becomes a fixed engine note that keeps the reason ("Element in protected context: fields withheld." or "Element whose context could not be established (<code>): fields withheld."). Outcomes are untouched.

### 3.5 Replacement and counts

- Every withheld piece becomes exactly `[redacted]`. It is never the box's start tag or locator. Fixed engine notes carry no page text.
- The engine counts 1 per withheld piece: snippet, locator, each list member, each note slot, each legacy raw string. The sanitiser then runs on what remains. A piece that is already `[redacted]` counts 0 there (`maskEditableBoxes`, `sanitise.ts:235`, and every rule is idempotent), so nothing counts twice. This is why the engine counts its own withholding (Codex's check: the sanitiser gives 0 for `<div contenteditable="true">[redacted]</div>`).
- **Fingerprint withholding is an observation-level count, attributed to the first evidence item.** The schema has no observation-level count field. The engine adds the number of withheld fingerprint parts **once**, to `evidence[0].redactions`, and appends a fixed sentence to that item's note: "Redactions include <n> withheld fingerprint part(s)." Consumers can then tell it from that item's own fields. If the evidence array is empty (the schema allows it), the engine appends a `text` item with that fixed note and the count. If an outcome forbids that, the observation becomes a `check_error` with a fixed message, and the count is never dropped.
- All counts are asserted on the saved file. That includes an observation with several withheld fingerprint parts and several evidence items (qx030, qx032).

### 3.6 Fingerprints

A fingerprint is built only from declared labels and plain parts, after the context rule and after the sanitiser. A hash of a protected value does not remove it.
- `CheckResult.fingerprint` is `{ label, parts: Derivation[] }`. Each plain part is derived and sanitised; each other part becomes `[withheld]`. The text `<checkId>:<label>:<parts joined>` is hashed (SHA-256, 16 hex digits) only when it is longer than 200 characters.
- **8.2.1 (F1).** One part, the `id` of the first element of the pair. If either element of the pair is not plain, the part is withheld.
- **Family C (F2).** `descriptorOf` becomes parts (tag, type, role, two classes, `frameUrl` origin and path) tied to the element.
- **axe (E5).** The label is the failing check ids. The parts are each node's `outer` derivation, under 3.3.
- `no_fault`, `inapplicable` and `cannot_tell` keep `<checkId>:<outcome>`.
- **Differential tests (4.5):** fixtures that differ only in a protected value give byte-identical fingerprints; plain controls that differ in value give different ones.

### 3.7 Effects

- The axe adapter and families A, B and C change version. Outcomes do not change. Nothing is enabled. The working set is rerun at step 11.
- Records are not changed. Locator syntax becomes one engine syntax for all checks: an evidence change, reported.
- axe notes lose the page-derived parts of axe's messages (3.3). Fields lose benign non-allow-listed attribute values (2.1). Constantly changing documents lose their axe evidence. All three are measured by controls.
- **Generated names (item 15).** Measured first, with names that trip the current `base64` rule (`Header_navigationMenuItem__q8Z3xT1w`, `product-card__image-wrapper--Variant2`). There is no shape-based exemption.

## 4. The harness

### 4.1 Shape

- Synthetic pages, served by `serveFixture` on both origins.
- Runs: the real `runAudit` with `allProviders()`; `runCli` with captured output; one child-process run of `src/cli/main.ts`. Rows that need a misbehaving provider run `runProviders` with a test provider, asserted on the serialised observations, because `runAudit` accepts registry checks only.
- Search: every byte of the run folder, stdout and stderr; the run's own temporary folder; the system temporary folder, Playwright's artifact folders and the output directory, listed before and after the run, with every new file searched.

### 4.2 Markers, oracle, reach

- **Prefixes.** `qxNNN-`, unique per marker, with lowercase letters after it and fewer than 32 characters, so token masking never hides one by accident. The prefix alone is searched too, so a cut marker is still found.
- **Escaping markers.** HTML (`qx101-a&b<c>"d'`, as text and as an attribute value); percent (`qx102-a b/é?&=#`, in queries, paths and `src`); JSON (`qx103-a"b\c`, plus U+2028 and a tab). Each is searched raw and in its escaped forms.
- **Oracle.** The fixture writer states, for each planted element, which check must report it, which pieces, how many evidence items, and the exact expected saved values: `[redacted]` and the count for protected pieces, the literal expected text for plain ones. The oracle comes from the fixture source. It never comes from the engine, the provider's references, or the probe.
- **Probe, as a measurement only.** `runAudit` takes a test-only, in-memory `privacyProbe`. For each piece, the engine reports the observation id, evidence id, list index, piece kind, verdict, count, and the `data-probe` key of the node it actually resolved. The oracle compares that key with the element it expects. A different key (the provider pointed elsewhere) fails the row as "not reached". Probe keys are markers too; they must appear nowhere in the output.
- **Per row:** reach (the probe saw the expected node for the expected check and piece); a negative check (protected pieces saved as `[redacted]` with the exact count; the marker absent everywhere); and, for controls, a positive check (the exact expected text present).
- **Diagnostics** name the prefix, the file, the byte offset and the JSON pointer, never the surrounding bytes. The temporary folder is kept, and its path printed, only on failure.

### 4.3 Expectation table (step 3)

**W, n**: pieces withheld and the count expected on the item. **none**: absent everywhere. **Smp**: sample copy only.

| Prefix | Context | Check, pieces | Allowed | W, n |
|---|---|---|---|---|
| qx001 | link text in `contenteditable` | 6.2.1, `axe/link-name`: snippet, locator, note | none | 3 |
| qx002 | `title` on `<font>` in a box | 10.1.1: snippet, locator | none | 2 |
| qx003 | duplicated id in a box | 8.2.1: snippet, locator, note slot, fingerprint part | none | 3 + 1 fingerprint |
| qx004–006 | link in each textbox role | snippet, locator, note | none | 3 |
| qx007 | text under `<html role="textbox">`, no `lang` | 8.3.1 | none | 2 |
| qx008–009 | framed `designMode` document; plain frame in a `designMode` document | snippet, locator | none | 3 |
| qx010–013 | open shadow, closed shadow, slot, manual slot, under boxes | snippet, locator | none | 2–3 |
| qx014–016 | same-origin, cross-origin and nested frames under boxes | snippet, locator, `frameUrl` slots | none | 3 |
| qx017 | protected members of pass lists | axe `map.ts:145`; family C `result.ts:127` | none | 1 per member |
| qx018 | protected frame element in an axe frame gap | locator, snippet | none | 2 |
| qx019 | classes on a protected faulty element | family C fingerprint | none | 1 fingerprint |
| qx020–021 | `input value`; `textarea` text | snippets | none | 1 |
| qx022–025 | option text, `label`, `value`; `selected`, `checked` | 11.8.2 and axe snippets | names of `selected`/`checked` absent too | 1 each |
| qx027 | a value inside a link, written as `accname` | any piece | none | per piece |
| qx028 | `aria-valuetext` on a combobox (protected box) | snippet | none | 3 |
| qx029 | `placeholder` inside a box | snippet | none | 3 |
| **qx031** | **plain `input`**, live value typed by script, reflected into `aria-valuetext` and `data-current` | 11.1.1 and axe snippets | none | 1 per attribute |
| **qx032** | plain `input`, live value reflected into `id` and `class` | locator, family C fingerprint parts, 8.2.1 if duplicated | none | locator 1, fingerprint 1 each |
| **qx033** | plain `input`, live value reflected into `title` (allow-listed) | snippet | none (live-value match) | 1 |
| **qx034** | plain `input`, 2-character live value, `class="ab-wrapper"` | snippet, locator | `ab-wrapper` kept (no whole-token match) | 0 |
| qx030 | 8.2.1 differential pair, protected | fingerprint | identical across the pair | — |
| qx035 | axe and family C differential pairs, protected | fingerprint | identical | — |
| qx040 | missing source (test provider) | all pieces | none | 1 per piece |
| **qx041** | **A protected and B plain, identical markup, different private ids and `data-note`; provider points at B for A's evidence** | snippet, locator, note slot | A's markers none; B's text as the oracle states | 0 (B plain) |
| **qx042** | wrong sources inside a `locatorList` and fingerprint parts (A's member pointed at B, and the reverse) | list members, fingerprint | A's markers none | per member |
| qx043 | legacy raw `snippet`, `locator`, `note`, `fingerprint` strings (test provider) | all | none | 1 each |
| qx044 | axe target matching two elements | axe pieces | none | all withheld |
| qx045 | node replaced between axe's read and the guard (identical markup, swapped ids) | axe pieces | none | all withheld |
| qx046 | class toggled away and back during the axe run | axe pieces | none | all withheld (event logged) |
| qx047 | cross-origin frame re-navigated after `collectFrames` | pieces in it | none | all withheld |
| qx048 | resolution past the guard timeout; detached node; unknown source kind | pieces | none | all withheld |
| qx049 | two frames with the same selector | pieces | none if unresolved; oracle text if resolved by `frameElement()` | — |
| qx050–054 | sample query, fragment, redirect query, iframe `src` query; sample path (qx052) | Smp, targets, notes | none; qx052 allowed in Smp, targets, console | — |
| qx055–056 | sample `fill` value; sample locator | sample copy | Smp | — |
| qx060–061 | invalid sample JSON; invalid enum | console | none | — |
| qx062 | page-patched DOM method throwing a message | `error.message`, notes | none | fixed message |
| qx063 | browser error with the marker in the URL query | not-established reason, console | none | fixed message |
| qx064 | multiline engine error whose message, stack, dynamic function name and file path carry the marker | console (C4) | none | fixed class + code |
| qx101–103 | escaping markers in qx001, qx031, qx050 | as those rows | as those rows | as those rows |
| tokens | page text outside any box | snippet, note, locator | none | sanitiser counts |
| qx200–204 | **controls**: plain link, plain duplicated id (fingerprint kept), plain cross-origin frame, plain `<font title>`, plain pass list | pieces | exact text present | 0 |
| qx205 | **control**: benign `placeholder="qx205-sample hint"` | snippet | present | 0 |
| qx206 | **control**: plain differential pair | fingerprint | differs | — |
| qx207–208 | **controls**: plain `input` with no live value, `title="qx207-hint"`, `name="qx208-field"` | snippet, locator | present | 0 |
| qx209 | **cost**: plain `input` with benign `data-testid="qx209-x"` | snippet | value withheld, by the allow-list | 1 |
| G1–G3 | generated names that trip the detector, on plain elements | locators | measured and reported | — |

### 4.4 Adversarial provider tests

Written by the test agent from the trust boundary in 3.2, not by the builder. Rows qx040 to qx043 plus: a provider that puts a page string into an enumeration slot (refused: not declared); a provider that declares a template after the page loads (refused); a provider that returns a source from another target's page (stale frame, withheld). Each is asserted against the oracle's expected saved values.

### 4.5 Differential fingerprint tests

F1, F2 and E5: two fixtures identical except for the protected value, run through `runAudit`; the saved fingerprints must be byte-identical. The plain controls must differ, which shows that the test can fail.

### 4.6 Static check (supplemental)

A test flags template literals and concatenations that feed check-owned strings in `src/checks/**`. It misses aliases, returns, object properties and assignments, so it is not a provenance proof. The proof is structural: page text reaches output only through derivations the engine reads itself (3.2).

### 4.7 Model payload

`model.enabled: true` gives exit 2. A context route records any request outside the two fixture origins; there must be none.

### 4.8 Baseline on `4d4b224`

The baseline runner uses only `runAudit`, `runCli` and the byte search. It imports nothing written after `4d4b224`, has no probe, and its fixtures are frozen before the guard lands. Each row gets one of three verdicts:
- **leak seen**: a marker found (reach shown by the leak);
- **not reached or unproven**: no marker found, and the baseline cannot tell a safe route from an unreached one;
- **control ok / control failed**, for the positive rows.
No baseline row ever counts as passing. The baseline must show **leak seen** for the leaks the code shows: qx003, qx002, qx011, qx017, qx019, qx022 to qx025, qx031, qx032, qx060, qx062, qx064, and the differential pairs qx030 and qx035 (which differ at baseline). The adversarial rows qx040 to qx043 need the new provider interface and do not run at baseline. The result is recorded with the revision hash.

### 4.9 Steps, sessions, screenshots (step 10)

- **Steps, after step 4:**
  - a `fill` with `qx070`, then a failing `click` on an element carrying `qx071`: a fixed step message and the locator as written; no value, no call-log markup;
  - a navigation error with `qx072` in the query: fixed message;
  - `expect.visible` on `qx073` text: booleans only;
  - typing `qx074` into a box: none.
- **Sessions, after step 5.** A synthetic storage-state file, generated in the harness's temporary folder (`qx080` cookie, `qx081` localStorage, `qx082` origin):
  - Case 1, a public page showing personal content when logged in: `qx083` ordinary text allowed in observations (Q66 item 5), `qx084` field value none, `qx085` token none, and none of them without the session.
  - Case 2, a state that navigates to `/account?ref=qx086`: `sessionLoaded` true, `qx086` none.
  - A missing, unreadable or invalid file (`qx087` inside): exit 2, path and code only.
- **Screenshots, after step 6:** section 6.5.

## 5. Errors

Every message is classified where it is caught. Only fixed messages and engine-built text reach any output: notes, `error.message`, console, not-established reasons, step and session errors, temporary and crash output.

| Class | Output |
|---|---|
| `page` (evaluation rejected by page code; patched methods) | "the evaluation in the page failed" + frame index |
| `browser` (Playwright or CDP: timeout, detached, closed, context destroyed, `net::` errors) | a fixed message per recognised error, matched by `name` or a known prefix, never quoted; otherwise "browser error"; a URL only when the engine holds it, through `Sanitiser.url` |
| `parser` (sample, schema, storage state, `noscript`) | "not valid JSON"; schema: path + zod issue code; storage state: path + error code |
| `step` (step 4) | "step <n> (<action>): <failure class>" + the locator as written in the sample |
| `session` (step 5) | path + error code |
| `engine` | text built from ids, enumerations and schema paths |

- **The CLI's internal error** prints the class, a fixed message, and an opaque diagnostic code: a constant per throw site, such as `E-ENG-07`. **No stack frames.** Function names and paths can be page-influenced. Any debug mode added later applies the same policy, with no bypass. Row qx064 tests a multiline message and stack with markers.
- Unknown origin is treated as `page`. `firstLine(e)` on browser errors is removed.
- This replaces the earlier "known weak point" (qx062 must pass).

## 6. Screenshots (step 6)

### 6.1 Policy

A screenshot is written only when every sensitive region is proven covered, in memory, before any byte reaches disk. **Otherwise it is suppressed.**

### 6.2 In memory, then write

- The capture is `Page.captureScreenshot` on the page's CDP session (or `page.screenshot()` without `path`). Both return the image to the Node process over the protocol pipe, with no file. The image is decoded, masked and encoded in memory; only the masked bytes are written, directly to the evidence file.
- If masking is impossible in memory (no codec, image too large, encoding error), the screenshot is suppressed. No temporary file ever holds unmasked pixels. A temporary file, if any (for an atomic rename), holds masked bytes only.
- Tests (6.5) kill the process during capture and after masking, and inject errors in the decoding, masking and writing steps. Then they list the run folder, its temporary folder, the system temporary folder and Playwright's artifact folders, and search every new file.
- **Open point for Fabien:** the PNG codec, either small and in-house over Node's zlib, or a dependency, which is not authorised.

### 6.3 Regions and coordinates

- Viewport screenshots only; `Page.getLayoutMetrics` and `devicePixelRatio` give the scale, and the image must measure exactly viewport × scale.
- Regions: every form field, every editable box, and every element and text node in a box's flat subtree, in every frame, from the engine's pierced CDP tree, via `DOM.getContentQuads`. Clipping is ignored (the full quad is masked). Transformed quads become their bounding boxes.
- Same-process frames whose quads are in root coordinates, with no transform on the frame chain, are masked region by region. Every other frame that holds, or may hold, a region (out-of-process, transformed, unreadable) is masked whole by its frame element's bounding box. If that geometry is unknown, the screenshot is suppressed.
- Regions are rounded outwards: floor, ceil, and a 1-pixel margin, after scaling.

### 6.4 Visual stability

Comparing enumerations before and after the capture does not prove that nothing moved in between (Codex). Stability is **established by freezing**, then checked:
1. Capture is the last action on a target, after every provider, so freezing affects no check.
2. On every frame target's session: `Animation.setPlaybackRate({ playbackRate: 0 })`, which pauses CSS animations, transitions and Web Animations, compositor ones included; `Emulation.setScriptExecutionDisabled({ value: true })`, which stops timers, `requestAnimationFrame` and scroll scripts. No input is sent.
3. The engine waits two animation frames, reads scroll offsets and enumerates regions, captures, then reads scroll offsets and enumerates again. It accepts the capture only if both reads match, the DOM and frame logs (3.3) recorded nothing, and every freeze command succeeded on every session whose frame may hold a region.
4. **Not covered by the freeze, so suppressed when present:** media playback (`video`, `canvas` streams, animated images) inside or over a region; a frame that holds a region where the freeze failed and whose frame-wide mask cannot be used; smooth scrolling in progress (step 3's scroll reads show it). Each such case is detected explicitly (media elements found in the tree, a failed command, differing scroll reads). **The design does not claim that every animated page is suppressed:** animations the freeze covers are frozen, and the listed sources are detected and suppressed.
5. **CDP assumptions validated by tests before the rule is trusted:** that playback rate 0 stops compositor-driven transforms; that disabling script stops already-scheduled timers and `requestAnimationFrame`; that both apply per out-of-process frame session. If a test refutes one, screenshots stay suppressed for the class it covers.

### 6.5 Tests

- **Pages:**
  - a protected box moved by a CSS animation, and another by a transition, from position P out of its mask and back to P, with no DOM mutation, so the endpoint rectangles match;
  - the same movement by a compositor-only `transform` animation;
  - by `requestAnimationFrame`;
  - by smooth scrolling;
  - a box over a playing video;
  - device scales 1 and 2, transformed and nested cross-origin frames, a closed shadow tree in a box, and a frame re-navigating during capture.
- **Checks:**
  - decoded dimensions;
  - no pixel within a tolerance band of the sensitive colour (antialiasing included);
  - the control colour present outside the masks;
  - `capture.mask` regions black;
  - a frame-wide mask where that is the expectation;
  - an expected screenshot that was not written fails;
  - suppression passes only where it is expected;
  - PNG metadata and file names searched;
  - crash and error paths (6.2).

### 6.6 Estimate (Q69 item 3)

Step 6 is now **disproportionately large**. It needs the in-memory codec (or a dependency ruling), the regions and frame geometry, the freeze and its validation tests, crash-path tests and pixel tests. My estimate is **8 to 12 points of the weekly limit** for build, tests and one correction round. That is a third to a half of Q66's 25-point build allowance, and 1.5 to 2 times the context guard itself. The basis is this milestone's cost log (about 2 points per 200k tokens) and a guess of 1 to 1.5 million tokens of work; it is uncertain by about half either way. The alternative, **no screenshots in v1** (capture off, and a harness row asserting that no image file exists), costs about 1 point. Choosing between them, and so whether Q66 item 4 stands, is Fabien's decision. This design does not change it.

## 7. Limits

- Pattern and marker tests cannot show that no secret ever reaches the run folder (spec 8.7). They show that the planted contexts and channels behave as stated.
- Field values echoed in transformed form, on other elements, in ordinary text, or values shorter than 3 characters inside longer strings, are not identified (2.1). A page-generated `placeholder` outside protected context is kept.
- Trust boundary (3.2): a provider can report the wrong node (a correctness risk), and numbers or enumeration choices could encode page data (a covert channel left to review).
- axe evidence depends on a conditional selector identity (3.3). Without the condition, it is withheld.
- Pages that patch DOM methods can make in-page reads lie. Stability, frame identity and backend ids come from CDP, not from page scripts.
- The real reCAPTCHA cause is not identified by fixtures.
- Derived channels other than fingerprints (counts, lengths, outcomes) are not tested.
- Playwright debug logging, the user's shell, and OS swap or crash dumps are outside the tool.

## 8. Build plan (kickoff step 3)

One writer per directory. The fixture, oracle and adversarial tests are never written by the builder of the code they test (10.5).

| Part | Directory | Writer | Size |
|---|---|---|---|
| 1. Harness runner: capture of output and temporary locations, escaped and prefix search, oracle comparison, probe use, diagnostics; separate baseline mode (4.8) | `tests/privacy/` | test agent A | medium |
| 2. Fixtures, oracle tables (4.3), differential pairs (4.5), adversarial providers (4.4) | `tests/privacy/fixtures/` | test agent A | large |
| 3. Baseline on `4d4b224`, three-way verdicts recorded | — | orchestrator | small |
| 4. `editable-context.ts` (sources, derivations, association, `FrameKey`, DOM and frame log, axe condition with its CDP validation tests, field rule, counts, fingerprints, probe seam); `types.ts`; `run-checks.ts`; form rule in `sanitise.ts`; error classes in `target.ts`, `run.ts`, `sample.ts`, `main.ts` | `src/engine/`, `src/checks/types.ts`, `src/cli/` | core builder B | large |
| 5. Providers emit sources, derivations, declared templates and error classes; in-page guards removed; 8.3.1 on the shared predicate; versions bumped | `src/checks/` | builder C, after part 4's interface | large |
| 6. Static check, supplemental (4.6) | `tests/privacy/` | test agent A | small |
| 7. Harness rerun, generated-name measurement, correction rounds | — | orchestrator, B, C | medium |
| 8. Step and session extensions (4.9) | `tests/privacy/` | test agent A | medium |
| 9. Screenshots (section 6), only if Fabien keeps Q66 item 4 and rules on the codec | `src/engine/` + `tests/privacy/` | B, then A for tests | large (6.6) |

Existing tests (`tests/engine/editable-*.test.ts`, `tests/checks/axe/editable-resolved.test.ts`) stay. Assertions that expect the box's start tag around the mask, or check-specific locator syntax, move to the fixed replacement and the engine syntax; each change is logged with its reason.

## 9. Answers to Codex's reviews

**First review**

| Finding | Answer |
|---|---|
| 1. Fingerprints and non-node evidence | F1, F2, E5 (1.1); fingerprints from plain parts only, with differential tests (3.6, 4.5); every piece guarded by its own source, list members and note slots included, required scope evidence kept (3.2, 3.4) |
| 2. Resolution and replacement | association, identity, lifetime, withholding on every failure, no selector fallback (3.3); fixed `[redacted]` and explicit counts on the saved file (3.5) |
| 3. Harness reach | independent oracle, probe as a measurement only, positive and negative checks, prefixes, escaping markers, reference-failure rows, three-way baseline (4.2 to 4.8) |
| 4. Errors | error classes, fixed messages at every boundary (5) |
| 5. Screenshots | section 6 |
| 6. Form values, generated names | 0, 2.1 (Q68 item 1); measured first, no exemption (3.7) |
| Shorter answer | sample copy versus leaks (4.3), truncation and encodings (4.2), sessions (4.9), errors (5) |

**Second review**

| Point | Answer |
|---|---|
| 1. Reflected live values on a plain field | allow-list on field start tags, live-value match on every piece from the field, accname rule, what is and is not identifiable (2.1); qx031 to qx034, controls qx207 to qx209 (4.3) |
| 2. Wrong reference leaks another node's fields | the engine derives every piece from its own source; withholding of all pieces on failure; no wrong-reference exception; trust boundary stated; adversarial tests with an independent oracle (3.2, 3.3, 4.2, 4.4; qx041 to qx043); section 7 limit removed |
| 3. Screenshot writes and stability | in memory before any write, masked-only temporary files, crash tests (6.2); stability by freezing, with listed detected exceptions and no blanket claim (6.4); out-and-back fixtures without DOM mutation, compositor and scroll (6.5); estimate (6.6) |
| Open point: axe identity | conditional, never called proven: covered selectors, changes, timing, CDP assumptions validated, withheld otherwise; privacy does not depend on it (3.3; qx044 to qx046) |
| Open point: wrong reference | no exception (3.3) |
| Open point: fingerprint counts | observation-level count on `evidence[0]`, added once, stated in a fixed note, empty array handled (3.5; qx003, qx032) |
| Open point: CLI stacks | fixed class, message and opaque code, no stack frames, no debug bypass (5; qx064) |
| Static test | supplemental; the proof is the typed derivation boundary (3.2, 4.6) |
| Baseline | independent runner, frozen fixtures, three verdicts, nothing counts as passing (4.8) |
