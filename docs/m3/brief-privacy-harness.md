# M3 brief: privacy harness, baseline slice (build plan parts 1 and 2, for part 3)

You are **test agent A** on rgaa-assist. rgaa-assist is a TypeScript tool that examines web pages against RGAA 4.1.2 and reports evidence, never conformance. You work in your own git worktree.

**Your task:** the privacy harness runner, and the fixtures and oracle for the rows the baseline needs. You are the independent writer of the planted fixtures (10.5): you **write nothing under `src/`**, and you never look for ways to make a leak pass.

**Budget (Q74):** tight. Read only what the task needs, and stop at the scope below. Do not run the whole test suite more than twice.

## Read first

1. `docs/m3/privacy-design.md`:
   - section 0 (terms);
   - 1.1 to 1.3 (inventory: the route each row reaches);
   - 4.1, 4.2 and 4.8 (shape, markers, oracle, baseline);
   - the rows of 4.3 listed below;
   - 4.10 (only the capture wrapper and image-signature check);
   - 8 and 8.1 (build plan and handoff).
2. `src/engine/testing/index.ts` and `server.ts`, which give `serveFixture` (two origins), `withTarget` and the blocked-request rule. Also read the entry points the design names: `runAudit`, `runCli`, and `src/cli/main.ts` as a child process.
3. The existing privacy tests, for style only: `tests/engine/editable-privacy.test.ts`, `tests/engine/editable-frame-context.test.ts`.

## Scope (this slice only)

**Part 1. Runner, in `tests/privacy/`:**
- Fixture serving on both origins, with a run through the real `runAudit` with `allProviders()`. Also `runCli` with captured stdout and stderr, and one child-process run of `src/cli/main.ts`, for the CLI rows.
- Byte search over every file of the run folder, stdout, stderr, the run's temporary folder, and new entries in the system temporary folder. Search for each marker raw, in its escaped forms (HTML, percent, JSON, as in 4.2) and by its prefix alone.
- Diagnostics give the prefix, file, byte offset and JSON pointer, and **never the surrounding bytes**. The temporary folder is kept, with its path printed, only on failure.
- A wrapper that fails the run on any screenshot or screencast call (4.10, Q70), active in every harness run. An image-signature and extension check over the locations searched.
- **Baseline mode (4.8):** a separate entry point that imports only `runAudit`, `runCli` and the byte search. It has no probe and nothing written for the guard, and gives each row one of three verdicts: `leak seen`, `not reached or unproven`, or `control ok` / `control failed`. It prints a table of row, verdict, and the file and offset where the prefix was found, with no surrounding text. It writes nothing outside a temporary folder, and no baseline row ever counts as passing. Expose it as a script the orchestrator runs: `node tests/privacy/baseline.ts`. Keep it out of `pnpm test`.
- **Post-build mode:** the oracle comparison (protected pieces saved as exactly `[redacted]` with the expected count; plain pieces with the exact expected text), with no probe yet, because the probe seam does not exist until part 4. Leave a clearly named place for the probe check. These tests fail on today's code by design, so put them where `pnpm test` does not pick them up, for example `tests/privacy/*.privacy.ts` with a `vitest.privacy.config.ts` and a `test:privacy` script. **`pnpm test` and `pnpm typecheck` must stay green.**

**Part 2. Fixtures and oracle, in `tests/privacy/fixtures/`, for these rows of design 4.3 only:**
- Baseline leak rows: qx002, qx003, qx011, qx017, qx019, qx022 to qx025, qx030 and qx035 (differential pairs), qx031, qx032, qx060, qx062, qx064.
- Escaping markers qx101 to qx103, planted in qx001, qx031 and qx050. Include qx001 and qx050 themselves.
- Controls qx200 to qx212.
- Q72 slot row qx213, with its control qx214.

For each row, the oracle states, from the fixture source alone:
- the check that must report it;
- the pieces;
- the number of evidence items;
- the expected saved value (`[redacted]` plus its count, or the literal text);
- where the marker may appear.

Every marker follows 4.2: a unique `qxNNN-` prefix, lowercase letters after it, under 32 characters. Fixtures are synthetic: no real site, no download, no real saved session, nothing from `corpus/acceptance/`.

**Out of scope here:** composite rows qx037 to qx039 and qx215 to qx219, adversarial providers (4.4), the probe, step and session rows (4.9), and the static check (4.6). These come later. List them in your report as not done.

## Rules

- You own `tests/privacy/`, plus `package.json` scripts and a `vitest.privacy.config.ts` if you need them. Touch nothing else: no `src/`, records, spec, decisions or other docs. Add no dependency.
- Do not copy page bytes around a found marker into any file, log or report.
- When done: run `git merge --ff-only main` first if your branch is behind. Commit on your branch with a message ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- Report:
  - the branch and commit;
  - what is built;
  - how to run the baseline and the post-build suite;
  - `pnpm test` and `pnpm typecheck` results;
  - one baseline run's verdict table, if you ran it (verdicts and locations only);
  - anything in the code that differs from what the design assumes;
  - your token count if you can see it.
