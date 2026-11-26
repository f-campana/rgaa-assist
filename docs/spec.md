# rgaa-assist: specification

**Status:** approved by Fabien on 2026-11-15, as draft 0.4. Nothing is built. The text Codex re-checked has sha256 `f31c72b358a3…`; this file differs from it only in the status lines changed on approval (this header, the Spec row in 14.1, one line in 17.1).
**Changes from 0.3:** three corrections after Codex's re-check of 0.3: the approval hash (G1), how facts about a requirement are combined (G2), and the logged-out guarantee. It also records decision Q37: the pre-M1 model check is shelved (14.3, 17.1). Draft 0.3 had answered the re-check of 0.2 (F1 to F5, Q35, Q36), and draft 0.2 the first review (R1 to R9, Q29 to Q34). Section 18 maps each finding to the text that answers it.
**Next:** M1, started from `docs/m1-kickoff.md` after a weekly reset (14.3). Any later change to this spec goes through the orchestrator and, where it touches a decision, through Fabien (14.4).
**Amended after approval, on 2026-11-16, by Fabien's decisions:** the M1 ceiling is counted from the usage baseline (Q38, 14.3). Opus 5.5 takes over as orchestrator if Fable 5.2 becomes unavailable (Q39, 14.2). The third official data file is named `methodologies.json` (13). Codex has not re-checked these lines.
**Amended on 2026-11-17, by Fabien's decision Q40:** `applicability` gains a third value, `always` (6.1, 8.3, 10.4), after Codex's cross-check of the pilot entries. Decisions Q41 and Q42 change how M1 is run, not this text.
**Amended on 2026-11-17, by Fabien's decision Q43:** on an `always` entry, one inapplicable requirement is enough for "needs review", not only all of them (8.3 step 4), after Codex's re-check of the corrections.
**Amended on 2026-11-26, by Fabien's decision Q66:** screenshots also black out form fields and editable boxes, and `capture.screenshots: false` turns them off on a target examined without the saved session (7.1, 8.7). The M3 gate tests that nothing is sent to a model; the payload test stays with M6 (8.7, 14.1). Codex has not re-checked these lines.
**Amended on 2026-11-26, by Fabien's decision Q70:** no screenshots in v1; `capture` has no effect, and the M3 gate asserts that no image file is written (7.1, 8.7, 14.1). Replaces the screenshot part of Q66. Codex has not re-checked these lines.
**Inputs:** `docs/decisions.md` (decisions Q1 to Q43, and later decisions where an amendment line names them). Where this spec and that file disagree, the decisions file wins and the disagreement is a defect in this spec.

---

## 1. Purpose

rgaa-assist helps a person audit a website against RGAA. It loads a sample of pages in a real browser, runs the checks a machine can decide, collects evidence for the rest, and produces a per-criterion grid that a human finishes.

It is built first for Fabien's own sites and client sites. It may become a product later, only if it proves good (Q1). v1 is labelled experimental (Q29).

### Non-goals

- It does not declare conformance, compute a conformance rate, or draft an accessibility statement (Q3, Q7, Q13).
- It does not replace the audit that RGAA requires.
- It does not crawl sites or choose the sample (Q10).
- It does not record the human's review decisions. The human finishes the audit elsewhere (amended Q12).
- Section 15 lists everything else that is out of scope for v1.

## 2. The claim boundary (hard rule)

The tool is an audit assistant. This rule overrides every other requirement in this spec.

1. No output may state or imply that a site conforms, partly conforms or does not conform to RGAA, WCAG or any law.
2. No output may show a conformance rate, a score or a grade. None is computed, even internally.
3. Every standalone output carries the same three statements: the HTML report, the CSV grid, the run file, and every result returned by the library or the MCP server. An explanation written around the output by someone else does not count.
   - **What was covered:** the ruleset and version, the pages and states actually examined, and the number of tests the tool decided on its own.
   - **What was not covered:** the tests left for human review with the reason for each, the targets that could not be examined, and the parts of the sample the tool cannot verify.
   - **What this is not:** "This report is not a compliance declaration and cannot be used as one. A conformance statement requires a complete audit by a competent person, inside the organisation or outside it."
4. **What "passed" means.** `passed` applies to one named test, on one target that was confirmed to be the requested one, under the prerequisites recorded for that run. It is produced only where the coverage map enables it (section 6).
5. **What "failed" means.** `failed` is produced only where the coverage map states that the observed fault proves the test fails under every alternative and exception in the official wording.
6. **What an aggregate means.** A result for a page, a process or the sample describes what was examined. It does not establish that the sample is adequate.
7. Model output never changes a status (section 9).
8. Status letters borrowed from audit grids (C, NC, NA, NT) always appear with a legend saying they are local automated results, not audit conclusions.

Any ambiguity about this boundary during the build is a hard stop (section 14.4).

## 3. Vocabulary

Use these words with these meanings in code, tests, reports and agent prompts.

| Term | Meaning |
|---|---|
| **Ruleset** | A versioned standard the tool can report against, such as RGAA 4.1.2. A plug-in. |
| **Criterion** | One requirement of a ruleset. RGAA 4.1.2 has 106. |
| **Test** | One checkable question under a criterion. RGAA 4.1.2 has 258 in the official data file. |
| **Sample** | The pages a human chose for the audit, written in the sample file. |
| **State** | A page after a described series of steps. The page as loaded is the state named `initial`. |
| **Target** | One page in one state. The unit that gets examined. |
| **Process** | An ordered set of pages a user goes through to complete one task, such as a multi-page form. |
| **Check** | Code that examines a target and returns observations. It belongs to no ruleset. |
| **Observation** | What one check saw on one target: an outcome plus evidence. |
| **Evidence** | A recorded fact that supports an observation. |
| **Requirement** | One thing a test demands. A test is satisfied only when all its requirements hold. |
| **Route** | One accepted way to meet a requirement. Some requirements accept several. |
| **Link** | The rule in a coverage map that says what one check's outcome means for one requirement of one test. |
| **Finding** | The status of one test on one target, derived from observations through links. |
| **Coverage map** | For each test: its links, and what the tool is allowed to conclude. |
| **Run** | One execution of the tool on one sample. Produces one run file. |

## 4. Background facts the design depends on

Checked on 2026-11-12. Section 16 gives the source of each and who checked it.

- **RGAA 4.1.2** has 13 themes, 106 criteria and 258 tests in the official `criteres.json`. It is based on WCAG 2.1. The same repository holds the glossary and the methodology as data files.
- **The official sample** has three parts, each "when they exist".
  - Fixed pages: home, contact, legal notice, accessibility statement, sitemap, help, authentication.
  - Added pages: at least one relevant page for each type of service and each other main use, including search. At least one relevant downloadable document for each type of service, where there is one. Every page of a process. Examples of pages with a clearly distinct look or type of content.
  - Random pages: at least 10% of the sample described above.
- **The official calculation.**
  - A criterion is validated on a page when every element of the page passes. One failing element is enough to fail it.
  - For a page that belongs to a process, a criterion is validated only if it is validated on every page of that process.
  - Across the sample, a criterion is validated only if it is validated on every page, and it is applicable if it applies on at least one.
