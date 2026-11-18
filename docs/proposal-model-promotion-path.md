# Proposal: a promotion path for model judgments

**2026-11-18.** Written by the M1 orchestrator at Fabien's request. **Status: proposal, not a decision.** It changes nothing in the spec, the schemas or the coverage map. It sets out how a model's judgment could one day become a status, one test at a time, and what has to be true first. It asks for decisions at the end.

## The question

Most RGAA tests turn on judgment: is this alt text relevant, does this title describe the page, is this legend meaningful. Axe and the other legacy tools can only check that the attribute exists. A model can read the text and say what it thinks. That is the real strength an AI brings, and Q3b (an autonomous verdict, "if the product path happens") should stay reachable.

Today a model may only suggest (Q7, spec 9). Its answer is stored on a `needs_review` finding and never changes the status. Spec 9 closes with: "Whether suggestions could ever change a status is a question for after v1, and would need a new decision." This proposal prepares that decision, so it can be taken on numbers and not on opinion.

## What we know about AI judgment from this project

Opus wrote the 258 entries and Codex, a second model, cross-checked them. Among the 34 claims above `none`, 7 had confirmed defects and 11 rested on readings nobody had settled; 14 claims were lowered. Model judgment was useful, and it was reliable only after an independent review. The same holds for a model judging a page: its answers sound the same when they are right and when they are wrong. That is why the path below rests on measurement and an independent label, not on the model's own confidence.

## Principles

1. **A model's status never mixes silently with a deterministic one.** A promoted result carries its provenance (provider, model id, prompt version, the corpus it was measured on) wherever it is shown.
2. **Promotion is per test family, never global.** Each family earns it on its own numbers, and Fabien approves each one, as for a `full` entry (Q36).
3. **The labels are human.** A model never labels the corpus that measures a model, and the agent that writes a case never writes the check it tests (spec 10.5).
4. **Abstention is a result.** When the model is unsure or inconsistent, the finding stays `needs_review`.
5. **The claim boundary does not move.** No rate, no score, no statement of conformance. A promoted `passed` still means "this test, this target, these prerequisites" (spec 2, point 4).

## Where a model could start

I read the 258 official wordings for tests that turn on relevance or sense (34 contain such a word; the list is a first filter, not a classification). I sorted the candidates by what the model would need to see.

**Tier 1: the input is a short text and the page around it.** Best first candidates.

| Test | What the model judges | Where it stands today |
|---|---|---|
| 8.6.1 | Is the page title relevant | `none`. 8.5.1 only checks that a title exists. |
| 11.7.1 | Is the legend of a field group relevant | `none` |
| 2.2.1 | Is a frame's `title` relevant | `fail_only`, resting on the empty case only |
| 9.1.2 | Is a heading's content relevant | `fail_only`, empty case only |
| 11.8.3 | Is an `optgroup` label relevant | `fail_only`, empty case only |

For the last three, the deterministic claim covers the empty case. The other half, a text that is present but meaningless, is exactly what a model could add.

**Tier 2: the model must also see an image, or first decide whether the image carries information.** Test 1.3.1 and its six siblings, 1.3.2 to 1.3.7 (alternative text of an informative image, by element type), and the CAPTCHA and test-image family 1.4.1 to 1.4.7. "Carries information" is itself a judgment, so errors compound. Worth trying after tier 1, with images sent as evidence.

**Tier 3: not suited, whatever the model.** Anything with `assistive_tech`, `keyboard` or `media` in its `needs` (for example 4.4.1, 5.2.1, 12.8.1), and the tests whose official reading is still disputed (10.5.3, 11.9.2, 11.2.5). A model would pick a reading and sound sure of it.

## The path

**Stage 0: suggestion only (v1, already planned).** M6 wires the model interface. A suggestion records provider, model, `promptVersion`, `schemaVersion`, a proposed status, a rationale and the evidence sent (`ModelSuggestionSchema`). It appears beside the hints of the developer view, labelled as a suggestion. Nothing changes.

