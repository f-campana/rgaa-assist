# M3 privacy-sweep design

Kickoff step 2. First version `56874a1`, held by Codex (`rgaa-m3-privacy-design-review-2026-11-26.md`, and the shorter answer in `docs/m3/codex-review-privacy-design-2026-11-26.md`). This revision answers both reviews and Q68 (the definition of form-field values in item 1, and the revision in item 2). A second Codex review comes before any code (Q68 item 3). Section 8 maps each finding to its answer.

Code references are to main `d55b4f6`, which has the same code as `4d4b224`. I opened every file and function named here. Where reading could not settle a point, the text says so.

## 0. Terms

- **Editable box**: an element with `contenteditable` other than `false`; or whose first `role` attribute has a token from `src/engine/editable-box.json` (`textbox`, `searchbox`, `combobox`); or any element of a document in `designMode` (Q56, Q61).
- **Form field**: `input`, `textarea`, `select`.
- **Form-field value** (Q68 item 1): an `input`'s `value` attribute; a `textarea`'s content; the text, `label` attribute and `value` attribute of every `option`; the `selected` and `checked` attributes; any live value; and any accessible name or value a producer writes that is computed from a field (accname embeds control values).
- **Protected context**: the element is inside an editable box in the flat tree, or is content of a form field (an `option`, the text of a `textarea`), or sits in a document hosted, at any depth, by a frame element in protected context (Q63). The field element itself is **not** protected context: its locator stays, and its snippet goes through the form-value rule.
- **Plain**: protected context ruled out, on a reference whose identity holds (section 3.3).
- **Withheld**: a field replaced by the fixed text of section 3.5 and counted.
- **Page-derived**: text whose content the page, a URL, an error from the browser or the sample decides.

## 1. Inventory

Every route by which page-derived text reaches the run folder (today, `run.json` only) or the console. **Guard** is what applies today; **Test** names a test that plants a value on that route. **Fix** names the section of this design that closes the gap.

The engine runs every evidence string through the sanitiser in `sanitiseEvidence` (`src/engine/run-checks.ts`): `locator` and `note` through `Sanitiser.text` (URLs, then tokens), `snippet` through `Sanitiser.snippet`. Fingerprints go through `text`, and error messages through `text` in `errorObservation`. Nothing else depends on context today.

### 1.1 Evidence and fingerprints from checks

| # | Source | Field | Guard today | Test | Gap | Fix |
|---|---|---|---|---|---|---|
| E1 | axe `node.html` (`axe/map.ts` `nodeEvidence`) | snippet | `guardEditableSnippets` (`axe/editable.ts`) wraps in the ancestor's start tag, then sanitiser | `tests/checks/axe/editable-resolved.test.ts` | Selector-based, resolved after the fact (identity not proven); option text and `selected`/`checked` kept | 3, 2.1 |
| E2 | axe `node.target` (`locatorOf`) | locator | `text` only | none | Ids and attributes of protected elements | 3.4 |
| E3 | axe `failureSummary` and messages (`messagesOf`) | note | `text` only | none | axe messages quote attribute and id values | 3.4 |
| E4 | axe pass list (`map.ts:145`) | `scope_examined` locator, JSON array of up to 25 | `text` only | none | Each member as E2 | 3.4 |
| E5 | axe `faultFingerprint` (`map.ts`) | fingerprint | none useful | none | SHA-256 prefix of the raw `node.html`, `value` attributes included | 3.6 |
| E6 | axe frame gaps (`untestedFramesOf`; `axe/frames.ts` gap reasons with `frame.url()`) | `scope_examined` locator, snippet, note | guard runs on probe nodes; `text` on notes | none | Frame-gap locator and snippet of a frame element in protected context; reason text from a browser error | 3.4, 5 |
| E7 | family A 8.3.1 witness (`family-a/page/witness.js` `test`) | snippet, locator | editable and field text never a witness; elements with a `role` not entered; main document only | `tests/engine/editable-role-ancestors.test.ts`, 8.3.1 check tests | `startEditable` ignores a textbox role above `body`; snippet not passed through `guardEditable` | 3 |
| E8 | family A 8.5.1 title (`title-main.js`) | snippet | `C.guardEditable` | `tests/engine/editable-frame-context.test.ts` | Start tag of the box reused as wrapper | 3.5 |
| E9 | family A 8.2.1 (`ids.js`, `8-2-id-duplicate/index.ts`) | snippet (`C.openTag`), locator, note (id value) | sanitiser only | none | Id and start tag of protected elements | 3.4 |
| **F1** | 8.2.1 fingerprint (`8-2-id-duplicate/index.ts:56`, `` `id=${r.pair.value}` ``) | fingerprint | `text` only | none | **The id value itself**, even if every evidence field were masked (Codex finding 1) | 3.6 |
| E10 | 8.4.1 (`8-4-default-lang-code-valid/index.ts`) | snippet (`html` start tag), note (`lang` value) | sanitiser only | none | Only if `html` is protected (a document in a protected frame, `designMode`) | 3.4 |
| E11 | family B 10.1.1, 10.1.2 (`family-b/scan.ts` `record`, `closed-shadow.ts`) | snippet (`startTag`), locator, note | sanitiser only, **no context guard** | none | `<font>`, `align` and the like inside `contenteditable`, including closed shadow trees, `template` content, `noscript` text | 3.4 |
| E12 | family C snippets (`family-c/scan.js` `snippetOf`, `guardEditable`) | snippet | `guardEditable` + `documentEditable` with the host chain (`family-c/read.ts` `hostFacts`) | Q61, Q63 tests above, `editable-privacy.test.ts` | Box start tag reused; `select` snippets keep option text | 3.5, 2.1 |
| E13 | family C locators (`locatorOf`, `selectorIn`, `read.prefix`) | locator | `text` | none | Ids of protected elements and of protected frame elements | 3.4 |
| E14 | family C pass list (`family-c/result.ts:127`, `fullLocator`) | `scope_examined` locator, JSON array | `text` | none | Each member as E13 (Codex finding 1) | 3.4 |
| E15 | family C notes (`result.ts` `frameName`, `framesList`: frame URLs; `u.reason`; `v.branch`) in `scope_examined` and `text` evidence | note | `text` | none | Frame URLs of protected frames; `u.reason` holds an evaluation error (E17) | 3.4, 5 |
| **F2** | family C fingerprints (`descriptorOf`: tag, type, role, two classes, iframe `src` origin and path) | fingerprint | `text` | none | Classes of protected elements; path of a protected frame's URL | 3.6 |
| E16 | family B notes (`family-b/evidence.ts` `scopeNote`, frame URLs; `unparsedNoscript.reason`) | note | `text` | none | Frame URL; a parser error message | 3.4, 5 |
| E17 | any provider: thrown or returned messages (`runProvider`, `toObservation`, `CheckFailure.message`) | `error.message` | `text` | none | Page-controlled messages (a page can replace DOM methods and throw its own text) | 5 |