- **Who may audit.** The organisation itself or a third party. The method requires reliability, not a particular certification.
- **RGAA 5** is announced for publication in December 2026, with a decree expected in 2027. The announcement says it moves to WCAG 2.2, introduces blocking non-conformities and removes the average rate. Its final content is not published, so everything about it here is provisional.
- **ARA**, the official audit tool, exports an audit as CSV and has no audit import. Its API is documented for local use, with no supported contract for third parties on the hosted service.
- **The official audit spreadsheet** contains formulas that compute conformity rates.
- **axe-core** 4.14 has 67 rules tagged with RGAA test numbers, covering 40 distinct tests. Some of those rules are best-practice or experimental. A tag is a hint about relevance. It is not a statement that the rule decides the test.

## 5. Architecture

One TypeScript package (Q15). Five parts, each with one job. Dependencies point one way, from top to bottom of this list.

1. **Interfaces.** The CLI, the library entry point, later the MCP server and the skill (section 11). They parse input and call the engine.
2. **Engine.** Reads the sample, establishes each target in the browser, runs checks, hands observations to the ruleset, writes the run file.
3. **Rulesets.** One plug-in per ruleset version. Each holds its official data, its coverage map and its reduction policy.
4. **Checks.** Each check examines a target and returns observations. Three kinds: the axe adapter, custom deterministic checks, and model-judged checks.
5. **Reporters.** Turn a run file into the grid and the reports. They read the run file only.

### 5.1 The neutral core (Q8)

- Checks know nothing about rulesets. A check returns observations under a stable check id.
- A ruleset plug-in maps check outcomes to its own tests through links, and owns the rules for combining results.
- One run can report against several rulesets from the same observations. v1 ships `rgaa-4.1.2` only.
- **RGAA 5 is a design objective, not a promise.** The reduction policy lives in the plug-in so that a blocking rule can be added there. New kinds of evidence or context may still require engine work once the final text exists.

### 5.2 Ruleset plug-in contract

A plug-in provides:

- `id` and `version`.
- The criteria, tests, glossary and methodology, in the official wording and language (Q26), vendored from a recorded source commit.
- The coverage map (section 6).
- `deriveFindings`: the status of each test on one target (section 8.3).
- `reduce`: results per page, per process and for the sample (section 8.4).
- `checkSample`: warnings about the sample (section 7.5).

The TypeScript signatures are fixed in M1 and become contract tests.

## 6. Coverage map

The coverage map is the tool's central claim about what it can and cannot conclude. Fabien approves it (Q23, Q32).

### 6.1 One entry per test

258 entries for RGAA 4.1.2. Each holds:

| Field | Content |
|---|---|
| `test` | Test id, for example `1.1.6`. |
| `requirements` | What the official wording demands, listed one by one. Each requirement has its accepted routes (one or more) and its exceptions. |
| `links` | One per contributing check and requirement (6.2). |
| `candidate` | What the entry argues the tool could conclude: `none`, `fail_only` or `full`. |
| `enabled` | What the tool is allowed to conclude today. Never more than `candidate`. |
| `applicability` | `structural` when "not applicable" follows from the absence of certain elements in the whole examined scope. `always` when the test applies to every page, so the tool never says "not applicable" for it (Q40). Otherwise `judgment`. |
| `needs` | Prerequisites: any of `state`, `keyboard`, `media`, `model`, `assistive_tech`. |
| `rationale` | Why, citing the official test wording and glossary entries used. |

How a test is broken down:

- A test is satisfied only when **all** its requirements hold.
- A requirement holds for an element when **any one** of its routes holds, or an exception applies.
- Example. Test 1.1.6 has one requirement: each image object that carries information has an accessible alternative. It has three routes: a text alternative with `role="img"`, an adjacent link or button to alternative content, or a mechanism to replace the object.

Levels:

- **none.** The tool concludes nothing. Always "needs review". This is the default for every test.
- **fail_only.** The tool may say "failed" through links that allow it. It may never say "passed" or "not applicable".
- **full.** The tool may also say "passed" and, with `structural` applicability, "not applicable".

### 6.2 Links

A link states what one check's outcome means for one requirement of one test. A check that speaks to two requirements has two links.

| Field | Content |
|---|---|
| `check` | Check id, for example `axe/object-alt`. |
| `requirement` | The requirement this link speaks to. |
| `routes` | The routes and exceptions of that requirement that the check examines. |
| `scope` | `whole` when the check examines every element the requirement applies to. Otherwise `partial`. |
| `faultMeans` | `failure` or `evidence_only`. |

A link is **resolving** when its check examines every route and every exception of the requirement, with `scope: whole`. Only a resolving link can establish that a requirement holds.

Rules:

- `faultMeans` is `failure` only when the check examines **every** route and exception of the requirement, so that a fault violates it whichever route the page chose. If any route is not examined, it is `evidence_only`: the fault is kept as evidence and proves nothing on its own.
- **Checks combine by "and" only.** Across checks, the tool combines requirements: all must hold. The routes of one requirement are never pieced together from several checks. One check examines them all, or the requirement stays unresolved. This avoids having to prove that two different checks were looking at the same element.
- Checks that each cover part of a requirement's elements are not combined either. One check covers the whole scope, or the map splits the requirement by element type and says so in the rationale.
- Example. axe's `object-alt` examines only the first route of test 1.1.6. Its link is `evidence_only` and not resolving. The tool could say "passed" on 1.1.6 only through a check that examines all three routes for every image object. This example does not claim that such a check is possible in v1: the third route may need human judgment, in which case the entry stays below `full`.
- **A resolving check must abstain when it cannot resolve.** If it could not examine a route, an exception or part of the scope for some element, it answers `cannot_tell` or `error`. Finding one element that passes is never enough to answer `no_fault`.
- A test may be `full` only when every requirement has a resolving link. A test that needs keyboard, state or assistive-technology work cannot be `full` on checks that do not do that work. Whether the prerequisites in `needs` were met is verified again in each run (8.3).
- An axe RGAA tag justifies creating a link. It justifies nothing about `faultMeans`, `routes` or `scope`.
- axe rules marked best-practice or experimental are off unless a link names them and the rationale says why.

### 6.3 Candidate and enabled (Q32, Q36)

- **M1 delivers the candidate map:** every entry argued from the official text. Nothing is enabled beyond `none` at M1, because no corpus exists yet.
- **Enabling needs corpus cases** that pass the bar in section 10.4 for that entry.
- **Who may enable:**
  - Lowering `enabled` or `candidate`: anyone, with a logged reason.
  - Enabling "failed" (`fail_only`, or a link moving to `failure`): Fable and Codex together, with the corpus cases.
  - Enabling "passed" or "not applicable" (`full`): Fabien, in a batch at a milestone gate.
- **Approval covers content, not a level (Q36).** An approval is recorded with the approved level and a hash of the whole entry: every field, including the test id, `needs` and `rationale`. Only `enabled` is outside the hash, because the approval records it. No other field is left out, so nobody has to judge which ones matter.
  - Any later change to an enabled entry needs the same approval again. Until it has it, the entry runs as `none`.
  - Going down is always free. Lowering `enabled` keeps the approval valid at the lower level. Any other edit, including demoting a link, sends the entry to `none` until it is approved again.
  - Example, and a contract test. A `full` entry has `needs: ["keyboard"]`. Removing `keyboard` changes the hash, and the entry runs as `none` until Fabien approves it again.
- **Checks are pinned too.** The evaluation summary (8.6) records the version of each linked check. If a linked check differs from the version that was measured, the entry runs as `none` until its corpus cases pass again on the new version. That needs no new approval, because the entry did not change.
- The run file records the hash of the map used. A report can therefore always say what the tool was allowed to conclude at the time.

### 6.4 The minimum useful set (Q34)

