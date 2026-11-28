# M3 brief: engine guard, first slice (build plan part 4)

You are **core builder B** on rgaa-assist. rgaa-assist is a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree.

**Your task:** the first slice of the engine guard of `docs/m3/privacy-design.md`, as a module with its own unit tests. **It is not yet wired into `run-checks.ts`.** Wiring comes with part 5, when providers emit sources. Until then, `pnpm test` must stay green.

## Hard deadline (Q75)

Run `date -u` at the start and after each step.
- **Commit after every step that typechecks.** Never leave more than about 20 minutes of work uncommitted.
- **At 15:30 UTC at the latest:** stop, make sure what you have typechecks (revert or stub any half-written piece), commit, and report. Do not push.
- You may be stopped without warning after 15:40 UTC. Anything uncommitted at that point is lost.

## Read first, and only this

1. `docs/m3/privacy-design.md`:
   - sections 0, 2.1, 2.2 and 2.3;
   - 3.1 to 3.6, including 3.4a;
   - 5;
   - 8 and 8.1.
2. `src/checks/types.ts`.
3. `src/engine/sanitise.ts`, `src/engine/editable-box.json`, and `src/engine/run-checks.ts` (to see where the guard will plug in, not to change it).
4. `src/checks/axe/editable.ts`, and the context predicate used by families A and C, so you can reuse them as the shared predicate.

## Scope, in this order

1. **Types (`src/checks/types.ts`).** Add the source and derivation types of 3.2 as optional additions: `NodeRef`/`FrameKey` sources, typed derivations, `{ template, slots }` notes, `locatorList`, and fingerprint `{ label, parts }`. Existing providers must compile unchanged. Nothing in the frozen schemas changes.
2. **`src/engine/editable-context.ts`, the in-page part.** One function, evaluated in the page, that takes a node and returns:
   - its protected-context verdict, using flat-tree ancestry through `assignedSlot` and shadow hosts, frames, and `designMode` (2.2, 2.3, 3.4a);
   - its field-rule output: the allow-list, contents withheld, the live-value match with normalisation as in 2.1, run on decoded values;
   - for composites (`outer`, `startTagAndText`, `textRange`), the guarded serialisation of 3.4a. That means the walk over emitted nodes only, template content entered explicitly, `noscript` by its parsed form, all or nothing, and counts per 3.4a.

   Escaping happens only at serialisation. Any failure or unknown case returns "withheld", with a reason code.
3. **The Node side.** Turn the in-page results into pieces: `[redacted]` replacements, counts per 3.5 (fingerprint withholding attributed once to `evidence[0]`), and fingerprint parts per 3.6. Every page string goes through the existing sanitiser afterwards.
4. **Unit tests in `tests/engine/editable-context*.test.ts`,** using `withTarget` from `src/engine/testing/` on small synthetic pages:
   - a field inside a plain ancestor;
   - a live value reflected into `title` and into a neighbour;
   - a one-character value;
   - `checked` and `selected` dropped;
   - an editable descendant replaced whole;
   - a slotted light-DOM child under an editable shadow element (withheld), with a no-shadow control;
   - template content;
   - an ampersand, quote and non-ASCII value;
   - a forced failure that withholds the whole composite with count 1;
   - plain controls that keep their text.

   Use your own `zz`-prefixed strings, not the harness's `qx` markers. Do not read `tests/privacy/`, because the harness is written independently of you (10.5).

**Out of scope for this slice:** wiring into `run-checks.ts`, the axe identity condition with its CDP DOM event log, `FrameKey` stability across reads, the probe seam, error classes (section 5), and anything in `src/checks/` other than `types.ts`. List what you reached and what is left.

## Rules

- You own `src/engine/editable-context.ts`, `src/checks/types.ts` (additions only), and `tests/engine/editable-context*.test.ts`. Touch nothing else. Add no dependency, download nothing and load no real site. Do not read `corpus/acceptance/` or `tests/privacy/`.
- `pnpm typecheck` and `pnpm test` stay green. Run the full suite at most twice. Use `pnpm vitest run tests/engine/editable-context` while you work.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- Report:
  - branch and commit;
  - the steps done and the steps left;
  - test and typecheck results;
  - any point where the code differs from the design;
  - your token count if you can see it.