### 1.2 Records the engine writes

| # | Source | Field | Guard today | Test | Gap | Fix |
|---|---|---|---|---|---|---|
| R1 | sample URLs (`sanitiseSample`, `run-file.ts`) | `sample.pages[].url`, `expect.url`, `navigate`, `documents[].url` | `Sanitiser.url` | `sanitise.test.ts` | none | — |
| R2 | rest of the sample copy: names, ids, `fill` values, locators, `session.storageState` path | `sample.*` | none, by spec 8.7 ("stored as written") | none | Policy: allowed in the sample copy only | 4.3 rows |
| R3 | sample warnings | `sampleWarnings` | ids from the sample only | none | none | — |
| R4 | `TargetExecution` URLs (`establishTarget`, `target.ts`) | `requestedUrl`, `effectiveUrl` | `Sanitiser.url` | none | path kept, by spec | — |
| R5 | `TargetExecution.steps[].error` | steps | not reachable (`establishTarget` refuses non-`initial` targets) | — | Enters at kickoff step 4. Playwright errors carry the locator, the URL, and a call log that can print the element's markup | 5 |
| R6 | `TargetExecution.expect` | expect | booleans; not reachable | — | Enters at step 4 | — |
| R7 | not-established reason (`establishTarget`: `firstLine`, then `text`) | console; run file from Q66 item 7 | `text` | none | Browser error text | 5 |
| R8 | manifest, statements, findings, reduced results | — | no page text | none | none | — |
| R9 | evidence files, screenshots | `evidenceFiles`, `Evidence.file` | not reachable | — | Enters at step 6; pixels are a new channel | 6 |
| R10 | model payload | — | `parseSample` refuses `model.enabled: true`; no model client | none | Stays refused (Q66 item 3) | 4.7 |

### 1.3 Console and other output

| # | Source | Channel | Guard today | Gap | Fix |
|---|---|---|---|---|---|
| C1 | `parseSample` JSON error (`src/engine/sample.ts`) | stderr | none | V8's message quotes an excerpt of the input | 5 |
| C2 | `parseSample` schema issues | stderr | none | I did not confirm whether the installed zod quotes received values | 5 |
| C3 | `runAudit` messages (`run.ts`) | stdout | R7 for reasons | as R7 | 5 |
| C4 | `src/cli/main.ts` internal error | stderr | none: prints `e.stack` | Raw message of any escaping error | 5 |
| C5 | `check-sample` output (`describeWarning`) | stdout | ids only | none | — |
| C6 | Playwright debug logging | stderr | outside the tool | — | 7 |
| C7 | storage-state file (step 5) | — | not reachable | Never copied or printed; same JSON-excerpt trap as C1 | 5 |
| C8 | temporary output | — | none written today (`writeRunFile` writes `run.json` directly) | Any later temporary file (screenshots before masking, partial run files) | 5, 6 |

## 2. Contexts

### 2.1 Form-field values (Q68 item 1)

The snippet rule changes (in `src/engine/sanitise.ts`):
- `input`: `value` masked (today). `checked` dropped altogether, attribute name included, so the output does not show whether it was set.
- `textarea`: content masked (today).
- `option`, wherever it appears (`select`, `datalist`): text content masked, `label` and `value` masked, `selected` dropped altogether.
- `placeholder`: kept, as author text. **Limit:** a page can generate a placeholder from user data, and the tool cannot tell. Inside protected context it is withheld with everything else; it is never an exception there.
- **Live values.** The first version said a live value never appears in markup. That was too strong: applications reflect values into attributes (`value` set by script, `aria-valuetext`, `data-*`) and into text. Inside a field or a protected context, reflected values are covered by the rules above. A value reflected into ordinary text elsewhere on the page is ordinary text, and the tool cannot detect it (section 7).
- **Accessible names and values.** No check writes one into evidence today, by my reading. A producer that does must pass a reference for the element; the engine withholds the name if that element **is or contains** a form field or an editable box, because accname embeds control values (section 3.4).

### 2.2 How today's guards decide