M1 names a short list of tests that v1 must be able to decide correctly. The list is part of what Fabien approves at M1. v1 cannot be accepted while any test on the list is not enabled as argued.

### 6.5 Who validates the interpretations (Q30)

- Every `rationale` and every corpus label cites the official wording. An interpretation that cannot be derived from the official test, glossary and methodology text is not made: the entry stays `none`.
- Codex cross-checks entries and labels.
- Fabien spot-checks at M1.
- No trained RGAA auditor is involved. This is the weakest point of the project (section 17.2).

## 7. The sample file

A JSON file written by a human (Q10), validated against a JSON Schema that ships with the tool.

```json
{
  "project": {
    "name": "Example site",
    "ruleset": "rgaa-4.1.2",
    "regime": "to_confirm",
    "reportLanguage": "en"
  },
  "model": { "enabled": false, "allowAuthenticated": false },
  "session": { "storageState": "./.auth/state.json" },
  "viewport": { "width": 1280, "height": 800 },
  "absentKinds": ["sitemap", "help"],
  "services": [
    { "id": "contact-request", "name": "Send a message" },
    { "id": "account", "name": "Manage my account" }
  ],
  "processes": [
    { "id": "signup", "name": "Sign up", "steps": ["signup-1", "signup-2"] }
  ],
  "documents": [
    { "url": "https://example.com/terms.pdf", "service": "account" }
  ],
  "pages": [
    {
      "id": "home",
      "url": "https://example.com/",
      "kinds": ["home"],
      "states": [
        {
          "id": "menu-open-mobile",
          "steps": [
            { "setViewport": { "width": 375, "height": 812 } },
            { "click": "role=button[name='Menu']" }
          ],
          "expect": { "visible": "role=button[name='Menu'][expanded=true]" }
        }
      ]
    },
    {
      "id": "account-home",
      "url": "https://example.com/account",
      "kinds": ["service"],
      "service": "account",
      "authenticated": true,
      "expect": { "url": "https://example.com/account", "visible": "role=heading[name='My account']" },
      "capture": { "screenshots": false, "mask": [] }
    },
    { "id": "signup-1", "url": "https://example.com/signup", "kinds": ["process_step"] },
    { "id": "signup-2", "url": "https://example.com/signup/details", "kinds": ["process_step"] }
  ]
}
```

### 7.1 Fields

- **`project.regime`**: `rgaa_article_47`, `eaa`, `none` or `to_confirm`. Default `to_confirm`. It is the user's own statement, printed in the report. It changes nothing else, and the tool does not assess which law applies.
- **`project.reportLanguage`**: `en` (default) or `fr` (Q26).
- **`model`**: section 9.
- **`session.storageState`**: optional path to a Playwright storage-state file the user created (Q17). The file is sensitive. The tool reads it and never copies it. It is loaded only for pages marked `authenticated`.
- **`absentKinds`**: fixed page kinds that do not exist on this site. This tells "does not exist" from "forgotten".
- **`services`**: the types of service the site offers, as the human sees them. Pages and documents refer to them by id.
- **`processes`**: each process with its pages in order.
- **`documents`**: downloadable documents that belong in the sample. The tool does not examine them (Q28). They are listed in the report as work for the human.
- **`pages[].kinds`**: one or more of `home`, `contact`, `legal_notice`, `accessibility_statement`, `sitemap`, `help`, `authentication`, `service`, `search`, `process_step`, `distinct_template`, `random`.
- **`pages[].authenticated`**: `true` to examine this page with the saved session. It requires `session.storageState`; without it the sample is invalid.
  - Every other page is examined in a browser context without the session, as a logged-out visitor.
  - **The saved session is the only supported way to be logged in (Q17).** A sample must not log in by other means: no address that carries a credential, no one-time login link, no steps that complete a login. The tool cannot detect such inputs, and their content would not be protected as authenticated.
  - The flag describes how the page is examined, not whether its address requires a login. A public page that shows personal content to a logged-in user must be marked `authenticated` to be examined that way, and then gets the same protections (8.7).
- **`pages[].capture`**: section 8.7. It has no effect in v1, which takes no screenshot (Q70).
- **`safeQueryParams`**: optional list of query-string parameter names whose values may be kept in outputs. All others are masked (section 8.7).
- A sample with no pages is invalid.

### 7.2 Steps (Q16)

Five actions, no more: `navigate`, `click`, `fill`, `press`, `setViewport`.

- Targets are Playwright locator strings. Role and label locators are preferred.
- `fill` refuses any field of type `password`. Credentials are never typed by the tool (Q17).

### 7.3 Expectations (Q31)

`expect` says what must be true before a target is examined. It is not an action.

- Shape: `visible` (a locator that must be visible), `url` (the address the page must be on), or both.
- **Required** on every state other than `initial`, and on every page marked `authenticated`. On such a page, the page's own `expect` is checked after loading, before any state's steps run.
- The engine waits for it up to a fixed time limit.
- If it is not met, the target is "not tested" with reason `target_not_established`. A login page reached by redirect is never examined in place of the page that was asked for.
- **A state's expectation must tell that state apart from the page as loaded.**
  - When the steps do not change the address, the address proves nothing. For a form showing its errors, use the visible error summary.
  - A landmark that is present before the steps proves nothing either. For an open menu, use the button in its expanded state, as in the example above.
  - When the steps lead to another address, that address can be enough.
- **The engine enforces this.** For a state with steps, it evaluates `expect` once on the page as loaded, before the steps. If it is already met, the target is "not tested" with reason `expect_already_met`.
- This is a guard, not a proof. It catches an expectation that is true from the start. It cannot catch one that becomes true by itself while the steps run.

### 7.4 Establishing a target

- **Each target starts from a fresh browser context.** The engine loads the page, then replays that state's own steps. No state inherits the viewport or the changes of another.
- **A fresh context is not a logged-out context by itself.** The saved session is loaded into a target's context only when its page is marked `authenticated`. All other targets get a context with no saved session.
- For each target the engine records the requested address, the address actually reached, the viewport asked for and applied, whether the saved session was loaded, the outcome of each step, and the outcome of `expect` before and after the steps.
- A failed step gives "not tested" for that target. The run continues with the others.
- **Checks run only on an established target.** Nothing is examined, captured or sent on a target that was not established.

### 7.5 Sample check (Q10)

`checkSample` returns warnings. It never blocks a run. It reports two separate things.

**What it can check from the file:**
- A fixed kind that is neither present nor listed in `absentKinds`.
- A declared service with no page.
- A declared process with a step that is not in `pages`.
- A `process_step` page that belongs to no declared process.
- Fewer random pages than 10% of the other pages, rounded up. Pages are counted, not states. A page counts as random only when `random` is its only kind.

**What it cannot check, and says so in every report:**
- Whether the declared services and processes are all the site has.
- Whether pages marked `distinct_template` represent the site's variety.
- Whether pages marked `random` were chosen at random.
- Anything about the listed documents.

Sample warnings and the list of targets that were actually examined are separate fields in the run file and separate blocks in the report.

## 8. Examination, findings and evidence

### 8.1 Browser

- Chromium through Playwright (Q9, Q28).
- Animations are reduced. Timeouts are fixed defaults, overridable per run.
- The tool makes no request other than loading the sample's pages and what those pages load themselves.

### 8.2 Statuses

Five statuses (Q13):

