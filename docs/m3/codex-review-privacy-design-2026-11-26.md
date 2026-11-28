# Codex review of the M3 privacy design (2026-11-26)

Codex's answer to `bridge ask codex`, run by the M1 orchestration session at Fabien's request ("Queue Codex"), on main `4d4b224`. Copied verbatim: Codex's session was read-only and could not write its own file.

**Disposition: HOLD.** The design identifies real gaps, but the proposed guard does not yet cover all the routes in its own inventory. It should be revised before implementation.

1. **The guard misses non-`dom_node` evidence.** Axe pass locators are stored in `scope_examined`, as are frame-gap snippets and locators. Family C also puts frame selectors in `scope_examined` notes and `text` evidence. Section 3.3 leaves those kinds under today’s treatment, so editable-context data can still escape. Define protection for every page-derived field, including each member of locator lists and frame-gap evidence. See [axe mapping](/Users/fabiencampana/Documents/rgaa-assist/src/checks/axe/map.ts) and [family C results](/Users/fabiencampana/Documents/rgaa-assist/src/checks/custom/family-c/result.ts).

2. **Fingerprints remain a leak.** Family C fingerprints include page-derived classes and frame paths, yet the proposed engine rule leaves fingerprints untouched. Hashing a sanitised snippet also needs to occur *after context masking*: markup sanitisation alone cannot identify an editable ancestor outside the snippet. Define a privacy-safe fingerprint for every provider and test it with guessing-sensitive fixtures. See [family C scan](/Users/fabiencampana/Documents/rgaa-assist/src/checks/custom/family-c/scan.js) and [axe mapping](/Users/fabiencampana/Documents/rgaa-assist/src/checks/axe/map.ts).

3. **Resolution must establish identity and remain valid.** A selector resolving uniquely later can identify a replacement node after DOM or frame navigation; uniqueness alone does not prove it is the node originally examined. Require stable references where possible, verify frame/document identity, and mask on detachment, navigation or ambiguity. The carrier rule also conflicts with masking the carrier’s locator and snippet: use a separate test-only correlation mechanism and require proof that *each intended check and field* was exercised.

4. **Screenshots need a stronger completeness contract.** Frame offsets and CDP quads alone do not specify clipping, transforms, scrolling, nested frames, offscreen regions, or changes between measurement and capture. Establish a coordinate and timing strategy, fail closed when coverage cannot be established, and test these cases. Solid-colour pixel checks are useful but do not establish that all sensitive pixels are covered.

5. **Close page-controlled error leakage now.** E16 is a known route, and pattern masking cannot protect arbitrary messages. Replace untrusted page and browser error text with fixed, classified messages across observation, frame, target, step and CLI paths; retain useful diagnostics only when independently safe. Test the previously omitted `scope_examined` and `text` paths too.

The proposed option-content, `selected` and `checked` treatment is a sensible conservative reading to put to Fabien; keeping placeholders is reasonable as author text, subject to the existing token and editable-context rules. Dropping a check’s free-form note in editable context is defensible if a fixed note preserves the reason for masking. Measure generated-name over-masking before changing the rule; do not exempt selector shapes without evidence that secrets cannot use them.

The inventory’s reported gaps are consistent with the code I inspected, but I did not independently verify every row. The harness should additionally distinguish permitted sample-copy occurrences from leaks in other fields, test actual encodings and truncated markers, and verify synthetic session values cannot enter through cookies, errors or screenshots. The reCAPTCHA fixtures can test hypotheses; they cannot identify the real-site cause on their own.

I cannot determine that this review itself triggers hard stop 4: the kickoff specifies a **second hold on the same family**, so the orchestrator should check the prior review dispositions and chronology before proceeding. The repeated editable-evidence family makes that check necessary.

I reviewed main at `4d4b224`; no tests or live-site runs were performed. I could not write the requested review file because this session’s filesystem is read-only.