| Context | Sanitiser | axe guard | Family A | Family B | Family C |
|---|---|---|---|---|---|
| `contenteditable` | masked by markup | resolved by selector | guarded | **none** | guarded |
| textbox roles | masked by markup | resolved | guarded (8.5.1); not entered (8.3.1) | **none** | guarded |
| `designMode` | invisible in markup | resolved | guarded | **none** | guarded |
| open shadow tree | — | shadow-piercing selector | flat tree | walked, unguarded | flat tree |
| closed shadow tree | — | axe does not enter | 8.3.1 excludes text under closed hosts | walked via CDP, unguarded | scanned via CDP; walk upward works |
| slots | — | `assignedSlot` first | `assignedSlot` first | — | `assignedSlot` first |
| same- and cross-origin frames | — | frame chain by selector (`levelOf`) | no snippets from frames | top-level document only | host chain via `hostFacts` (Playwright `frameElement()`) |
| unreadable frame | — | masked, `UNRESOLVED` | — | — | host unknown, counted as editable |

### 2.3 Combinations

The rule is transitive: one protected link in the chain (the element, its flat-tree ancestors, hosting frame elements up to the top) makes the element protected. The harness covers, each with a plain control:
1. editable host > open shadow root > slot > link;
2. editable host > same-origin iframe, and > cross-origin iframe > link;
3. editable host > iframe > cross-origin iframe > closed shadow root > link;
4. plain frame in a `designMode` document, and a framed document itself in `designMode` (gate item 16);
5. a `contenteditable="false"` island inside a box: protected (outermost box wins; all guards agree today);
6. closed shadow root under an editable host; editable host inside a closed shadow root;
7. a shadow root with `slotAssignment: "manual"` (slot assignment can change with no DOM mutation, section 3.3).

Closed shadow roots and cross-origin frames are reachable through CDP and Playwright. What no guard can resolve is in section 3.3; it is withheld.

**reCAPTCHA (gate item 13).** Three causes fit the code: a frame selector that is not unique (`frameElementExpression` needs exactly one match), a frame re-navigated after `collectFrames`, or a frame-probe timeout. The new design removes the first route: frame elements are resolved by Playwright's `frameElement()`, not by selector. The other two remain fail-closed by design (section 3.3). Fixtures test each hypothesis. They cannot identify the real-site cause; only the logged-out live run of Q66 item 6 shows whether masking persists, and persisting masking is acceptable.

## 3. Where the guard lives, and how it holds

### 3.1 Recommendation

**One context guard in the engine. It works by provenance: every page-derived string a check emits is tied to the node or frame it came from. Anything not proven plain is withheld.** The shared module is `src/engine/editable-context.ts`. It holds the one predicate (as a Node-side function over CDP node data, and as one in-page source string), the identity rules, the frame-chain walk, the axe resolution, the evidence and fingerprint rule, and the screenshot regions. The four in-page snippet guards (`axe/editable.ts` `libSource`, `family-a/page/common.js` `guardEditable`, `witness.js` `editableAttr`, `family-c/scan.js` `editableAncestor`) are removed in the same build. 8.3.1's "never a witness" is a decision, not a mask, so it stays in the check and uses the shared in-page source. The sanitiser's markup rule stays as a second layer.

This replaces the first version's split, in which non-`dom_node` kinds kept today's treatment. **The evidence kind decides nothing.**

### 3.2 What checks provide (`src/checks/types.ts`)

`types.ts` changes (orchestrator-owned; the kickoff lets the builder make and log the change). **No frozen schema changes**: everything below is stripped by the engine before validation, and the run file keeps today's fields.

- `NodeRef` is one of:
  - `{ kind: "backend", frame: FrameKey, backendNodeId, captured: Context }`: a CDP backend node id, for 8.3.1, family B closed roots and family C exposure;
  - `{ kind: "handle", frame: FrameKey, handle: ElementHandle, captured: Context }`, for family A and family C scans that return elements;
  - `{ kind: "axe", target, nodeIndex }`, for the axe adapter (section 3.3).
  `captured` is the context the check computed with the shared in-page source at the moment it read the node: `"plain"`, `"protected"` or `"unknown"`.