**Stage 1: measure, on cases with human labels.** For one family at a time, run the model over the corpus and report the four measures of spec 10.3 (false assurance, missed fault, false alarm, unexpected error), each as "x of n". Two rules differ from the deterministic checks:
- Run each case several times, and treat any disagreement between runs as an abstention (`needs_review`). Record the model id, the prompt version and the settings, and cache the answer by (evidence, model, prompt version) so a run can be replayed.
- A mismatch on a model case is not a defect to patch away. It is a data point, counted.

**Stage 2: decide, per family.** Fabien reviews the numbers and the cases the model got wrong, and decides whether the family may be promoted, and in which direction (below). The pass criteria are written before the measurement, as for the trial (spec 10.6, Q29).

**Stage 3: promote with provenance.** A promoted family can produce a status labelled as model-judged. This needs a new decision and a spec amendment: spec 8.2 and 8.3 have no model path, and the derivation contract is frozen, so the change goes through the orchestrator, with new contract tests.

### Which direction first

The two errors are not equal. A wrong `passed` is false assurance; a wrong `failed` is a false alarm. I suggest promoting **`failed` first**: "this title is `Untitled`" or "this alt text is a file name" are errors a model finds reliably, and a false alarm costs a person a minute of review. A model-judged `passed` stays a suggestion until a family has a very large corpus with no false assurance. Fabien may decide otherwise.

## What the corpus needs

- **Labels from a person.** The labels on relevance are themselves judgments, and the spec's weakest point is that no RGAA auditor validates our readings (Q30, spec 17.2). Each case should be labelled by an auditor, or by two people independently, with disagreements marked **contested**. Contested cases are kept, and the right answer for them is an abstention.
- **Sources.** Published ARA audits give real pages with an auditor's result and comments. The Aubay dry run showed the limit: they are rated by criterion, not by test, and an auditor's decision can differ from ours on the same fault. They are a first signal, not a label set. Planted cases (spec 10.1, source 3) cover the rest, and need to include the texts a model finds hard: short, ambiguous, in French, brand names, a title that is accurate and useless.
- **Held-back set.** The acceptance set stays unseen by the builders and the prompts (spec 10.5).
- **How big.** With no error in n cases, the error rate is only bounded, by roughly 3 divided by n at 95% confidence. To say "false assurance below 2%" needs about 150 cases with none; below 1%, about 300. Per family, not per test. That is the real price of a promotion.

## Cost and privacy

- **Cost.** Labelling is human time. Running 300 cases several times each costs model calls, to be set in the M6 budget. The checks themselves are one prompt per family, not one per test.
- **Privacy.** Unchanged. The model receives sanitised evidence only, nothing is sent by default, and nothing from a page examined with the saved session without the second switch (spec 8.7, 9). The corpus runs on local pages, and a model measured on the corpus sends only corpus content.

## Order of work

| When | What |
|---|---|
| M2 | Nothing. One line in the brief: keep the text and context of titles, legends and labels in `evidence`, so a model has something to read later. |
| M5 | Start collecting human-labelled cases for tier 1, beside the deterministic ones. |
| M6 | Stage 0 for tier 1. Stage 1 measurement on the first family (8.6.1 is the natural one). |
| After the M6 gate | Stage 2 for that family. Only then, if Fabien decides, a spec amendment and Stage 3. |

## What this does not do

- It does not give a model a verdict in v1.
- It does not promise that any family will pass. If the numbers are poor, the answer is that it stays a suggestion, and the measure is the finding.
- It does not show that a model beats a trained auditor. It would show how often a model agrees with the human labels on these cases.

## Decisions asked of Fabien

1. **Adopt the principle**: promotion per family, on measured numbers, with provenance and human labels.
2. **Confirm tier 1 as the first candidates**, and 8.6.1 as the first family. Codex should review the sorting, since it comes from a keyword filter.
3. **Direction**: `failed` first, with `passed` staying a suggestion, or another order.
4. **The pass criteria**, to be written before any measurement: the false-assurance and false-alarm limits and the minimum corpus size.
5. **Who labels**: whether Fabien finds a trained auditor, or two independent labellers, for the judgment cases.
6. **The M2 line** about keeping the text and context in `evidence`.

If adopted, the orchestrator amends spec 9 and the M5 plan, logs the decision on the bridge, and sends the candidate list to Codex before M5.
