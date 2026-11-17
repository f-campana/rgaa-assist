# Guide: writing coverage entries

For the agents who write the coverage map of RGAA 4.1.2. Written by the orchestrator on 2026-11-16.

## What an entry is, and what is at stake

rgaa-assist examines web pages and says, test by test, `passed`, `failed`, `not_applicable`, or "a human must decide". The coverage entry of a test is the tool's whole argument for what it may say about that test. You write that argument.

Two errors are possible, and they are not equal.

- **Claiming too much** lets the tool tell an auditor that something is fine, or broken, when it is not. This is the failure the project exists to avoid.
- **Claiming too little** leaves a test for the human. That costs a little time and nothing else.

So when you are unsure, claim less and say why. Most tests will end at `none`, and that is the expected result, not a weak one. An entry that says `none` with a precise reason is as valuable as one that says `full`.

No trained RGAA auditor reviews your interpretations. The official text is the only authority. That is why every claim is tied to a quote.

## What you work from

- **The criterion packet:** `work/packets/by-criterion/<criterion>.md`, made by `pnpm packets`. It holds the criterion's title, particular cases and technical note, each test's wording and methodology, the axe-core rules tagged for it, and the glossary entries it links to. Everything official in it is exact. Work from the packet, not from memory of RGAA.
- **The schema:** `src/schema/coverage.ts`. Read it once. Its comments define every field and rule.
- **A reference entry:** `tests/fixtures/entry-1.1.6.json`. It shows the shape and the citation style. The spec fixes its content: three routes, an axe link that is `evidence_only`, candidate `none`. An entry for 1.1.6 that contradicts it is wrong.
- **The check registry:** `src/rulesets/rgaa-4.1.2/checks.json`.
- **What the prerequisites mean:** `PREREQUISITE_MEANING` in `src/rulesets/contract.ts`.

One file per test: `src/rulesets/rgaa-4.1.2/coverage/<theme, two digits>/<test id>.json`.

## The method, for each test

### 1. Read everything first

The test's lines, its methodology, the criterion's particular cases and technical note, and each glossary entry the wording links to. The glossary often narrows or widens a term more than the wording suggests.

### 2. Requirements and routes

- A **requirement** is one thing the test demands. All requirements of a test must hold.
- A **route** is one accepted way to meet a requirement. Any one route is enough.
- Read the wording for which is which. "Une de ces conditions" lists routes of one requirement. "Ces conditions", or conditions that must all be true, are separate requirements. The methodology usually settles a doubt: follow its steps and see which ones end in "le test est validé".
- **List every route.** A missed route is the most serious error an entry can contain: a page that uses it would be reported as failing. Look for routes in the glossary too. A term such as an alternative, a label or a title often has several accepted forms there, and each is a route.
- An **exception** is a case where the requirement need not be met: a particular case of the criterion, or a limit stated in the wording or the glossary. List them all, on the requirement they apply to.
- Give each requirement, route and exception a short id in kebab-case, unique in the entry, a one-sentence statement in English, and at least one citation.

### 3. Links: what each check's result means

A link says what one check's outcome means for one requirement. Start from the axe rules in the packet, then consider whether a purpose-built check could do better.

**For an axe rule.** The tag only says the rule is relevant. Compare what the rule examines with what the wording demands, in both directions:

- Does the rule accept something the test rejects? Then its clean result proves nothing.
- Does the rule reject something the test accepts by another route or an exception? Then its fault proves nothing.
- Does it look at every element the requirement applies to, or only some?

Then set the three fields honestly:

- `routes`: only the routes and exceptions the rule really examines.
- `scope`: `whole` only when it examines every element the requirement applies to.
- `faultMeans`: `failure` only when `routes` lists every route and exception, so that a fault violates the requirement whichever route the page chose. Otherwise `evidence_only`. The schema enforces the first half. The second half, that the rule's fault truly means the requirement is violated, is yours to argue.