- Each page-derived string travels with its provenance:
  - `RawEvidence.ref` for the item's own `snippet` and `locator`;
  - `RawEvidence.locatorList: { locator, ref }[]` in place of a JSON-stringified `locator`; the engine serialises the surviving members into `locator` as today's JSON array (axe `map.ts:145`, family C `result.ts:127`, frame-gap lists);
  - `RawEvidence.noteSlots: { key, text, source }[]`, filled into `{key}` placeholders in `note`. `source` is `{ ref }` (page text tied to a node), `{ frame: FrameKey, kind: "url" }` (a frame's URL), or `{ error: ErrorClass }` (section 5);
  - `CheckResult.fingerprintParts: { text, ref? }[]` in place of a free `fingerprint` string whenever any part is page-derived (section 3.6).
- **Rule for checks:** a `note`, `locator`, `snippet` or `fingerprint` string may hold check-owned text only: constants, numbers, check ids, enumerations. Page-derived text goes through the slots above. The engine cannot see a check that inlines page text in a constant string, so a static test (section 4.6) enforces it.

### 3.3 Identity and lifetime

- **Frame identity (`FrameKey`).** The engine assigns it in `collectFrames`: the Playwright `Frame` object, its CDP `frameId`, and the document's `loaderId` at that time (`Page.getFrameTree` on the frame's own session). A frame is **the same** while all three match. A new document (navigation, `document.open`) changes `loaderId`, which makes it stale.
- **Document stability.** Before the first provider runs, the engine opens its **own** CDP session per frame target (separate from `cdpFor`, so a check's `DOM.getDocument` cannot reset its state). On it, it calls `DOM.enable` and `DOM.getDocument({ depth: -1, pierce: true })`, which makes every node known, closed shadow roots included. From then until the guard finishes, it records every `childNodeInserted`, `childNodeRemoved`, `attributeModified`, `attributeRemoved`, `characterDataModified`, `shadowRootPushed`, `shadowRootPopped`, `documentUpdated`, plus `Page.frameNavigated`, `frameAttached` and `frameDetached`. A document with none of these events is **stable**. A document is **unprovable** when that set-up failed, timed out, or the document holds a shadow root with manual slot assignment.
- **Node identity.** `backend`: the backend node id within its `FrameKey`, which stays valid while the document lives. `handle`: the Playwright handle within its `FrameKey`. `axe`: axe returns selectors only, so identity is accepted **only** if the node's document is stable and its target resolves, with frames walked by `frameElement()` identity rather than by selector, to exactly one element. Under stability, a unique selector match is the node axe examined. Without stability there is **no fallback**: the item is withheld.
- **Context is checked twice.** At capture (`captured`, computed in the same evaluation that read the node) and again by the engine at guard time, on the same identity, with the frame chain added. The item is plain only if both say plain. A disagreement is withheld and recorded in the engine note.
- **Withheld on:** a missing reference; zero or several matches; a stale `FrameKey` (navigated, detached, `loaderId` changed); a detached node (`DOM.resolveNode` fails, or `isConnected` false); an unstable or unprovable document for an `axe` reference; a resolution that exceeds the guard timeout; an unknown `kind`; a frame the engine marks unreadable; an unknown `captured`. The engine never retries by selector.
- **Wrong reference.** For a `handle` or `backend` reference, the engine checks that the snippet, with any truncation mark removed and the sanitiser's masks undone where they apply, is a substring of the node's current `outerHTML`. A start-tag snippet must equal the node's start tag. Otherwise the snippet is withheld. A wrong reference with a matching snippet but a locator of another node is a limit (section 7).
- **Lifetime.** References live from the provider's return until the guard finishes for that provider. Providers must not dispose referenced handles. 8.3.1 releases its CDP object group early (`8-3-default-lang-present/index.ts:165`). That stays allowed because its reference is a `backend` id, which needs no object group: the engine resolves it in its own object group, released in `finally`. The engine disposes every handle after the guard, on success, error and timeout. On a provider timeout, the results are discarded and the handles disposed. Closing the context (`examineTarget`'s `finally`) is the backstop. References are never serialised, and the engine strips the new fields before `ObservationSchema` validation.

### 3.4 The rule, field by field

For each page-derived string, according to its provenance:

| Field | Plain | Protected, or not proven plain |
|---|---|---|
| `snippet` | sanitiser (form-value rule, URL, tokens, cap) | withheld |
| `locator` (single) | `text` | withheld |
| each `locatorList` member | `text` | that member withheld; the list keeps its length so counts stay true |
| `noteSlots` `{ ref }` | `text` | slot withheld |
| `noteSlots` frame URL | `Sanitiser.url` | slot withheld if the frame is protected or unknown |
| `noteSlots` error | fixed message of its class (section 5) | same |
| accessible name or value (any field) | `text`, if the node neither is nor contains a field or box | withheld |
| fingerprint | section 3.6 | section 3.6 |

- **The evidence the schema requires is kept.** A `scope_examined` item stays, with its count note and a list whose withheld members read as the fixed text, so `no_fault` and `inapplicable` still carry what `ObservationSchema` demands.
- **Notes.** When the item's own reference is not plain, the check's note template is kept only if it has no `{ref}` slots; otherwise the engine replaces it with a fixed note that keeps the reason, as Codex suggested: "Element in protected context: snippet, locator and note withheld." or "Element whose context could not be established (<reason code>): fields withheld."
- **Outcomes are untouched.** The rule is about evidence, not decisions.

### 3.5 Replacement text and counts

- **Replacement.** Every withheld field becomes exactly `[redacted]` (`MASK`). It is never the box's start tag, never its locator, never a neutral tag around the mask. The first version's "box start tag + MASK" and "box locator + ` >> [redacted]`" are dropped: a page controls both. Fixed engine notes contain no page text.
- **Counts.** The engine counts one redaction per withheld field: snippet 1, locator 1, note 1 (or 1 per withheld slot when the template is kept), 1 per withheld list member, and 1 for a withheld fingerprint part. The sanitiser then runs on what remains, and its own counts are added. A field that is already `MASK` counts 0 in the sanitiser (`maskEditableBoxes` at `sanitise.ts:235`, and the idempotence of every rule), so nothing is counted twice. Codex's check (`createSanitiser().snippet('<div contenteditable="true">[redacted]</div>')` returns 0) is the reason the engine counts its own withholding explicitly, instead of relying on the sanitiser.
- **Where counts go.** `Evidence.redactions`, as today. Fingerprint withholding is counted on the observation's first evidence item. Observations have no count field, and adding one would be a frozen-schema change; a fault always carries evidence, and other outcomes use check-owned fingerprints (section 3.6).
- **Asserted on the saved file**, per evidence item, with the expected count stated in the expectation table (4.3).

### 3.6 Fingerprints

Rule: **a fingerprint is built only from check-owned text and from parts proven plain, after context withholding and after the sanitiser.** A hash of a protected value does not remove it, so hashing comes last, over safe data only.

- The engine builds the fingerprint from `fingerprintParts`: each part with a plain reference is passed through `Sanitiser.text` (for a markup part, `Sanitiser.snippet`, so `value` attributes are gone); each other part becomes the constant `[withheld]`. Parts are joined. The joined text is hashed (SHA-256, 16 hex digits) only when it is longer than 200 characters. The result is `<checkId>:<parts or hash>`.
- **8.2.1 (F1):** parts are `id=` and the id value, the value tied to the first element of the pair. If either element of the pair is not plain, the value is withheld: `custom/8-2-id-duplicate:id=[withheld]`.
- **Family C (F2):** the `descriptorOf` pieces (classes, iframe `src` origin and path) become parts tied to the element; tag, type and role are check-owned only when read from a plain element, otherwise withheld too.
- **axe (E5):** parts are the failing check ids (check-owned) and each node's `html` tied to its `axe` reference.
- Fingerprints of `no_fault`, `inapplicable`, `cannot_tell` stay `<checkId>:<outcome>` (check-owned).
- Grouping loses detail inside protected context. That is display only (8.5).
- **Differential tests (4.4):** for each producer, two fixtures that differ **only** in the protected value must give byte-identical fingerprints; the raw 8.2.1 case is included. A plain control that differs in its value must give different fingerprints, which shows that the test can fail.

