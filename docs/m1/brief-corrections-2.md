# Brief: corrections after Codex's re-check

For a core builder (Opus 5.5, high effort). Written by the orchestrator on 2026-11-17.

Codex re-checked the corrections made after the pilot. Its report is at `~/Documents/Codex/2026-11-12/rgaa-independent-spec-review/outputs/rgaa-m1-corrections-2b12c9a-independent-recheck.md`. Read it whole. The orchestrator verified its findings and accepts them. You apply R1, R2 and one documentation note. R3 waits for Fabien and is not yours. R4 is already applied to the guide.

## Read first

1. That report.
2. `docs/m1/entry-guide.md`, whole. Since the re-check it says: `full` needs every accepted route to be able to pass; `evidence_only` does not remove a positive claim; a fault must rest on a witness that is surely in scope.
3. `src/rulesets/rgaa-4.1.2/coverage/08/8.3.1.json` and the record `custom/8-3-default-lang-present` in `src/rulesets/rgaa-4.1.2/checks.json`.

## 8.3.1 (R1, R2)

- **R2.** The check never answers "no fault" through the second route (language on every text element or a parent), so the entry cannot meet spec 10.4 point 4 at `full`. Lower the candidate. Do not change the spec's bar, and do not argue that route away.
- **R1.** The fault's witness is broader than "text under any reading of the wording". Codex gives two cases where the check would fault but the witness may not be a text element the test covers: an icon-font ligature (`<span class="material-icons" role="img" aria-hidden="true">face</span>`), and text that is laid out but invisible and hidden (`<span aria-hidden="true" style="opacity:0">…</span>`). Narrow the witness so that every such doubtful node makes the check abstain. For example: require the node to be both rendered and exposed, with no `aria-hidden` on it or an ancestor, no zero opacity on it or an ancestor, not clipped to nothing or positioned off-screen, and not in an element with a role of `img` or `presentation`/`none`. Then look for other ways a node could pass the witness and still be doubtful, and abstain on them. An ordinary uncovered paragraph must still be a fault.
- Then choose the candidate honestly. If you can state the narrowed witness so that every fault it gives is a text element under any reading, the link keeps `faultMeans: failure` and the candidate is `fail_only`. If you cannot, make the link `evidence_only` and the candidate `none`, and write what would raise it. Codex's advice: `fail_only` with the current witness is not enough.
- Update the rationale. It should say why the entry is below `full` (the second route can never pass) and what would raise it.

## 11.1.1 (documentation note)

Its rationale says the wording does not say whether a reference to a missing id counts. The route's own citation requires a referenced, identified passage of text, so a field named only by `aria-labelledby="missing"` does not meet that route. Rewrite that sentence: the case is outside what the check supports, not left open by the wording. Change nothing else in 11.1.1.

## Rules

- You own `src/rulesets/rgaa-4.1.2/coverage/08/8.3.1.json`, `src/rulesets/rgaa-4.1.2/coverage/11/11.1.1.json` and the record `custom/8-3-default-lang-present` in `checks.json`. Touch nothing else. Keep `enabled: none`.
- `pnpm validate-coverage`, `pnpm test` and `pnpm typecheck` must pass.
- Commit on your worktree's branch, one commit per entry. Do not merge, switch branches or push. End each commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Report back

For 8.3.1: the witness rule as you narrowed it, the doubtful cases you found beyond Codex's two, the candidate before and after, and why. For 11.1.1: the sentence before and after. Then anything in the report you think is wrong, with the official text. Then your branch, commits, and the results of the three commands.