| Status | Meaning | Produced when |
|---|---|---|
| `passed` | The test is satisfied on this target. | The entry is enabled `full`, its prerequisites were met in this run, and every requirement is established by a resolving check. |
| `failed` | A fault that proves failure was found. | A link with `faultMeans: failure`, on an entry enabled `fail_only` or `full`. |
| `not_applicable` | The test does not apply to this target. | The entry is enabled `full`, applicability is `structural`, and the whole relevant scope was examined. |
| `needs_review` | A human must decide. | The default. |
| `not_tested` | The tool could not examine this. | The target was not established, a check failed, or an expected observation is missing. |

Reasons, always present:

- For `needs_review`: `no_check`, `not_enabled`, `judgment_required`, `alternative_unresolved`, `cannot_tell`, `checks_disagree`, `prerequisite_unmet`, `assistive_tech_required`, `model_disabled`.
- For `not_tested`: `target_not_established`, `expect_already_met`, `check_error`, `missing_observation`, `scope_unreadable` (for example a frame the tool could not read).

**Completeness is recorded beside the status, not inside it.** Every finding and every reduced result has a `complete` flag and a list of what did not run. A known fault still gives `failed` when another check timed out, and the result shows it is incomplete.

### 8.3 A test on a target

Deterministic. No model involved (Q7).

**Step 1: the target.** If the target was not established, the finding is `not_tested`. No check ran on it, so nothing else is looked at. A fault seen on the wrong screen never reaches the next steps.

**Step 2: the inputs.** Every check named in the entry's links must have an observation for this target. A missing one counts as an error.

**What two outcomes mean.** These are fixed where a check's result enters the engine.

- `no_fault`: the check examined at least one element the requirement applies to, and found no fault on any. Its evidence says how many it examined.
- `inapplicable`: the check looked through the whole examined scope and found no element the requirement applies to.
- A check never answers `no_fault` on an empty scope.

**Step 3: the facts for each requirement.** Two kinds of claim are authoritative for a requirement: a fault reported through a `failure` link, and anything reported through a resolving link. A fault from any other link is advisory. It is kept as evidence on the finding and changes nothing below.

The engine records these facts for each requirement. They are independent: several can be true at once, and none hides another.

| Fact | True when |
|---|---|
| **error** | A linked check errored or its observation is missing. |
| **dispute** | Two authoritative claims contradict each other. A `failure` link reports a fault while a resolving link reports `no_fault` or `inapplicable`. Or one resolving link reports `no_fault` while another reports `inapplicable`. |
| **violation** | A `failure` link reports a fault, and there is no dispute. |
| **unresolved** | The requirement has no resolving link. Or a resolving link answers `cannot_tell`, or reports a fault through an `evidence_only` link. |
| **satisfied** | At least one resolving link reports `no_fault`, and none of the four facts above is true. |
| **inapplicable** | Every resolving link reports `inapplicable`, and none of the four facts above is true. |

- An advisory fault does not undo **satisfied**: the resolving check examined every route for every element, including the one that fault points to.
- An advisory fault beside a resolving `inapplicable` is not a dispute. An advisory check may look at more elements than the requirement applies to, so its fault does not show that an applicable element exists.

**Step 4: the test.** The first line that applies wins.

1. `failed` if the entry is enabled `fail_only` or `full` and any requirement has a violation.
2. Otherwise `not_tested` if any requirement has an error.
3. Otherwise `needs_review` if any of these holds:
   - the entry is not enabled `full` (`not_enabled`, or `no_check` when it has no link);
   - a prerequisite in `needs` was not met for this target in this run (`prerequisite_unmet`);
   - a requirement has a dispute (`checks_disagree`);
   - a requirement is unresolved (`alternative_unresolved` or `cannot_tell`);
   - applicability is `always` and any requirement is inapplicable (`cannot_tell`): a check answered `inapplicable` for a test that applies to every page (Q40, Q43).
4. Otherwise `not_applicable` if every requirement is inapplicable and applicability is `structural`. With `judgment` applicability it is `needs_review` (`judgment_required`). An `always` entry never reaches this line with an inapplicable requirement.
5. Otherwise `passed`: every requirement is satisfied or inapplicable, and at least one is satisfied.

The finding keeps every fact of every requirement (`requirementFacts`, 8.5), so an error or a dispute that did not decide the status is still visible.

**Prerequisites at run time.** The engine records, for each target, which prerequisites it met. v1 never meets `assistive_tech`. It meets `model` only to produce suggestions, which never change a status. The exact meaning of `state`, `keyboard` and `media` is fixed in M1 with the contract.

**Cases the contract tests must hold.** Each assumes an established target, an entry enabled `full`, prerequisites met, and one requirement unless stated.

| Observations | Finding |
|---|---|
| An advisory fault. No resolving check, or it answers `cannot_tell`. | `needs_review`, reason `alternative_unresolved`, with the fault as evidence. |
| An advisory fault. The resolving check reports `no_fault`. | `passed`, with the advisory fault kept as evidence. |
| The resolving check reports a fault through a `failure` link. | `failed`. |
| A `failure` fault. A resolving check reports `no_fault`. | `needs_review`, reason `checks_disagree`. |
| The same two, plus an errored or missing check on the same requirement. | `not_tested`. The dispute stays recorded. |
| The same dispute, with the error on another requirement. | `not_tested`. |
| One resolving check reports `no_fault`, another reports `inapplicable`. | `needs_review`, reason `checks_disagree`. |
| An undisputed `failure` fault, plus another check's error. | `failed`, marked incomplete. |
| An advisory fault. The resolving check reports `inapplicable`. | `not_applicable` on a structural entry, with the advisory fault kept as evidence. |

### 8.4 Reducing results

The same ordered rule is used at every level. Over a set of results:

1. `failed` if any is failed.
2. Otherwise `not_tested` if any is not tested.
3. Otherwise `needs_review` if any needs review.
4. Otherwise `not_applicable` if all are not applicable.
5. Otherwise `passed`.

An empty set is an error. It never reduces to `passed` or `not_applicable`.

The levels, in order:

1. **Criterion on a target:** over the criterion's tests on that target.
2. **Criterion on a page:** over the page's targets, the `initial` state and every declared state. A page that passes as loaded and fails with its menu open is failed.
3. **Criterion on a page, process-aware:** for a page in a process, over all pages of that process. This is the official rule for process pages. The page's own result is kept beside it.
   - A declared step that is missing or not established counts as one `not_tested` result in that same rule. It does not override a failure found on another step.
   - Example. Step 1 failed and step 2 is missing: the result is `failed`, marked incomplete, with the missing step named. Step 1 passed and step 2 is missing: the result is `not_tested`.
4. **Criterion on the sample:** over the process-aware results of all pages.

The run file stores every level. No rate is computed.

### 8.5 Evidence model