### 3.7 Effects

- **Check versions.** The axe adapter (`ADAPTER_VERSION`) and families A, B and C change version. Outcomes do not change. Nothing is enabled, so no effective level drops. The working set is rerun at step 11.
- **Records.** Not changed.
- **Over-masking.** Withholding by unprovable identity can mask whole documents that mutate constantly (carousels, live counters). This is the price of failing closed. The harness counts it with controls; the live run reports it.
- **Generated names (gate item 15).** Measured first (4.3, rows G). **No shape-based exemption.** Names that truly trip the current `base64` rule (32 or more of `[A-Za-z0-9+_-]`, with upper case, lower case and a digit) include CSS-module names such as `Header_navigationMenuItem__q8Z3xT1w` and long BEM names with a variant number such as `product-card__image-wrapper--Variant2`. Any later relaxation needs its own provenance rule and leak tests, decided separately.

## 4. The harness

### 4.1 Shape

- **Fixtures.** Synthetic pages served by `serveFixture` (`src/engine/testing/index.ts`) on both origins. Each page group triggers the checks that will carry its markers.
- **Runs.** The real `runAudit` with `allProviders()`; `runCli` with captured output for C1 to C5; one child-process run of `src/cli/main.ts` for C4. Reference-failure rows that need a misbehaving provider (missing, wrong, unsupported reference) run through `runProviders` with a test-only provider and are asserted on the serialised observations, because `runAudit` accepts registry checks only (`validateProviders`).
- **Search.** Every file under the run folder, as bytes, recursively, plus stdout and stderr. Also every temporary file the run creates: the harness gives the run its own temporary directory and lists it afterwards.

### 4.2 Markers, reach and controls

