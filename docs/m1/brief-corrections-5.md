# Brief: 10.1.1 element names compared exactly

For one core builder (Opus 5.5, high effort). Written by the orchestrator on 2026-11-18.

Codex confirmed the last corrections at `cc2955b` (R1 and R2 closed). Its report is at `~/Documents/Codex/2026-11-17/rgaa-m1-coverage-independent-review/outputs/rgaa-m1-corrections-cc2955b-focused-confirmation.md`. Read the section "10.1.1 and the remaining M1 work". It holds the M1 decision on one point, which the orchestrator also found.

## The defect

`custom/10-1-presentation-elements` (10.1.1, `full`) compares the listed element names ASCII case-insensitively. In an XML document (`application/xhtml+xml`), names are case-sensitive. Chrome parses `<CENTER>` there as an element whose local name is literally `CENTER` in the XHTML namespace: an `HTMLUnknownElement`, with no centring. Only lowercase `<center>` is the presentation element the methodology lists. The check would fault a lone `CENTER`: a false fault under the defined-element reading. The ordinary HTML parser lower-cases names, so HTML pages are unaffected.

## The fix

Do for 10.1.1 what R2 did for 10.1.2. Read `custom/10-1-presentation-attributes` first and follow its wording where it fits.

- Compare element local names exactly as parsed, never ignoring case.
- A case variant (an HTML-namespace element whose local name becomes a listed name only once lower-cased) gives `cannot_tell`, never a fault. That includes `U` under any doctype.
- Keep the order: a definite fault wins, then `cannot_tell`, then `no_fault`. A page with both a variant and an exact listed element is a fault.
- Keep the `u` doctype rule and every existing abstention unchanged.
- Check the rest of the record for any other place where a name is compared ignoring case. Attribute *values* that HTML defines as case-insensitive (for example a doctype public identifier) are not names: leave them, and say so if you touch nothing.
- The entry stays `full` if every branch stays coherent: pass on an examined clean page, fault on an exact listed element, abstain on variants. Update the entry's rationale where it describes the comparison. If you cannot state this with confidence, say why and do not change the level yourself: report it.

## Rules

- You own `src/rulesets/rgaa-4.1.2/coverage/10/10.1.1.json` and the record `custom/10-1-presentation-elements` in `checks.json`. Touch nothing else. In `checks.json`, replace the record's own text in place: never re-serialise the file, and never touch another record.
- Keep `enabled: none`. Run `pnpm install` first. `pnpm validate-coverage`, `pnpm test` and `pnpm typecheck` must pass.
- Commit on your worktree's branch. Do not merge, switch branches or push. Do not run any bridge command. End each commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Report back

The rule as corrected, branch by branch: ordinary HTML, exact XHTML name, case-distinct XHTML name, `u` with each kind of doctype, a page with both a variant and a definite fault. The candidate before and after. Any other case-insensitive comparison you found. Your branch, commits, and the results of the three commands.
