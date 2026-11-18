# Request: Codex's focused confirmation of the last corrections

From the M1 orchestrator, 2026-11-18. Read-only, as before: edit nothing in the repo. Write your report to your outputs folder and message the orchestrator on the bridge channel when it is there.

## Where

`~/Documents/rgaa-assist`, main at `cc2955b`. Diff to review: `git diff 0e5c28c..cc2955b -- src/rulesets/rgaa-4.1.2`. Your re-check was at `0e5c28c` (correction `8260d67`). Levels are unchanged: none 238, fail_only 16, full 4; every `enabled` is `none`. 414 tests pass; 258 of 258 entries are valid. One builder applied `docs/m1/brief-corrections-4.md`.

## What changed

- **R1, 10.5.2** (stays `fail_only`). A fault now also needs all of the following, otherwise `cannot_tell`:
  - `document.getAnimations()` is readable and lists no animation or transition targeting any element of the text's ancestor chain, or a pseudo-element of one, whatever its play state or fill.
  - No element of the chain has a computed `animation-name` other than `none`.
  - DevTools is readable and reports no keyframes rule, animation style or transition style for the chain.
  - No view transition is active.

  The abstention is deliberately broad: any animation on the chain stops every witness under it.
- **R2, 10.1.2** (stays `full`). Names are compared exactly as parsed, never ignoring case. A "case variant" (a name that becomes a listed or named obsolete attribute only once lower-cased, such as `ALIGN` in an XHTML page or a name set with `setAttributeNS`) gives `cannot_tell` on any element, excepted elements included. A defined pair needs the exact lower-case element name, and an uppercase XHTML element is an unknown element (`cannot_tell`). The fault-first order is kept.
- **11.9.1.** Only one requirement remains (`name-relevant`). The reading where every present source must be relevant is in the rationale as an open question, with no link. Both fault branches rest on Q45. The rationale states the abstention for a non-empty name beside an unrelated lower-priority source.
- **11.9.2.** The "only when" sentence now describes a sufficient case.
- **10.6.1.** The custom link is `partial`. The record says it cannot establish that the link's nature is unobvious or that colour is its only cue, and lists what it never examines.
- **1.9.1 to 1.9.5.** All ten records carry the Q47 caveat.
- **11.2.2 and 11.2.3.** Both records carry the Q48 caveat.
- **10.13.2.** The record now says it samples points, not that it rules anything out.

## What to check

1. Do R1 and R2 close your findings, with every fault still sound under any reading and 10.1.2 keeping a coherent pass, fault and abstention per branch?
2. Is the wording follow-through faithful, with nothing silently chosen?
3. Anything else that should stop the map going to Fabien's gate.

After your answer, the orchestrator proposes the minimum useful set and builds the gate package.