- **Unique prefixes.** Each marker starts with a prefix used by no other marker: `qx` plus three digits plus a hyphen (`qx017-`). The rest is lowercase letters. Markers are shorter than 32 characters, so token masking never hides them by accident. The prefix alone is searched too, so a marker cut by the snippet cap is still found.
- **Escaping markers**, separate from the plain ones:
  - HTML: `qx101-a&b<c>"d'`, planted as text and as an attribute value; searched raw and HTML-escaped (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`).
  - Percent: `qx102-a b/é?&=#`, planted in URL queries, paths and `src` attributes; searched raw, percent-encoded in both cases, and `+`-encoded.
  - JSON: `qx103-a"b\c` plus U+2028 plus a tab, planted in text and attributes; searched raw and JSON-escaped (`\"`, `\\`, ` `, `\t`).
  Token markers (JWT, `sk_live_…`, hex, base64, `password=`) are built token-shaped on purpose.
- **Reach without a carrier on the element.** The first version's carrier (an id on the protected element) does not survive withholding. Instead the engine gets a **test-only probe**: `runAudit` accepts an in-memory `privacyProbe` callback, absent in normal runs. For each evidence item and list member the guard handles, the probe receives the observation id, the evidence id, the list index, the field names withheld, the redactions counted, and the value of a `data-probe` attribute **read by the engine through the same identity reference**. Each planted element carries a probe key, which is itself a prefixed marker. The probe never writes to disk. The harness asserts that no probe key appears anywhere in the run folder or the console, which also proves it is never serialised.
- **Positive and negative assertions per row.** For each row: the probe saw the intended check and field (reach); in the saved file, the field at that observation and evidence id is `[redacted]` and the count matches (negative); the marker is absent everywhere. For each **control**: the probe saw it; the field holds the control marker (positive); the count is as stated. A guard that withholds everything fails the controls; a guard that skips a field fails reach or absence.
- **Diagnostics.** A failure names the marker's prefix, the file (relative to the run folder, or `stdout`/`stderr`), the byte offset, and the JSON pointer of the enclosing string. It never prints the bytes around the match. The temporary folder is deleted on success; on failure it is kept and its path is printed.

### 4.3 Expectation table (step 3)

Places: **Obs** = observation evidence (named field); **Fp** = fingerprint; **Tgt** = `TargetExecution`; **Smp** = sample copy; **Out** = stdout/stderr; **none** = nowhere. "W" lists the fields that must be withheld; "n" is the expected redaction count on the item. Markers are written by their prefix only.

| Prefix | Context | Check, field | Allowed | W, n |
|---|---|---|---|---|
| qx001 | link text in `contenteditable` | 6.2.1 and `axe/link-name`: snippet | none | snippet, locator, note; 3 |
| qx002 | `title` on `<font>` in `contenteditable` | 10.1.1: snippet; axe notes | none | snippet, locator; 2 |
| qx003 | duplicated id inside `contenteditable` | 8.2.1: snippet, locator, note, **Fp**; axe `duplicate-id*` note | none | 3 + 1 Fp |
| qx004–006 | link in each textbox role | snippet | none | 3 |
| qx007 | text in `<html role="textbox">`, no `lang` | 8.3.1 snippet | none | 2 |
| qx008 | link in a framed `designMode` document | snippet | none | 3 |
| qx009 | link in a plain frame of a `designMode` document | snippet | none | 3 |
| qx010 | link in an open shadow root of a role host | snippet, locator | none | 3 |
| qx011 | `<font>` in a closed shadow root under `contenteditable` | 10.1.1 snippet | none | 2 |
| qx012 | slotted link, role host with a slot | snippet | none | 3 |
| qx013 | link in a manual-slot shadow root | snippet | none | 3 (unprovable) |
| qx014–015 | link in a same- / cross-origin frame under a role host | snippet, locator; frame URL in notes | none | 3 |
| qx016 | editable > iframe > cross-origin iframe > closed shadow > link | snippet | none | 3 |
| qx017 | protected elements listed in a pass list | axe `scope_examined` locator member; family C `result.ts:127` member | none | 1 per member |
| qx018 | frame element under a role host, frame not analysed by axe | frame-gap snippet, locator | none | 2 |
| qx019 | class names on a protected faulty element | family C **Fp** | none | 1 Fp |
| qx020 | `input value` (field itself plain) | 11.1.1 and axe snippet | none | sanitiser 1; locator kept |
| qx021 | `textarea` content | snippet | none | 1 |
| qx022–024 | option text, option `label`, option `value` | 11.8.2 snippet | none | 1 each |
| qx025 | `selected` and `checked` set | snippets | attribute names absent too | 1 each |
| qx026 | value typed by script, then reflected with `setAttribute("value")` | snippet | none | 1 |
| qx027 | value inside a link (accname embeds it), via any producer that writes a name | any field | none | per field |
| qx028 | `aria-valuetext` on a combobox | snippet | none | 3 |
| qx029 | `placeholder` inside `contenteditable` | snippet | none | 3 |
| qx030 | the 8.2.1 differential pair | Fp | identical Fp across the pair | — |
| qx040 | reference missing (test provider) | snippet | none | 3 |
| qx041 | reference to a different, plain node (test provider) | snippet | none | snippet 1 |
| qx042 | axe target matching two elements | snippet | none | 3 |
| qx043 | node replaced after capture (script mutates when `window.axe` is defined) | snippet | none | 3 (stale) |
| qx044 | cross-origin frame re-navigated after `collectFrames` | snippet | none | 3 (stale frame) |
| qx045 | frame whose resolution exceeds the guard timeout (busy loop) | snippet | none | 3 |
| qx046 | unknown reference kind (test provider) | snippet | none | 3 |
| qx047 | node detached before the guard | snippet | none | 3 |
| qx048 | two frames with the same selector (reCAPTCHA hypothesis) | snippet | none if unresolved; Obs if resolved by `frameElement()` | — |
| qx050–051 | sample URL query and fragment | Smp, Tgt, Out | none | — |
| qx052 | sample URL path segment | Smp, Tgt, Out | Smp, Tgt, Out | — |
| qx053 | query of a redirect target | `effectiveUrl` | none | — |
| qx054 | query in an iframe `src` | snippet, note, Fp | none | — |
| qx055–056 | sample `fill` value, sample locator | sample copy | Smp only | — |
| qx060 | inside an invalid sample's JSON | Out | none | — |
| qx061 | invalid enum value in a sample | Out | none | — |
| qx062 | message thrown by a page-patched DOM method | `error.message`, notes | none | fixed message |
| qx063 | browser error text (navigation to a refused host with the marker in the path) | not-established reason, Out | path allowed by spec; message fixed (section 5) | — |
| qx101–103 | escaping markers in each context above | as above | as above | as above |
| tokens | page text outside any box | snippet, note, locator | none | sanitiser counts |
| qx200 | plain link text (**control**) | 6.2.1, axe: snippet | Obs | 0 |
| qx201 | plain duplicated id (**control**) | 8.2.1: snippet, locator, note, Fp | Obs, Fp | 0 |
| qx202 | plain link in a cross-origin frame (**control**) | snippet | Obs | 0 |
| qx203 | plain `<font title>` (**control**) | 10.1.1 snippet | Obs | 0 |
| qx204 | plain pass-list members (**control**) | `scope_examined` locator | Obs | 0 |
| qx205 | benign synthetic `placeholder="qx205-sample hint"` outside any box (**control**) | snippet | Obs | 0 |
| qx206 | the plain 8.2.1 differential pair (**control**) | Fp | Fp differs | — |
| G1–G3 | generated names that trip the detector (`Header_navigationMenuItem__q8Z3xT1w`, `product-card__image-wrapper--Variant2`, a CSS-module id) on plain elements | locators | **measured**: today's rule masks them; the count is reported, not asserted | — |

Gate item 16 is covered by qx008, qx016, and every framed row (axe targets with more than one entry).

### 4.4 Differential fingerprint tests

For F1, F2 and E5: two fixtures identical except for the protected value. They run through the real `runAudit`, and the saved fingerprints must be byte-identical. The plain controls (qx206 and plain variants for family C and axe) must differ. Byte search cannot test a digest; this does.

### 4.5 Baseline on a fixed pre-fix revision

Before any guard lands, the harness runs on **`4d4b224`**, whose code equals M2's. The probe does not exist there, so at baseline reach is shown by the leak itself. The baseline must **fail** these rows, which the code shows as leaks: qx003 (snippet, locator, note, Fp), qx002 and qx011 (family B), qx017 (list members), qx019 (family C Fp), qx007 (if the witness is reached), qx022 to qx025 (option and state), qx030 (8.2.1 differential), qx060 (JSON excerpt), and qx062 (pattern masking cannot catch it). Every control must pass. A known-leak row that passes at baseline means the row does not reach its route, and it is fixed before the build is judged. The baseline result is recorded with the revision hash.

### 4.6 Static provenance test

A test parses `src/checks/**` and fails on any template literal or concatenation that feeds `note`, `locator`, `snippet`, `fingerprint` or `message` with an expression outside a reviewed allow-list (numbers, check ids, constants, enumerations). Page-derived text must go through `noteSlots`, `locatorList`, `fingerprintParts` or a classified error. This is the only defence against a check that inlines page text into a string the engine takes as check-owned.

### 4.7 Model payload

`model.enabled: true` gives exit 2. During every harness run, a context route records requests outside the two fixture origins (as `blockedRequests` does); there must be none.

### 4.8 Steps and `expect` (step 10, after step 4)

- `fill` on a field with `qx070`; a failing `click` whose element carries `qx071` in `value`: the step error holds the fixed message of its class and the locator as written (the locator text appears in Smp and Tgt by spec); the value and the call log's markup do not.
- A navigation error on a URL with `qx072` in the query: the step error has a fixed message.
- `expect.visible` on an element with text `qx073`: booleans only.
- A state that types `qx074` into a `contenteditable`: none.

### 4.9 Saved sessions (step 10, after step 5)

A **synthetic** storage-state file, generated by the harness in its temporary folder, never a real one, with `qx080` (cookie value), `qx081` (localStorage value) and `qx082` (origin name).
- **Case 1, spec 8.7: a public page showing personal content when logged in.** Marked `authenticated`. It shows `qx083` as ordinary text (allowed in Obs, Q66 item 5), `qx084` as a field value (none), `qx085` token-shaped (none). Without the session, the page shows none of them.
- **Case 2: a state that navigates to an account page** (`/account?ref=qx086`): `sessionLoaded` true; `qx086` nowhere; `qx083` in Obs only.
- Storage-state markers: none. The file's path: Smp only.
- A missing file, an unreadable file, and invalid JSON containing `qx087`: exit 2; path and error code in Out; the marker nowhere.

### 4.10 Screenshots (step 10, after step 6)

Section 6.5.

## 5. Errors

Every message is classified by origin where it is caught. Only engine-owned text and fixed messages reach an output. The raw message is never written, at any boundary: observation notes, `error.message`, console, not-established reasons, step and session errors, temporary output.

| Class | Examples | Output |
|---|---|---|
| `page` | an evaluation that rejects with an exception thrown in the page; a page-patched method | "the evaluation in the page failed" + frame index |
| `browser` | Playwright or CDP errors: timeout, detached frame, target closed, context destroyed, navigation error (`net::…`) | a fixed message per recognised error (by `name` or a known prefix, never by quoting) + the URL through `Sanitiser.url` where the engine itself holds it; unrecognised: "browser error" |
| `parser` | sample JSON, schema issues, storage-state JSON, `noscript` parsing | "not valid JSON"; schema: issue path + zod issue **code**, no message text; storage state: path + error code |
| `step` (step 4) | a failed `click`, `fill`, `press`, `navigate`, `setViewport` | "step <n> (<action>): <failure class>", plus the locator as written in the sample; never the call log |
| `session` (step 5) | missing, unreadable, invalid storage-state file | path + error code |
| `engine` | `EngineBugError`, validation failure of the run file | engine-built text from ids, enumerations and schema paths only |

- `src/cli/main.ts` prints the error class, the engine-built message, and the stack frames (lines starting `at`), without the first line of the stack, which repeats the raw message.
- `withTimeout` messages and `firstLine` calls are routed through the classifier; `firstLine(e)` on a browser error is removed.
- Unknown origin is treated as `page`: a fixed message.
- **Temporary output.** Today there is none. Any temporary file (screenshot before masking, run file before rename) is written inside the run's own temporary folder, follows the same rules, and is deleted on success and on error. The harness lists that folder (4.1).
- This replaces the first version's "known weak point" for page errors. Row qx062 must pass after the build.

## 6. Screenshots (step 6)

### 6.1 Policy

A screenshot is written only if every sensitive region is proven covered in the final image. Otherwise **no screenshot**. A frame-wide mask is the fallback when only the frame element's geometry is known.

### 6.2 Coordinates

- **Viewport screenshots only** in M3. A full-page capture changes layout while it is taken.
- **Device scale.** The engine reads `devicePixelRatio` and the layout viewport through CDP (`Page.getLayoutMetrics`). The image must measure exactly viewport × scale in each dimension, or the screenshot is suppressed.
- **Regions.** Every form field, every editable box and every element or text node in a box's flat subtree (closed shadow roots and slot assignments from the engine's pierced CDP tree), in every frame. `DOM.getContentQuads` for each. Clipping and `overflow` are ignored: the full quad is masked, which over-masks.
- **Transforms.** Each quad is replaced by its axis-aligned bounding box.
- **Frames.** A same-process frame whose quads come back in root-viewport coordinates and whose frame-element chain carries no transform is masked region by region. For any other frame (out-of-process, a transformed chain, or a frame whose coordinate space cannot be established), the frame element's border quad bounding box, in root coordinates, is masked whole if the frame holds or may hold a region. An unreadable frame may hold one.
- **Absent versus unknown.** A readable, stable frame whose enumeration finds no region is clear. An unreadable frame, a failed `getContentQuads` on a rendered node, or a frame-element quad that cannot be read is unknown. Unknown inside a frame whose element's quad is known gives a frame-wide mask. Unknown at the top level, or for the frame element itself, suppresses the screenshot.
- **Rounding.** Outwards: floor the minimum, ceil the maximum, after scaling, plus a 1-pixel margin.