```ts
type Status = "passed" | "failed" | "not_applicable" | "needs_review" | "not_tested";
type Size = { width: number; height: number };

type TargetExecution = {
  targetId: string;                 // "<pageId>/<stateId>"
  requestedUrl: string;             // sanitised (8.7)
  effectiveUrl: string;             // sanitised
  viewport: { requested: Size; applied: Size };
  sessionLoaded: boolean;           // the saved session was loaded into this target's context
  prerequisitesMet: string[];       // which `needs` values the engine met here
  steps: { action: string; ok: boolean; error?: string }[];
  expect: { declared: boolean; metBeforeSteps: boolean | null; met: boolean | null };
  established: boolean;
};

type Observation = {
  id: string;
  checkId: string;                  // "axe/object-alt"
  checkVersion: string;
  options: Record<string, unknown>; // effective options
  targetId: string;
  outcome: "fault" | "no_fault" | "inapplicable" | "cannot_tell" | "error";
  evidence: Evidence[];
  fingerprint: string;              // same fault elsewhere gives the same value
};

type Evidence = {
  id: string;
  kind: "dom_node" | "screenshot" | "computed_value" | "accessibility_node"
      | "text" | "scope_examined" | "tool_output";
  locator?: string;
  snippet?: string;                 // sanitised, length-capped
  file?: string;                    // path inside the run folder
  sha256?: string;
  note?: string;
  redactions?: number;              // how many values were masked
};

type Finding = {
  ruleset: string;
  test: string;
  targetId: string;
  status: Status;
  reason?: string;                  // required unless passed or failed
  complete: boolean;
  notRun: string[];                 // check ids
  requirementFacts: Record<string, string[]>; // per requirement: every fact of 8.3 that is true
  observations: string[];           // observation ids
  suggestion?: ModelSuggestion;     // section 9; never affects status
};

type ModelSuggestion = {
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  proposedStatus: "passed" | "failed" | "not_applicable";
  rationale: string;
  evidenceSent: string[];           // evidence ids that left the machine
};
```

Evidence rules:

- **`failed`** carries evidence that lets a human find the element again: a locator and a snippet, or a screenshot where capture is allowed.
- **`not_applicable`** carries `scope_examined` evidence: what was searched for, in which frames, and that nothing matched.
- **`passed`** carries `scope_examined` evidence: how many elements were examined and a capped list of their locators.
- `fingerprint` lets the report group the same fault repeated across pages. Grouping is display only.

### 8.6 Measured accuracy (Q7)

- A check never reports a confidence number about itself.
- Accuracy is measured on the corpus and published as a **versioned evaluation summary** per link: the count of cases by expected and actual result, abstentions, errors, the corpus hash, and the scope the cases cover (section 10.3).
- The run file refers to the summary by hash. The report shows it as "measured on corpus X, n cases".
- It is not the probability that a given finding on a real page is correct, and it is never shown as a confidence figure for a criterion.

### 8.7 Capture and redaction (Q17, Q33)

One sanitiser runs on everything before it is written to disk or sent to a model. The same sanitised evidence is used for both.

| Channel | Rule |
|---|---|
| Storage-state file | Read only. Never copied, never logged. |
| Cookies, request headers, browser storage | Never recorded. |
| URLs, in the sample copy, target records and errors | Query-string values and fragments are masked unless the sample file marks the parameter as safe. |
| Locators and step values | Stored as written. The sample schema warns that they must not contain secrets. |
| Error messages | Passed through the sanitiser. |
| Text snippets and DOM | Values of form fields are dropped. Token-shaped strings are masked. |
| Screenshots | None in v1, on any target (Q70). `capture.screenshots` and `capture.mask` have no effect; the sample check warns when they are set. Screenshots may be reconsidered after the trial (10.6). |
| Model payloads | Sanitised evidence only. Nothing from a target examined with the saved session unless `model.allowAuthenticated` is `true`. |

- **Protection follows the session, not the address.** A target is treated as authenticated when the saved session was loaded into its context (`sessionLoaded`). That covers a public page examined with the session and every address the target's steps lead to.
- For a target examined without the session, the tool guarantees one thing: no saved session is loaded (7.4). It does not detect a login made by other means. Addresses that carry a credential, one-time login links and login steps are unsupported in v1 (7.1, 15). If they are supported later, their content must be classified before anything is captured or sent.
- Every redaction is counted and recorded on the evidence item.
- The M3 gate tests each channel above with planted values. For model payloads, it tests that nothing is sent and that model use is still refused; what may be sent is tested at M6 (Q66). It includes a public page that shows personal content when logged in, and a state that navigates to an account page, both with the model switches off. It does not claim that no secret can ever reach the run folder: pattern tests cannot prove that.
- The report notes when a target was examined with the saved session.

### 8.8 The run file

One JSON file per run, with a schema version. It contains the three statements, the manifest, the sanitised sample, the sample warnings, a `TargetExecution` per target, all observations, all findings and reduced results, and the list of evidence files.

- **Manifest:** tool version; ruleset id, version and source commit; coverage-map hash; evaluation-summary hash; axe-core, Playwright and browser versions; operating system and locale; effective timeouts and check options; sample-file hash; start and end time; model provider, model id, prompt and schema versions when a model is used.
- **Deterministic from a captured run.** Given one run's observations, deriving findings and rendering every report always gives the same output, with arrays sorted by stable keys. Two separate runs against a live site are not promised to match.

## 9. Model-judged checks (M6)

- The interface is provider-neutral. Claude is wired first (Q11, Q27).
- **Default is no model.** With `model.enabled: false`, no content is sent to any model provider. The browser still contacts the audited site, as any visit does.
- **Opt-in per project** with `model.enabled: true`, a provider and a model id. Content from any target examined with the saved session needs `model.allowAuthenticated: true` as well (Q33, section 8.7).
- **A model only suggests.** Its answer is stored as a `suggestion` on a `needs_review` finding. The status stays `needs_review`. The grid shows the suggestion in its own column, labelled as a model suggestion.
- **Disclosure.** The run file lists every piece of evidence sent, to which provider and model. The report summarises it.
- **Structured output.** Suggestions are validated against a schema. An invalid answer is discarded and logged, never repaired silently.

Whether suggestions could ever change a status is a question for after v1, and would need a new decision.

## 10. Evaluation

The corpus tests bounded correctness. Usefulness is a different question, answered by the trial in 10.6.

### 10.1 Sources (Q18)

1. **W3C ACT rule test cases.** Small pages labelled passed, failed or inapplicable **for an ACT rule**. An ACT label is not an RGAA label. Each reused case gets its own RGAA label, assigned under the rules of 6.5.
2. **W3C "Before and After" demo.** A teaching demo built for WCAG 2.0, with a form that depends on server code. Only its static pages are used. Assets are pinned and every adaptation is recorded.
3. **Planted cases written for this project.** For everything the first two do not cover.

All cases are stored in the repo and served locally. Evaluation makes no network request. Each case records its source, licence, any adaptation, and its expected result.

### 10.2 What a case states

Each case names one test and one **branch**, with the exact expected status:

| Branch | Expected |
|---|---|
| Valid | `passed` on a `full` entry. `needs_review` otherwise. |
| Invalid, fault proves failure | `failed` |
| Invalid by one route, valid by an accepted alternative | `passed` on a `full` entry, with the partial fault kept as evidence. `needs_review` otherwise. |
| Inapplicable | `not_applicable` on a `full` structural entry. `needs_review` otherwise. |
| Outside what the checks support | `needs_review` |

Engine cases cover the rest. Each has an exact expected result too.

- Target cases: a delayed state, an expired session, states declared in reverse order, a failing step, an expectation already true before the steps.
- Session cases: a public page examined with the saved session, a state that navigates to an account page.
- Derivation cases: a missing observation, an unreadable frame, two checks that disagree, a disagreement together with a crashed check, an unmet prerequisite.
- Approval cases: an enabled entry edited without a new approval, a linked check changed since it was measured.
- Reduction cases: a process with one failed step and one missing step.

For several of these the expected result is `not_tested`. Returning it is the case passing.

### 10.3 Measures

For each link and each enabled entry, a full table of expected against actual result over all five statuses, plus crashes and missing observations. From it, four counts. Each is reported with its population, as "x of n".

