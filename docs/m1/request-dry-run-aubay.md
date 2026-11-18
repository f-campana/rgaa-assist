# Request: Codex's independent dry run on a published audit

From the M1 orchestrator, 2026-11-18, at Fabien's request. Read-only, as before: edit nothing in the repo. Write your report to your outputs folder and message the orchestrator on the bridge channel when it is there.

## Where

- `~/Documents/rgaa-assist`, `main` at `f73b81f`. The orchestrator's annex `docs/m1/dry-run-aubay.md` is not committed yet; it sits in the working tree.
- Nothing has changed in `src/` since `98434bc`. All 125 check records are still `exists: false`.

## What this is

The orchestrator applied the ten entries of the proposed set **by hand**, using scripts typed into Chromium. It used them on the one page of a published RGAA 4.1.2 audit and compared the results with the auditor's. It found:

- one disagreement on a `full` entry;
- two facts it could not establish;
- one order of decision that the check records leave open.

Fabien wants an independent run before his M1 decision. What we're testing is our readings against an auditor's and against a second reader. No code from this repo runs.

- **Audit:** https://ara.numerique.gouv.fr/rapport/6j4x9rUQikBzyJ3a1NI76/, created 2026-06-04, published 2026-08-06. The data comes from `https://ara.numerique.gouv.fr/api/reports/6j4x9rUQikBzyJ3a1NI76`.
- **Page:** https://aubay.com/carriere-accueil/ (live).
- **Snapshots:** the Wayback snapshots `20260617031406` and `20260812055124` of the same URL.
- **The ten tests:** 8.5.1, 10.1.1, 10.1.2 and 11.8.2 (`full`); 8.3.1, 8.4.1, 2.1.1, 6.2.1, 11.1.1 and 8.2.1 (`fail_only`).
  - Entries: `src/rulesets/rgaa-4.1.2/coverage/<theme>/<test>.json`.
  - Check records: `src/rulesets/rgaa-4.1.2/checks.json`.

## What to do

1. **First, your own results, before reading the annex.** You saw a summary on the bridge, so this isn't fully blind. Still, write your table before you open `docs/m1/dry-run-aubay.md`.
   - **What to do:** in a real browser, apply each test's decisive check record (the link whose `faultMeans` is `failure`) to the live page, step by step, as written.
   - **What to give for each test:** the check outcome, the derived status, the elements that decide it, and the auditor's result for the criterion.
   - **Where the record is ambiguous:** say so, and give both answers.
   - **Accessibility tree:** where a record speaks of exposure, read the tree itself, not CSS.
2. **Then compare** with the annex, and explain each difference.
3. **Two facts to establish, at audit time:**
   - **The reCAPTCHA badge `iframe`.** Was it present, with `frameborder`, on the page as rendered? Rendering the 2026-08-12 snapshot is the best evidence available. This is the fact behind the 10.1.2 disagreement.
   - **The second `div id="formulaire"`.** Was it present then? Today a script inserts it.
4. **Frames:** can your browser read the document inside the cross-origin reCAPTCHA `iframe`, and can Playwright? Four records leave open whether "a nested document cannot be read → cannot_tell for the page" comes before "fault if any element has a fault": 2.1.1, 6.2.1, 11.1.1 and 11.8.2. Say whether the order would change any result on this page.
5. **Your reading on the open questions:**
   - **10.1.2:** should it abstain on markup inside or on cross-origin `iframe`s, given that a third-party script inserts them? Is `height` on `table` a defined pair under the record's wording?
   - **Anything else** you'd want settled before Fabien's M1 decision.

## What not to do

Don't contact the site beyond ordinary page loads, and don't submit any form on it. The page has an application form behind reCAPTCHA; leave it alone.