### 6.3 Timing

The sequence is enumerate, capture, enumerate. The capture is kept only if both enumerations give the same rounded rectangles, the frame tree and `loaderId`s did not change, and the engine's DOM event log (3.3) recorded nothing in between. Otherwise it retries once, then suppresses. An animated page loses its screenshot; that is the conservative outcome.

### 6.4 Masking and files

- Masking is applied to the decoded image by the engine, in memory: opaque black rectangles, `capture.mask` regions included. The masked image is encoded, then written. The unmasked bytes are never written; if a temporary file is unavoidable, it stays in the run's temporary folder (section 5). Playwright's own `mask` option is not used: it resolves locators at capture time, which is a selector route.
- **Open point for Fabien:** decoding and encoding PNG needs either a small in-house codec (zlib is in Node) or a dependency, and none is authorised.
- File names come from target and evidence ids only.

### 6.5 Tests

- Sensitive regions are painted in a unique colour, controls in another, with pages at device scales 1 and 2 (separate fixture contexts), with scrolled content, CSS-transformed iframes, nested cross-origin frames, a closed shadow tree in a box, and a frame that re-navigates during capture.
- The harness decodes each image and checks: the dimensions; no pixel of the sensitive colour, including antialiased edges (a tolerance band around the colour); the control colour present outside the masks; `capture.mask` regions black; masks not larger than the frame-wide fallback, where that is the expectation.
- A case expecting a screenshot fails if no file was written. A missing screenshot passes only in a case that expects suppression: an unreadable top-level geometry, a frame changing at every attempt, a target examined with the session without `capture.screenshots: true`, a target not established.
- PNG metadata chunks are byte-searched for markers, and file names are checked.

