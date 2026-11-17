# Brief: corrections after Codex's cross-check of all entries

For core builders (Opus 5.5, high effort). Written by the orchestrator on 2026-11-17.

Codex cross-checked all 258 entries. Its report is at `~/Documents/Codex/2026-11-17/rgaa-m1-coverage-independent-review/outputs/rgaa-m1-independent-review.md`. Read the findings named in your part, and the section "Schema and status review". The orchestrator verified the confirmed findings and accepts them. Fabien ruled on four readings: decisions Q45 to Q48, at the end of `docs/decisions.md`. Read those too.

Two builders work at the same time, each in its own worktree. **Builder P** corrects the claims. **Builder Q** corrects how six `none` entries are written up. Their files do not overlap.

## Read first

1. `docs/m1/entry-guide.md`, whole.
2. Codex's report: the findings of your part, and the sections named above.
3. For each entry you change, its file, its check records in `src/rulesets/rgaa-4.1.2/checks.json`, and its packet in `work/packets/by-criterion/` (run `pnpm install` and `pnpm packets` first).

## How to lower a claim

Make the link `evidence_only` and keep it, since the evidence is still useful. Lower the candidate to what the remaining links support, usually `none`. Rewrite the rationale: what the check cannot establish, Codex's counter-example in a sentence, and what would raise the entry. Leave the check record's text as it is, unless the record itself claims something false.

## Builder P: the claims

**Lower to `none`** (confirmed defects or Fabien's rulings):

| Entry | Finding | Reason, in short |
|---|---|---|
| 10.13.2 | F01 | Comparing one point on the component with one point on the wrapper doesn't prove the component shows the content. Browser fixture: `#wrap:hover:not(:has(#dead:hover)) + #extra`. And one Q does not rule out every way the pointer could reach the content. |
| 10.12.1 | F02 | An absolutely positioned descendant whose containing block lies outside the `overflow:hidden` ancestor is not clipped by it. Shown in a browser. |
| 10.11.1 | F03 | A glyph outside the viewport doesn't prove the information is unavailable (a nowrap duplicate of a line that is fully readable just below it). And the list of ancestors it abstains on can't prove the prose isn't part of a two-dimensional layout. |
| 10.6.1 | F04 | The test covers only links « dont la nature n'est pas évidente ». Styling can't settle that, as in « Suivez le lien Documentation pour commencer ». |
| 9.2.1 | F05, F06 | Both links. Missing main: text left outside the landmarks can still be secondary content. Several mains: a main hidden by a transparent `mask-image` counts as shown. |
| 6.1.5 | F20 | The inventory of visible text misses `::marker` and transparent text fill, so it can compare the wrong text. Shown in a browser. |
| 1.9.1 to 1.9.5 | F07, Q47 | Both link families in all five entries. |
| 11.2.2, 11.2.3 | F08, Q48 | An empty attribute is present but doesn't give the field its label. |

**Narrow and keep, if the narrowed rule holds under any reading.** If it doesn't, lower the entry as above.

- **11.9.1 (F09, Q45).** Cite Q45 in the rationale. In the check, write the branch with no labelling source apart from the branch with a present but blank one. Require a proven in-form button, including a button whose form owner is a form it doesn't sit inside, and keep the abstention on names the browser supplies by default.
- **10.5.2 (F10, Q46).** Cite Q46 in the rationale. The witness records the author background declaration that wins and rules out an author text colour applying to the element. It abstains on any case where the default text colour could be the declared intent.
- **8.10.2 (F11).** Fault only when an attribute whose value is not `rtl` or `ltr` (for example `auto`) demonstrably sets the direction of an in-scope passage that runs against the page's direction. Make invalid tokens such as `rlt`, and attributes that don't change the direction, `cannot_tell`. Say in the rationale whether a passage that 8.10.1 validates, carrying a token, is enough for 8.10.2.
- **1.1.3 (F18).** Abstain when the browser exposes a fallback name that isn't one of the four author sources (for example a default "Submit" on an image input), until that reading is ruled on. If almost every image input then abstains, lower the entry instead, and say so.
- **10.1.2 (F12), stays `full`.** Width or height on `iframe`, `video`, `input` or `source` must give `cannot_tell`, never a fault: state that precedence in the check text. Then check every other branch for the same kind of conflict: hidden instances, other namespaces, a page with only exceptions, and a page with an exception and a fault together (the fault must win).

## Builder Q: entries at `none`

Levels stay at `none`. Correct the requirements, routes and rationales:

- **4.12.1 and 7.3.1 (F13).** The keyboard shortcut route covers the keyboard side only. Pointer equivalence still needs its own route or requirement. In 7.3.1, record in the rationale the disagreement between the wording (one equivalent that works by keyboard and pointer) and methodology steps 2 to 5 (possibly two separate controls).
- **3.1.1 to 3.1.3 (F14).** Pair the methodology's examples with the glossary's functional requirement: the other means must actually be usable. A `title` or icon alone isn't enough. Keep the different expected status (non-applicable versus validated) explicit.
- **11.9.2 (F15).** Don't model the methodology's effective-name reading and the wording's every-source reading as two simultaneous requirements. Keep one requirement, and put the alternative reading in the rationale with a distinguishing example. Check the related source-priority issue in 11.2.5, and report it without editing that file unless it's wrong in the same way.
- **4.3.2 (F16).** Its whole-scope link covering every route meets the definition of a resolving link, and its check can answer `no_fault` from a lone decorative, live or unsynchronised video. Fix the check record: no `no_fault` without at least one element shown to be in scope, `cannot_tell` otherwise. Or make the link `partial`. Choose the one that is true, and say why.
- **10.5.3 (F17).** Record the two readings in the rationale. The wording requires a declared background accompanying the image. The methodology's legibility result is separate evidence. The routes must not treat either condition as enough on its own.
- **7.1.3 (F19).** Name both of methodology step 2's evaluations: the accessible name is relevant where present, and it contains the visible name. Record the methodology's dependence on 7.1.1.

## Rules

- **Ownership.** Builder P owns the entry files of its list and the check records they link. Builder Q owns 3.1.1 to 3.1.3, 4.3.2, 4.12.1, 7.1.3, 7.3.1, 10.5.3 and 11.9.2, and 4.3.2's check record. Touch nothing else.
- **`checks.json`.** Change a record by replacing its own text in place. Never re-serialise the file, and never touch another record. A record that no entry links any more stays.
- Keep `enabled: none`. `pnpm validate-coverage`, `pnpm test` and `pnpm typecheck` must pass.
- Commit on your worktree's branch, one commit per entry or per finding. Do not merge, switch branches or push. Do not run any bridge command. End each commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Report back

- One line per entry: candidate before and after, and what changed.
- For each narrowed check: the rule as narrowed, and any further doubtful case you found.
- Entries outside your list that show the same pattern as a finding: caption necessity, empty versus effective source, a methodology reading made into an extra requirement, a prerequisite standing in for a separate rendering. Name them and don't change them.
- Anything in Codex's report you think is wrong, quoting the official text.
- Your branch, commits, and the results of the three commands.