| Measure | Counts | Over |
|---|---|---|
| **False assurance** | A `passed` or a `not_applicable` that the case did not expect. | Cases that expected another status. |
| **Missed fault** | Anything other than `failed`. | Cases that expected `failed`. |
| **False alarm** | A `failed` that the case did not expect. | Cases that expected another status. |
| **Unexpected error** | A crash, or a `not_tested` or missing observation that the case did not expect. | All cases. |

- A correct `passed` on a valid case is not false assurance: the case expected it.
- An engine case that injects a failure and returns its expected `not_tested` passes. The run file still records the operational error.

### 10.4 The v1 bar

1. **Every case returns exactly its expected status**, for enabled entries and links and for engine cases. A check that answers "needs review" everywhere fails this.
2. **It follows that all four counts of 10.3 are zero on the corpus.** No tolerance excuses a mismatch on a labelled case (Q35). This is reported as "0 of n cases on corpus X", never as a guarantee beyond that corpus.
3. **A mismatch has three honest fixes:** correct the check, demote the entry or the link, or correct the label under the rule in 10.5.
4. **Coverage of branches.** An entry enabled `full` has at least one valid, one invalid and, where applicability is structural, one inapplicable case. An `always` entry has no inapplicable case, because none can exist (Q40). Where a requirement has several routes, it has one valid case per route and one case that is invalid by one route and valid by another. A link with `faultMeans: failure` has its promised faults.
   - **A resolving check also has a mixed pair.** Two elements that are valid by different routes: expected `passed`. One valid element beside one with no valid route: expected `failed` when the link proves failure, `needs_review` otherwise, and never `passed`. A check that only finds some valid element fails the second case.
5. **The minimum useful set** (6.4) is fully enabled and meets points 1 to 4.

### 10.5 Working set and acceptance set (Q34, Q35)

- The corpus is split in two. Builders develop against the **working set**. The **acceptance set** is held back and run only by the orchestrator at gates.
- There is no false-alarm limit on the corpus. The limit on wrong "failed" results belongs to the trial on real pages (10.6).
- The agent that writes a case is never the agent that writes the check it tests.
- Expected results are not edited to make a gate pass. Changing one needs a written reason citing the official text, and Fable's sign-off logged on the bridge.

### 10.6 The trial before final approval (Q29, Q35)

- Fabien audits three PremiumShot pages with the tool: at least one with a declared state. The site version and the tool version are recorded.
- He records:
  - total time;
  - for each criterion left for review, whether the evidence let him decide;
  - the effort of carrying results into the medium where the audit is finished;
  - each "failed" result he judges wrong, with the official text that shows it.
- Pass criteria are written and recorded in `docs/decisions.md` before the trial starts. They include a limit on wrong "failed" results, his own judgment of whether the evidence was usable, and the transfer effort.
- A wrong "failed" found in the trial becomes a corpus case, and the entry or link is demoted until the case passes.
- The completed trial record is kept in the repo.
- **What a passing trial supports.** One statement of this form: "On these three pages, Fabien reported that the evidence supported X of Y review decisions. The workflow took T, including U for transfer."
- **What it does not show.** Time saved, that the work was easier than an audit without the tool, that his judgments were correct, or usefulness for anyone else.

A comparison with a full human audit stays after v1 (Q18). The comparison harness accepts any labelled set, so it can be reused for that.

## 11. Interfaces

### 11.1 CLI (v1, Q14)

```
rgaa-assist check-sample <sample.json>         validate and print sample warnings
rgaa-assist audit <sample.json> --out <dir>    run and write the run folder
rgaa-assist report <run.json> --format html|csv [--lang en|fr]
rgaa-assist coverage [--ruleset rgaa-4.1.2]    print the coverage map summary
```

- Exit codes: `0` run completed, `2` invalid input (including an empty sample), `3` one or more targets could not be established.
- `--fail-on failed` makes `audit` exit `1` when any criterion failed, for CI use. Off by default.
- No command prints a rate or a verdict.

### 11.2 Library (v1)

The CLI is a thin layer over exported functions: `checkSample`, `audit`, `report`, `loadRuleset`. Every returned result includes the three statements of section 2 as data.

### 11.3 MCP server (M6) and skill (M7)

- The MCP server exposes the same four operations as tools and adds no behaviour. Every tool result includes the three statements.
- The skill is written last (Q14). It tells an agent how to prepare a sample, run the tool and present results inside the claim boundary.

## 12. Outputs (Q13, amended Q12)

A run folder contains:

1. **`run.json`**: the run file (section 8.8). The source for everything else.
2. **`grid.csv`**: a grid in the same shape as ARA's CSV export, for typing results into ARA or another grid by hand. It cannot be imported into ARA, and no output calls it ARA-compatible.
   - It opens with rows holding the three statements and the legend.
   - Then one row per criterion, with the columns "Critères", "Éléments transverses" and one per page.
   - Page cells hold the process-aware page result as C, NC, NA or NT. `needs_review` and `not_tested` both become NT, and the legend says the JSON and HTML keep them apart.
   - "Éléments transverses" is always NT. The tool does not assess shared elements separately.
3. **`report.html`**: one self-contained file.
   - The three statements. The sample, its warnings, and what the sample check cannot verify. The listed documents as work for the human.
   - The targets examined and those not established, with the reason.
   - The grid with status, reason and completeness per criterion and page.
   - For each failed or reviewed criterion: the evidence per target, with links to the evidence files.
   - Criterion titles in French as published. Prose in the report language.
4. **`evidence/`**: the files the run file refers to.

The HTML report is audited by the tool itself in CI and must produce no failed finding. That alone proves nothing (section 2), so it is also reviewed once by hand against WCAG 2.2 AA at the M4 gate.

Not in v1: the remediation list (next after v1), a pre-filled audit workbook, the accessibility statement, any verdict.

## 13. Stack and layout

- TypeScript on Node, the current active LTS, pinned. One package, managed with pnpm.
- Playwright and `@axe-core/playwright` for examination. Vitest for unit and contract tests.
- Schemas (sample file, run file, coverage map, corpus case, evaluation summary) are defined once and used for both validation and types.
- The official `criteres.json`, `glossaire.json` and `methodologies.json` are vendored with their source commit and attribution (Licence Ouverte 2.0). Licence terms are checked per reused asset, not assumed for a whole repository.

```
src/
  cli/            interfaces: CLI
  engine/         sample reading, target establishment, run file, sanitiser
  checks/
    axe/          axe adapter
    custom/       deterministic checks
    model/        model-judged checks (M6)
  rulesets/
    rgaa-4.1.2/   official data, coverage map, derivation and reduction policy
  report/         grid, html
  schema/         shared schemas and types
corpus/
  working/        cases builders may see
  acceptance/     cases run only at gates
  results/        evaluation summaries
docs/             spec, decisions, cost log
```

Each directory under `src/` and `corpus/` has one owning agent at a time (section 14.2).

## 14. Build plan

### 14.1 Milestones and gates (Q22, Q23)

Every gate needs: tests green, the corpus bar met where it applies, Codex's independent review, and Fable's diff review. Three gates also need Fabien.