## 7. Limits

- Pattern and marker tests cannot show that no secret ever reaches the run folder (spec 8.7). They show that the planted contexts and channels behave as stated.
- Values reflected into ordinary text outside fields and boxes are ordinary text, and are kept. So is a page-generated `placeholder` outside protected context.
- A check that inlines page text into a constant string is caught only by the static test (4.6) and by review.
- A wrong reference with a matching snippet but another node's locator is not detected (3.3).
- Pages that patch DOM methods can make in-page scripts lie. The CDP-side checks (stability, backend ids, `frameElement()`) do not depend on page scripts. The `captured` context does, and the engine's recheck uses CDP data where it can.
- The reCAPTCHA cause on the real site is not identified by fixtures (2.3).
- Derived channels other than fingerprints (counts, lengths, outcomes influenced by a value) are not tested.
- Playwright debug logging and the user's shell are outside the tool.

## 8. Build plan (kickoff step 3)

One writer per directory. The writer of fixtures and expectations never writes the code they test (10.5).

| Part | Directory | Writer | Size |
|---|---|---|---|
| 1. Harness runner: run, console and temporary-folder capture, escaped and prefix search, probe assertions, diagnostics | `tests/privacy/` | test agent A | medium |
| 2. Fixtures and the expectation table as data (4.3), differential pairs (4.4) | `tests/privacy/fixtures/` | test agent A | large |
| 3. **Baseline run on `4d4b224`**; record which rows fail (4.5) | — | orchestrator | small |
| 4. `editable-context.ts`: predicate, `FrameKey` and DOM event log, reference resolution, field rule, counts, fingerprints, `privacyProbe` seam; `types.ts` additions; `run-checks.ts` hook; form-value rule in `sanitise.ts`; error classifier and its use in `target.ts`, `run.ts`, `sample.ts`; `main.ts` output | `src/engine/`, `src/checks/types.ts`, `src/cli/` | core builder B | large |
| 5. Providers emit references, `locatorList`, `noteSlots`, `fingerprintParts` and classified errors; in-page guards removed; 8.3.1 uses the shared source; versions bumped | `src/checks/` | builder C, after part 4's interface is merged | large |
| 6. Static provenance test (4.6) | `tests/privacy/` | test agent A | small |
| 7. Harness rerun; generated-name measurement to Codex; correction rounds | — | orchestrator, then B or C | medium |
| 8. Extensions 4.8, 4.9, 6.5 with steps 4 to 6 | `tests/privacy/` | test agent A | medium |
| 9. Screenshot regions, timing, masking (section 6), after Fabien rules on the PNG codec | `src/engine/` | core builder B, at step 6 | large |

Parts 1, 2 and 3 run in parallel with part 4. Part 5 waits for part 4's `types.ts` change. The existing tests (`tests/engine/editable-*.test.ts`, `tests/checks/axe/editable-resolved.test.ts`) stay. Their assertions on the saved file still hold, except those that expect the box's start tag around the mask; they move to the fixed replacement, a change logged with the reason (3.5).

## 9. Answers to Codex's review

| Finding | Answer |
|---|---|
| 1. Fingerprints and non-node evidence bypass the guard | F1, F2 and E5 added (1.1); fingerprint rule and differential tests (3.6, 4.4); protection by provenance, list members, frame gaps and note slots, with required scope evidence kept (3.2, 3.4) |
| 2. Reference resolution and replacement | identity, stability, lifetime, every failure masked, no selector fallback, 8.3.1 object group (3.3); fixed `[redacted]` replacement and explicit counts asserted on the saved file (3.5) |
| 3. The harness cannot prove reach | test-only probe instead of an on-element carrier, positive and negative assertions per check and field, unique prefixes, escaping markers, reference-failure rows, baseline on `4d4b224` (4.2 to 4.5) |
| 4. Page-derived errors | error classes and fixed messages at every boundary, including temporary output; the weak point is removed (5) |
| 5. Screenshot completeness | coordinates, scale, transforms, frames, timing, rounding, absent versus unknown, frame-wide fallback, suppression, decoded-pixel tests (6) |
| 6. Form values and generated names | Q68 item 1 definition, live values and accessible names, placeholder limit and benign control (0, 2.1, 4.3); measurement first with names that trip the detector, no exemption (3.7, rows G) |
| Shorter answer: sample-copy versus leaks, truncation, encodings, session values through cookies, errors and screenshots | places in 4.3 (Smp versus others), prefix search and escaping markers (4.2), session rows (4.9), error classes (5), screenshot tests (6.5) |
