# Request: Codex's focused re-check of 10.1.1

From the M1 orchestrator, 2026-11-18. Read-only, as before: edit nothing in the repo. Write your report to your outputs folder and message the orchestrator on the bridge channel when it is there.

## Where

`~/Documents/rgaa-assist`, main at `98434bc`. Diff to review: `git diff 0de69a3..98434bc -- src/rulesets/rgaa-4.1.2`: one record (`custom/10-1-presentation-elements`) and one rationale (10.1.1). Levels unchanged: none 238, fail_only 16, full 4; every `enabled` is `none`. 414 tests pass; 258 of 258 entries are valid. One builder applied `docs/m1/brief-corrections-5.md`.

## What changed

- Element names, and the doctype name, are compared exactly as parsed, never ignoring case. A **case variant** (an HTML-namespace element whose local name becomes a listed name, or multicol, nobr or spacer, only once lower-cased: `CENTER`, `Font`, `U` in XHTML, or such a name given to `createElementNS`) gives `cannot_tell` under any doctype, and in shadow trees, frames, template content and noscript text as for listed elements.
- Order of decision is explicit: (1) fault, (2) `cannot_tell`, (3) `no_fault`. A fault wins over every case of (2), variants included.
- A doctype written `<!DOCTYPE HTML>` in an XML document keeps the name `HTML`, so it is not the HTML 5 doctype. The only effect: a lowercase `u` there gives `cannot_tell` instead of a possible `no_fault`.
- **Noscript, added by the orchestrator after the builder flagged it:** in XHTML, `noscript` content is parsed as elements, so a `center` inside it fell into the fault branch while the entry's rationale treats noscript content as an open question. A listed element or variant with a noscript ancestor now gives `cannot_tell`, whatever the parsing. A fault elsewhere still wins.

## What to check

1. Does 10.1.1 now fault only under any reading, with a coherent pass, fault and abstention per branch: ordinary HTML normalisation, exact and case-distinct XHTML names, the `u` doctype exception, noscript content, and a page with both a variant and a definite fault? Does it stay `full`?
2. Anything else that stops the map going to Fabien's gate. The gate draft is `docs/m1/gate-package.md`.