| # | Delivers | Gate specifics | Fabien approves |
|---|---|---|---|
| Spec | This document | Codex reviewed 0.1 and re-checked 0.2 and 0.3. Each round found defects. Its re-check of 0.4 found no blocking defect. Approved by Fabien on 2026-11-15. | **Yes** |
| M1 | The candidate coverage map: 258 entries with requirements, routes, links and rationale. The minimum useful set. All schemas and types, including target execution, processes and `expect`. The ruleset contract with contract tests. | Every entry cites the official text. Nothing is enabled. Codex has cross-checked the entries. The contract tests include the cases of 8.3, the approval case of 6.3 and the mixed process case of 8.4. | **Yes** |
| M2 | Engine on one page in its initial state. Axe adapter. Derivation and reduction for RGAA 4.1.2. A run on one PremiumShot page (Q20), and one on the page of the M1 dry run (Q53). | Run files validate. First working-set numbers reported. The second run compared with the dry run, check by check. | No |
| M5 | Corpus, harness, evaluation summaries. Starts with M2 and stays open. | From M2 on, the v1 bar gates every milestone for the entries enabled so far. | Enabling any `full` entry, or changing one (Q36) |
| M3 | Steps, `expect`, fresh context per target, saved sessions, capture policy, sample check. | The engine cases of 10.2 return their expected results. Each capture channel is tested with planted values, including the two session cases of 8.7. For model payloads, only that nothing is sent (Q66); for screenshots, that no image file is written (Q70). | No |
| M4 | `grid.csv`, `report.html`, evidence folder. | The three statements and the legend are present in every output, proven by test. The report passes its own audit and the manual review. | No |
| M6 | Model interface, no-model default, Claude provider, MCP server. | A model answer cannot change a status, proven by test. Nothing from a target examined with the saved session is sent without the second switch, proven by test. | No |
| M7 | The skill. The trial of 10.6. | Trial pass criteria met. | **Yes** (final v1) |

### 14.2 Roles and models

| Role | Model | Does |
|---|---|---|
| Orchestrator | Fable 5.2, high effort | Splits work, writes agent briefs, reviews every diff, runs gates and the acceptance set, logs decisions. Writes no feature code. |
| Core builder | Opus 5.5, medium to high | Engine, ruleset contract, derivation and reduction, evidence model, sanitiser, custom checks, coverage entries. |
| Module builder | Sonnet 5.5, low to medium | Axe adapter, reporters, CLI wiring, corpus cases from labelled sources. |
| Reviewer | Codex | Independent review of each gate. Cross-checks coverage entries and corpus labels. Edits no files in this repo. |

Rules:

- **One writer per directory at a time.** Each agent works in its own git worktree and is told which directories it owns.
- **Contracts first.** The schemas and the ruleset contract from M1 are frozen before parallel work starts. Changing them goes through the orchestrator.
- **Results are checked, not trusted.** The orchestrator reads diffs and test output. An agent's own report is not evidence.
- **Builders never see `corpus/acceptance/`.**
- M1 and M2 run as a Claude Code session with spawned agents (Q24). Whether to script later milestones is decided after M2.
- **If Fable 5.2 becomes unavailable (Q39),** Opus 5.5 at high effort takes over as orchestrator and continues from the kickoff brief, `docs/m1-status.md`, the cost log and the bridge. Opus keeps writing entries. Codex's cross-check remains the independent check on them.

### 14.3 Cost (Q2, Q4, Q24)

- The build runs on Fabien's Claude subscription. Plan limits are hard: when one is reached, agents stop until it resets.
- **M1:** starts just after a weekly reset. Stops at 40% of the weekly all-models limit, with a check-in at 20% where the orchestrator reports how many of the 258 entries are done. Under half means stop and re-split. Stops if the Fable weekly limit passes 50%. If M1 does not fit, it continues after the next reset.
  - **As run (Q38).** M1 started on 2026-11-16 with the all-models limit already at 45%. The ceiling is counted from that baseline: check-in at 65%, stop at 85%. The Fable stop is unchanged, and no longer applies if Opus orchestrates (Q39).
- **Whether Opus writes entries well enough is measured inside M1 (Q37).** At the 20% check-in, Codex cross-checks the entries written so far, and the orchestrator reports the errors found, by kind of entry. If the figures suggest the entries are not good enough, the orchestrator stops and asks Fabien. Changing who writes entries is his decision (14.4). No separate comparison of models runs before M1.
- M2's ceiling is set from M1's measured use.
- `docs/cost-log.md` gets one line per milestone and role: model, effort, tokens, share of plan used, API-equivalent cost for comparison.
- The orchestration is not a deliverable. No design choice is made to make the build more interesting to orchestrate.

### 14.4 Hard stops (Q25)

The orchestrator stops and asks Fabien when:

1. Something would change a decision in `docs/decisions.md`.
2. There is any ambiguity about the claim boundary.
3. A cost ceiling is reached.
4. The same gate has failed twice.
5. A source differs from what this spec assumed: RGAA text, criteria data, a licence, a tool's behaviour.

Everything else the orchestrator decides, and logs on the bridge.

## 15. Out of scope for v1 (Q28)

- Testing with a screen reader or other assistive technology. Those tests are `needs_review` with reason `assistive_tech_required`.
- Browsers other than Chromium. Real devices. Mobile is a viewport size only.
- Documents (PDF, office files), downloads, and audio or video beyond what the page exposes. Documents are listed for the human, not examined.
- Native mobile apps.
- Crawling. Accessibility statements. Any verdict or rate.
- A graphical interface.
- Source-code analysis (Q9).
- Recording human review decisions. A pre-filled audit workbook. Writing to ARA.
- Assessing which law applies to a site.
- Logging in by any means other than the saved session: addresses that carry a credential, one-time login links, login steps.

## 16. What was checked, and against what

| Claim | Result | Source | Checked by |
|---|---|---|---|
| Sample rules, including documents per service type | Confirmed | accessibilite.numerique.gouv.fr, "Évaluation de la conformité" | Claude, Codex |
| Page, process and sample validation rules | Confirmed | Same page, "Test des pages" | Claude, Codex |
| Self-evaluation is allowed | Confirmed | Same page | Claude, Codex |
| 13 themes, 106 criteria, 258 tests, WCAG 2.1 | Confirmed by count | `DISIC/accessibilite.numerique.gouv.fr`, `RGAA/criteres.json` | Claude, Codex |
| Test 1.1.6 has three accepted conditions; axe `object-alt` looks at one | Confirmed from the two sources. Not reproduced by running axe. | `criteres.json`; axe-core `lib/rules/object-alt.json` | Claude, Codex |
| axe-core 4.14: 67 RGAA-tagged rules, 40 distinct tests | 67 confirmed by Claude and Codex. 40 is Codex's count. | `dequelabs/axe-core` | Codex |
| ARA: CSV export, no audit import, local API documentation | Confirmed from source. Not tested on the hosted service. | `DISIC/Ara` controller, export service, backend README | Claude, Codex |
| The official audit spreadsheet computes rates | Structural inspection of the file's contents. Not opened visually. | Official kit, ODS grid | Codex |
| RGAA 5 timing and announced changes | Announcement of 3 November 2026. Final text not published. | design.numerique.gouv.fr | Claude, Codex |
| Asqatasun "117 of 257 tests" | Published by ADULLACT in a dataset on data.gouv.fr. Not a government benchmark. Not checked against Asqatasun's own list. | data.gouv.fr dataset | Claude, Codex |
| Licences | ARA and the RGAA site: MIT code, Licence Ouverte 2.0 content, with third-party exceptions. axe-core: MPL-2.0. Asqatasun: AGPL-3.0. cegape/audit-rgaa: MIT. ACT: reuse with notices. `DISIC/RGAA-tests`: no licence shown by the GitHub API, reference only. | Each repository | Claude, Codex |