If you do not know exactly what an axe rule examines, say so in the rationale and give it the weakest reading: fewest routes, `partial`, `evidence_only`. Do not guess upward. A rule marked best-practice or experimental is linked only if the rationale says why.

**For a custom check.** If a deterministic check could examine the requirement better than axe does, register it and link it.

- Add a record to `checks.json`: id `custom/<criterion with a hyphen>-<slug>`, for example `custom/1-1-object-alternatives`, kind `custom`, `exists: false`, and `examines`: what the check must look at, element by element, route by route, and when it must answer "cannot tell". Someone will build the check from that text alone, so write it as a specification.
- Keep the `checks` array sorted by id. Register an axe rule the same way, with id `axe/<rule id>`, if it is not there yet.
- Only register a check that plain code can perform on a rendered page: the DOM, computed styles, the accessibility tree, geometry. A check that would need to understand meaning (is this alternative relevant, is this title accurate, is this image decorative) is not a custom check. That is human judgment, and the entry stays lower.
- A link is **resolving** when it covers every route and exception with scope `whole`. That is a strong claim: the check will be trusted to say the requirement holds. Make it only when the check's specification really covers every route for every applicable element, including finding those elements without judgment.

### 4. Candidate level

- **`none`**, the default: the tool concludes nothing.
- **`fail_only`**: at least one link has `faultMeans: failure`, and you have argued that its fault proves the test fails. The tool may say "failed" and never "passed".
- **`full`**: every requirement has a resolving link. The check behind it may abstain: where a case needs judgment, it answers "cannot tell" and the tool says "needs review" for that page. `full` is right when the check decides the mechanical cases and abstains on exactly the others, and when code can tell the two apart. Every route, every exception and every applicable element must be accounted for: decided, or abstained on by a stated rule. Something the check never looks at is not an abstention. It is a hole, and it rules out `full`.

  `full` also needs **every accepted route to be able to pass.** An entry enabled `full` must have a valid corpus case for each route that comes out "passed" (spec 10.4 point 4). A check that never answers "no fault" through a whole route cannot meet that, however carefully it abstains: abstaining on some pages of a route is allowed, abstaining on all of them is not. Such an entry is below `full`.

Words that signal judgment, and usually keep a test below `full`: "pertinent", "correctement", "si nécessaire", "suffisamment", "cohérent", "compréhensible", and any qualifier on the elements concerned, such as "porteuse d'information" or "de décoration". Ask of each: could code decide this for every page? If not, it is judgment.

A mechanical fault inside a judgment test can still justify `fail_only`.

**Judge each test on its own.** A defect does not belong to one test only. An empty frame `title` may fail one test, another, or both: apply each test's own wording to it, its applicability, its routes, its exceptions. Abstain when this test's text leaves the case open, never because another test might also cover it.

`enabled` is always `none`. Nothing is enabled in this milestone.

### 5. Applicability and needs

- `applicability` is `structural` only when "not applicable" follows from the absence of elements that code can identify with certainty. It is `always` when the test applies to every page, whatever the page holds, so that "not applicable" can never be the answer. If deciding whether the test applies needs judgment, it is `judgment`. When unsure, `judgment`.
- `needs` lists what examining the test requires beyond the page as loaded: `state` (content that appears only after interaction), `keyboard`, `media` (the media must play), `assistive_tech`, `model`. Read their exact meaning in `PREREQUISITE_MEANING`. A test whose methodology asks for a screen reader or another assistive technology needs `assistive_tech`.

### 6. Rationale

`rationale.text` is the argument, in plain English and short sentences: why this candidate level, why each link has its `routes`, `scope` and `faultMeans`, why this applicability, why these needs. Someone who has not read RGAA must be able to follow it and check it against the quotes. Say what you were unsure about.

## Lessons from the pilot

Fourteen entries were written first and cross-checked by an independent reviewer. It found two over-claims (a `full` entry and a `failure` link), one abstention for a wrong reason and one gap in the contract. It did not certify the other entries. Both over-claims were entries the writer had itself listed as its least sure. The rules below come from that review and its re-check.

