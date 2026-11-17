# Brief: last corrections after Codex's focused re-check

For one core builder (Opus 5.5, high effort). Written by the orchestrator on 2026-11-17.

Codex re-checked the corrections at `8260d67`. Its report is at `~/Documents/Codex/2026-11-17/rgaa-m1-coverage-independent-review/outputs/rgaa-m1-corrections-8260d67-independent-recheck.md`. Read it whole. The 14 lowered claims are contained, and 11.9.1, 8.10.2 and the write-up fixes hold. Two narrowed checks still need a fix, and some wording needs to follow through. The orchestrator accepts all of it.

## Read first

1. `docs/m1/entry-guide.md`, and decisions Q45 to Q48 at the end of `docs/decisions.md`.
2. Codex's report.
3. The entries and check records named below, and their packets (`pnpm install`, then `pnpm packets`).

## Capability fixes (R1, R2)

- **10.5.2, `custom/10-5-background-without-color` (R1).** An author `color` supplied by a CSS animation or transition (keyframes, a forwards or frozen fill, or one inherited from an ancestor's animation) is a declaration the current text misses. Chrome showed it: a paused animation setting `color: #123456` on a paragraph whose ordinary rules declare none. Make the check establish where the foreground comes from, animations and transitions included, on the element and every ancestor it could inherit from. Abstain if any animation or transition could supply the colour, or if where it comes from can't be established. Keep Q46 as it stands. If you can't state this with confidence, make the link `evidence_only` and the entry `none`, and say why.
- **10.1.2, `custom/10-1-presentation-attributes` (R2).** In an XML document (`application/xhtml+xml`), attribute names are case-sensitive: `ALIGN` is not `align`. Classify by the exact parsed local name wherever case changes which attribute it is. A case variant that isn't the defined attribute gives `cannot_tell`. HTML parsing already lowercases names, so ordinary HTML pages are unaffected. Keep the fault-first order. The entry stays `full` if every branch stays coherent. Also check any other place where the check compares names ignoring case.

## Wording that must follow through

- **11.9.1.** One operational requirement for the Q45 finding (the name-relevant one, which the check links to). Record the reading where every present source must be relevant in the rationale, as an open question with no link. Q45 didn't settle it. Remove the contradiction: the rationale says the no-source branch rests on Q45 alone, and also that both readings fault both branches. When the effective name isn't empty but an unrelated lower-priority source is present, the check must still abstain. Say so if it doesn't already.
- **11.9.2.** The rationale says the two readings can coincide *only* when the effective source is one of the listed ones. Rephrase it as a sufficient case, not the only one.
- **10.6.1.** Make the custom link `partial`, since the check excludes SVG, frames and shadow content. In the check record, add that it can't establish that the link's nature is unobvious, or that colour is its only cue.
- **1.9.1 to 1.9.5.** In the ten check records of the two link families, add the caveat that an exposed, named image doesn't rule out a redundant caption (Q47).
- **11.2.2 and 11.2.3.** In both check records, say the attribute is the only candidate source the check observed, not the field's only label mechanism. A blank attribute doesn't establish that the field is in scope for the relevance test (Q48).
- **10.13.2.** The check record's early wording "to rule out" should describe what the sampling actually does: it samples points, it doesn't rule anything out.

## Rules

- You own the entries and check records named above. Touch nothing else. In `checks.json`, replace a record's own text in place: never re-serialise the file, and never touch another record.
- Keep `enabled: none`. `pnpm validate-coverage`, `pnpm test` and `pnpm typecheck` must pass.
- Commit on your worktree's branch, one commit per item. Do not merge, switch branches or push. Do not run any bridge command. End each commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Report back

One line per item: what changed, and the candidate before and after. For R1 and R2, the rule as narrowed and any further doubtful case. Anything in Codex's report you think is wrong, quoting the official text. Your branch, commits, and the results of the three commands.