Not checked: Anthropic's benchmark figures for Fable 5.2. They do not affect this spec.

## 17. Open points and weak points

### 17.1 Still open

- **The trial's pass criteria**, including the limit on wrong "failed" results. Written before M7 (Q29, Q35).
- **M2's ceiling.** Set from M1's measured use.
- **The exact meaning of the `state`, `keyboard` and `media` prerequisites.** Fixed in M1 with the contract (8.3).

Closed since 0.1: the ARA question (amended Q12), the "wait for" step (Q31), the M1 ceiling, and the nine drafting choices, all confirmed.
Closed since 0.2: the false-alarm limit on the corpus (Q35: none, every case matches exactly), and what an approval covers (Q36).
Closed since 0.3: the pre-M1 Fable-versus-Opus check is shelved, and its question is answered inside M1 (Q37, section 14.3).

### 17.2 Known weak points

- **No RGAA auditor validates the interpretations (Q30).** Citing the official text limits the risk and Codex's cross-check catches some errors. Neither replaces domain knowledge.
- **False assurance has several sources**, not one: a wrong coverage entry, a link wrongly declared resolving, a target that was not the one requested, a missing observation, an adapter error, or a wrong reduction. Sections 6, 7.3, 8.3 and 8.4 each guard some of them, and the engine cases in 10.2 test the guards.
- **"Resolving" is a claim made by whoever writes the entry.** A check declared to examine every route for every element, when it does not, lets a wrong "passed" through. The guards are the corpus cases per route and the mixed pair (10.4), the rule that a resolving check abstains when it cannot resolve (6.2), and Codex's cross-check. They reduce the risk. They do not remove it.
- **The expectation guard is not a proof (7.3).** A human still has to write an expectation that identifies the state.
- **The tool does not detect a login made outside the saved session (8.7).** Keeping such inputs out of the sample is the user's job.
- **This spec was wrong three times.** Codex found nine defects in 0.1, five in 0.2 and three in 0.3. More may remain, and the M1 contract tests are the next place they would show.
- **Zero false assurance is a statement about a corpus.** It says nothing certain about pages unlike the cases.
- **ACT cases test rules, not RGAA tests.** Each reused case needs its own RGAA label.
- **Most of the grid will say "needs review" in v1.** With no model, expect a clear majority of criteria there. The trial in 10.6 records whether the evidence let Fabien decide those criteria. It cannot show that the work was easier than without the tool.
- **The trial has one reviewer and no comparison.** Its result is his observation on three pages.
- **Finishing the audit is manual.** The human retypes results into ARA or another grid. The trial measures that cost.
- **RGAA 5 support is an objective.** Its final text may require engine changes.

## 18. How Codex's reviews were answered

### 18.1 Re-check of draft 0.3 (answered in 0.4)

| Finding | Answer | Where |
|---|---|---|
| G1. The approval hash left out `needs` | The hash covers every field of the entry except `enabled`, which the approval records. The one-field change is a contract test. Linked check versions are pinned through the evaluation summary. | 6.3, 10.2, 14.1 |
| G2. The requirement table lost errors and some disagreements | Facts are recorded independently for each requirement. The test is derived in order: violation, error, dispute or unresolved, then positive results. `no_fault` and `inapplicable` are defined, and two resolving checks that differ on them are a dispute. Only authoritative claims can dispute. Codex's rows are contract cases. | 8.3, 8.5 |
| What "resolving" must guarantee | A resolving check abstains when it cannot resolve. A mixed pair of cases tests the whole-scope obligation. | 6.2, 10.4, 17.2 |
| The logged-out guarantee was overstated | Narrowed to "no saved session is loaded". Other login mechanisms are unsupported in v1. | 7.1, 8.7, 15, 17.2 |

### 18.2 Re-check of draft 0.2 (answered in 0.3)

| Finding | Answer | Where |
|---|---|---|
| F1. A proven accepted alternative could not produce "passed" | Tests are broken into requirements and routes. Checks combine by "and" only; routes are resolved inside one check. A partial fault no longer overrides a resolving clean result. Disagreeing checks give "needs review". Prerequisites are verified in each run. | 3, 6.1, 6.2, 8.2, 8.3, 10.2 |
| F2. The evaluation definitions conflicted | Each measure has a definition and a population. An expected `not_tested` passes its case. Exact match means zero on all four counts, with no tolerance on the corpus. The limit on wrong "failed" results moves to the trial. | 10.2 to 10.6, 14.1, Q35 |
| F3. Protection depended on a page label, not on the session used | The session is loaded only for pages marked `authenticated`. Others are examined logged out. Protections follow `sessionLoaded`, including later navigation. | 7.1, 7.4, 8.5, 8.7, 9, 14.1 |
| F4. An expectation could already be true before the steps | Expectations must identify the state. The engine evaluates them on the page as loaded and refuses one already met. A target that is not established is `not_tested` before anything else. | 7, 7.3, 7.4, 8.2, 8.3 |
| F5. A missing process step conflicted with the shared rule | A missing step counts as `not_tested` in the same rule and does not override a failure. Worked example added. | 8.4 |
| The trial's claim was too wide | The supported statement is spelled out, with what it does not show. Versions and the trial record are kept. | 10.6, 17.2 |
| Approvals bound to levels, not content | Approval is recorded with a hash of the entry's content. | 6.3, Q36 |
| Stale milestone entry | Corrected. | 14.1 |

### 18.3 Review of draft 0.1 (answered in 0.2)

| Finding | Answer | Where |
|---|---|---|
| R1. A fault is not automatically a failed test | Links state what a fault proves. Unresolved alternatives give "needs review". Conditions listed per test. Glossary and methodology vendored. | 2, 6.1, 6.2, 8.3, 13 |
| R2. The gate could pass a tool that decides nothing | Exact expected result per case and branch. All statuses and errors counted. Minimum useful set. Working and acceptance sets. | 6.4, 10.2 to 10.5 |
| R3. A successful click does not prove the target | Fresh context per target. `expect` required. Requested and reached address recorded. Engine cases. | 7.3, 7.4, 8.5, 10.2 |
| R4. No page or process reduction, no missing-input rule | Four reduction levels with the process rule. Empty sets and missing observations are errors. Completeness beside status. | 7.1, 8.2 to 8.4 |
| R5. The manual handoff needs a contract | Grid defined column by column, with statements and legend. Not called ARA-compatible. Trial measures transfer effort. | 2, 10.6, 12 |
| R6. "No secret reaches the run folder" overreached | One capture and redaction policy per channel, for disk and model. Gate tests named channels. | 8.7, 9, 14.1 |
| R7. Accuracy and provenance were underspecified | Versioned evaluation summary. Ids, target records, evidence for passes and non-applicability. Determinism limited to a captured run. Fuller manifest. | 8.5, 8.6, 8.8 |
| R8. Sample warnings overstated what they check | Services, processes and documents declared. "Cannot check" list in every report. Random rule counts pages. | 4, 7.1, 7.5 |
| R9. Coverage could grow without reapproval | Candidate and enabled levels. Who may enable what. | 6.3, 14.1 |
| Pilot before final v1 | A smaller, single-arm trial by Fabien, with criteria fixed in advance. | 10.6 |
| Fact corrections | Asqatasun source, ARA API wording, Article 47, self-evaluation, RGAA 5 wording, the spreadsheet's formulas. | 4, 16, `docs/decisions.md` |