- **A claim you doubt is not a claim.** If you would put an entry's `failure` link or resolving link on your "least sure" list, lower it before you finish, and say what would be needed to raise it. Report the doubt as well. The remedy depends on which claim you doubt:
  - **A negative claim** (a fault proves failure): make the check abstain on the doubtful cases, or make the link `evidence_only`.
  - **A positive claim** ("no fault" proves the requirement holds): make the check abstain on the doubtful cases, or lower the candidate below `full`. **`evidence_only` does not do this.** A link is resolving because of its `routes` and `scope`, whatever its `faultMeans`, so its "no fault" still counts. Change `routes` or `scope` only when the new value truthfully describes what the check examines.
- **A fault must rest on a witness that is surely in scope.** A check that faults the page because of one element must be sure that element is one the test's wording covers, under any reading. Where it could be decorative, hidden from assistive technologies, invisible but laid out (`opacity: 0`, clipped, off-screen), or a pictogram drawn from letters (an icon-font ligature), the check abstains on it.
- **A list of things to examine must be complete, or abstain.** A check that says "no fault" after examining "every text item" is only as good as its definition of a text item. If the official wording says "each" or "every", the check's list must cover everything a reader of that wording would include, and answer "cannot tell" as soon as the page holds something outside the list that could matter: a field's value, text generated by CSS, content in a frame. The broken `full` entry passed a page because its list of texts left out a visible field value.
- **A new technique must prove what it compares.** A check that infers something from two states, such as two screenshots, must establish that the two states really differ in the way it assumes. The broken `failure` link compared a screenshot with focus to one after `blur()`, without checking that focus had actually left. A page that takes focus back gave two identical pictures and a false fault. If you cannot state and verify every assumption of the technique, its fault is `evidence_only`.
- **An axe rule that examines none of the routes gets no link.** Do not invent a route to keep it. Name the rule in the rationale and say in one sentence what it examines instead.
- **Hidden elements.** "Not rendered" and "hidden from assistive technologies" are two different facts, and neither is a general exemption. Apply an exception only where the official text of this test gives one, as the frame-title glossary does for technical frames with `aria-hidden`. Elsewhere, make the check abstain on hidden elements and say so.
- **`scope: whole`** describes which elements the check is meant to cover, not a promise to decide each one. A check that looks at every applicable element and abstains on some is `whole`. A check that never looks at a class of them is `partial`.
- **One glossary title contains no-break spaces:** "Version alternative « audio seulement »". A `glossary` citation names its entry by exact title, so copy the title from `glossaire.json` if a citation of it fails.

## Citations

- Every requirement, route, exception and rationale cites the official text. Six sources: `test` (optionally one line), `particular_cases`, `technical_note`, `criterion_title`, `glossary` (by exact title), `methodology`.
- A quote is copied from the packet, exactly. A script checks it: after collapsing whitespace, it must be a substring of the source. Typographic apostrophes (’), accents and case must match. A Markdown link may be reduced to its label, and glossary HTML to its text.
- Quote the clause that carries the point, not the whole paragraph. One clause that proves the claim is better than three lines that contain it somewhere.
- **Cite or abstain.** If you cannot find official words for an interpretation, do not make it. Leave the entry at `none` and say in the rationale what could not be derived.

## Before you finish

- Run `pnpm validate-coverage <your folder>`. It must report no invalid file.
- Reread each `failure` link and each resolving link once more and try to break it: think of a page that is correct under the official text but that this entry would call failed, and a page that is wrong but that it would call passed. If you find one, lower the claim.

## What to report

For each test, one line: the candidate level, and the hardest call you made. Then a list of the entries you are least sure of, with the reason. Doubts you report are useful: they tell the reviewer where to look.

## What you must not do

- Set `enabled` to anything but `none`.
- Change the schema, the loader, the official data or the packets. If the schema cannot express what the text says, stop and report it.
- Write that a page or a site conforms, or compute any rate. The tool never does, and neither do its documents.
