# Request: Codex's cross-check of all coverage entries (M1 step 5)

From the M1 orchestrator, 2026-11-17. Read-only, as before: edit nothing in the repo. Write your report to your outputs folder and message the orchestrator on the bridge channel when it is there.

## Where

`~/Documents/rgaa-assist`, main at `ff4d6c2`. All 258 entries are written: 224 `none`, 30 `fail_only`, 4 `full`. Every `enabled` is `none`. 414 tests pass; `pnpm validate-coverage` reports 258 of 258 valid.

You reviewed the 14 pilot entries (`51880bb`) and the corrections up to `67d2938`. The other 244 entries were written after, from `docs/m1/entry-guide.md` (with its "Lessons from the pilot") and `docs/m1/brief-entries.md`, by builders A to O, one per row of the brief's table. The orchestrator reviewed every diff, read each claim against the official text, and sent two back (8.3.1 before the batches, 10.13.2 during batch 7). New entries and check records: `git diff 67d2938..ff4d6c2 -- src/rulesets/rgaa-4.1.2/coverage src/rulesets/rgaa-4.1.2/checks.json`.

The official texts are in `src/rulesets/rgaa-4.1.2/official/` (DINUM pin `ca4019f`); `pnpm packets` writes one packet per criterion to `work/packets/by-criterion/` if you want the texts gathered.

## What to check

1. **Every entry above `none` (34)**, first. For each `failure` link: does every fault it can give rest on a witness that is in scope and fails the test under any reading of the official text? For each resolving link (`full`): can every accepted route pass, and does the check abstain wherever a no-fault answer could be wrong (spec 10.4)? The list:
   - `full`: 8.5.1, 10.1.1, 10.1.2, 11.8.2.
   - `fail_only`: 1.1.3, 1.9.1 to 1.9.5, 2.1.1, 2.2.1, 6.1.5, 6.2.1, 8.2.1, 8.3.1, 8.4.1, 8.10.1, 8.10.2, 9.1.2, 9.2.1, 10.5.1, 10.5.2, 10.6.1, 10.11.1, 10.12.1, 10.13.2, 11.1.1, 11.2.1 to 11.2.3, 11.8.3, 11.9.1, 13.2.1.
2. **Claims their writers listed as least sure and kept**, with the orchestrator's agreement. In the pilot the two over-claims were the two least-sure ones, so look hardest here:
   - 1.9.1 to 1.9.5: the `figure` role check (builder K).
   - 8.10.1 (builder B).
   - 9.2.1: the main-missing check (builder D).
   - 10.5.2: it rests on reading its methodology's copied step 1 through the wording (builder L).
   - 10.11.1, 10.12.1, 10.13.2 (builder M). 10.13.2 was narrowed once: it now abstains unless the hovered component itself shows the content.
   - 11.8.2 `full`, 11.8.3, and 11.9.1 (builder N). 11.9.1 reads the six « S'il est présent » conditions as not passing a button with no name at all, through the methodology and the criterion title.
3. **The `none` entries, by sample.** A `none` entry cannot over-claim a result, but it can still be wrong: wrong routes or exceptions, citations that are not verbatim, `applicability: structural` where the test can apply without a structural trigger (it gives `not_applicable` at derivation), or a `needs` that is missing or too wide. Sample at least one entry per theme, and more where the kickoff's error kinds cluster.
4. **The departures between official methodologies and wordings** that writers recorded and resolved by following the wording: 12.4.2 and 12.4.3 (their methodologies look swapped), 11.10.6, 11.10.7, 10.5.2. Do you agree with following the wording in each?

## What the gate needs from you

The kickoff asks for errors counted by kind of entry: axe-linked, several routes, needs state or keyboard or media, structural applicability, other. Please give, per finding, the entry, the kind, the severity, the official text it rests on, and the correction. Say which claims you confirm, not only which you reject.

The schema gaps writers reported are listed under "Findings to report at the gate" in `docs/m1-status.md`; tell the orchestrator if you think any of them hides an error in an entry.

No entry will be enabled, and no conformance is declared. The corrections will follow your report.
