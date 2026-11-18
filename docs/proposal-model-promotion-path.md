# Proposal: measuring model judgments, and what a promotion would need

**2026-11-18, revised the same day after Codex's review.** Written by the M1 orchestrator at Fabien's request. **Status: proposal, not a decision.** It changes nothing in the spec, the schemas or the coverage map. It asks for decisions at the end.

**What Codex's review changed.** The first draft recommended promoting model-judged `failed` results first, called its tiers a taxonomy, treated a contested label as a reason to abstain, and put the decision right after M6. Codex's objections were accepted:
- A model-judged `failed` is not proven under spec 2 point 5, and a provenance label is not proof. The proposal no longer recommends a direction.
- The tiers are hypotheses with prerequisites.
- A contested label is not a ground truth. It is reported as disagreement.
- Any promotion is **after v1**, as spec 9 says.
- The statistics now state their assumptions.

## The question

Most RGAA tests turn on judgment: is this alt text relevant, does this title describe the page. Axe and other legacy tools can only check that the attribute exists. A model can read the text and say what it thinks. That is a real strength, and Q3b (an autonomous verdict, "if the product path happens") should stay reachable.

Today a model may only suggest (Q7, spec 9). Its answer is stored on a `needs_review` finding and never changes the status. Spec 9 closes with: "Whether suggestions could ever change a status is a question for after v1, and would need a new decision."

This proposal does two things. It proposes **measuring** model judgments, which is useful even if nothing is ever promoted. And it lists **what a promotion decision would have to answer**, without recommending one.

## What we know about AI judgment from this project

Opus wrote the 258 entries and Codex, a second model, cross-checked them. Among the 34 claims above `none`, 7 had confirmed defects and 11 rested on readings nobody had settled; 14 claims were lowered. Model judgment was useful, and it was reliable only after an independent review. A model's answers sound the same when they are right and when they are wrong, so the path rests on measurement against independent labels, not on the model's own confidence.

## Principles

1. **A suggestion stays a suggestion in v1.** It carries provider, model, prompt version and the evidence sent (`ModelSuggestionSchema`). Opt-in per project, as spec 9 says.
2. **A model's result never mixes silently with a deterministic one,** in any output, now or after a promotion.
3. **Labels are independent and human.** A model never labels the corpus that measures a model, and the agent that writes a case never writes the check it tests (spec 10.5).
4. **Measurement is per test family,** and for each family, per test, route and target where the wording differs.
5. **The claim boundary does not move without a decision.** No rate, no score, no statement of conformance (spec 2).

## Where a model could start: hypotheses, not tiers

I read the 258 official wordings for tests that turn on relevance or sense (34 contain such a word; a keyword filter plus my reading). The grouping below is a set of **hypotheses to test**. Each family needs its prerequisites stated, and **must abstain when the context it needs is missing**. None of it is a permanent taxonomy, and no class is impossible for every model.

| Family | What the model judges | What it needs besides the text | Today |
|---|---|---|---|
| 8.6.1 | Is the page title relevant | The page's purpose, possibly across states and frames | `none` |
| 11.7.1 | Is a group legend relevant | The fields it groups | `none` |
| 6.1.1 to 6.1.4 | Is a link's purpose clear (exploratory) | Destination and context | not examined here |
| 2.2.1 | Is a frame's `title` relevant | The frame's actual content, which may be another document | `fail_only`, empty case only |
| 9.1.2 | Is a heading's content relevant | The section it heads | `fail_only`, empty case only |
| 11.8.3 | Is an `optgroup` label relevant | The options it groups | `fail_only`, empty case only |
| 1.3.1 to 1.3.7, 1.4.1 to 1.4.7 | Is an alternative text relevant (images, CAPTCHA, test images) | The image, and whether it carries information, which is itself a judgment | `none` |

- For 2.2.1, 9.1.2 and 11.8.3 the deterministic claim covers the empty case. A model would address the other half, a text that is present but meaningless, only if it can see the context.
- 6.1.1 to 6.1.4 were not in my first draft. Codex asked that they be considered. They are exploratory because they need destination and context.
- **Not suited to the evidence v1 can collect:** tests that need `assistive_tech`, `keyboard` or `media` (for example 4.4.1, 5.2.1, 12.8.1), and tests whose official reading is still disputed (10.5.3, 11.9.2, 11.2.5), where a reading must be decided first. This says nothing about what a model could do with other evidence. Multimedia and CAPTCHA tests may need sensory or semantic context that is outside v1.

## The path

**Stage 0: suggestion only (v1, already planned).** M6 wires the model interface. A suggestion appears beside the hints of the developer view, labelled as a suggestion. Nothing changes.

**Stage 1: measure, on cases with independent human labels.** For one family at a time, report the measures of spec 10.3, each as "x of n", with **separate denominators**:
- a false pass or false `not_applicable` among cases that are actually non-compliant or applicable;
- a false failure among valid cases;
- abstentions;
- scope the tool could not access.

Rules that differ from the deterministic checks:
- Record the model id, prompt version and settings. Cache answers by (evidence, model, prompt version) so a run can be replayed. Report drift when the model or prompt changes.
- Retries and disagreement between runs are recorded. Treating a disagreement as an abstention is a conservative filter, not a validation, because independent runs can repeat the same error.
- A mismatch is a data point, counted, not a defect to patch away.
- The output is the measured agreement of the suggestions with the labels. It can be shown beside a suggestion (Q7: confidence is measured accuracy on the corpus). That is useful without any promotion.

**Stage 2 and after: a promotion decision, after v1.** Not recommended now. Spec 9 puts it after v1, and it needs a new explicit decision and a complete policy. Stage 1 would only supply the numbers that decision needs.

## What a promotion decision would have to answer

No answer is proposed here. This is the list the decision must settle first.

1. **Spec 2.** A `failed` requires a fault proven under every route and exception (point 5). A model's judgment is not such a proof, and a label or provenance does not make it one. Either the spec is amended to allow a distinct, labelled kind of result, or no model result becomes `failed`. The same question applies to `passed` and `not_applicable` (points 4 and 8).
2. **Which status first.** The first draft preferred `failed`. Codex objected, because a wrong model-judged `failed` could be read as an actionable non-conformance claim. The direction is open, and it may be neither.
3. **Precedence.** What happens when a deterministic result and a model result conflict, per test, family, route and target. A deterministic failure must not suppress a model conflict, nor the reverse, without a stated rule.
4. **Authority.** Where a human or domain reviewer is still required, and how the report shows it.
5. **Derivation and the contract.** Spec 8.2 and 8.3 have no model path and the contract is frozen, so a change goes through the orchestrator, with new contract tests and a re-check by Codex.
6. **Reporting.** How a model-derived result is labelled in the grid, the CSV and the report, so it is never mistaken for a deterministic one.
7. **Privacy.** See below.

## What the corpus needs

- **Independent labels.** The labels on relevance are themselves judgments, and no RGAA auditor validates our readings (Q30, spec 17.2). Use a trained auditor, or two independent labellers with an adjudication step. Report their disagreement and uncertainty. **A contested label is not a known ground truth.** It is not scored as "the model should abstain"; it is reported separately.
- **Sources.** Published ARA audits give real pages with an auditor's result. The Aubay dry run showed the limit: results are by criterion, not by test, and an auditor's call can differ from ours on the same fault. They are a first signal, not a label set. Planted cases (spec 10.1, source 3) cover the rest and must include hard texts: short, ambiguous, in French, brand names, a title that is accurate and useless.
- **Design of the set.** Split by site or template, never by duplicate pages. Keep a genuinely held-out set that builders and prompts never see (spec 10.5). **Freeze the thresholds and the protocol before any evaluation.**
- **Coverage.** Set a minimum usable coverage, since a model that abstains on everything has no errors and no value. Evaluate retries and abstention too.

### What the sample-size arithmetic does and does not say

With zero errors in n independent trials, the exact one-sided 95% upper bound on the error rate is 1 − 0.05^(1/n), about 3/n. So n = 149 or 150 gives a bound under 2%, and n = 299 or 300 under 1%. This holds only for **independent, identically distributed, representative trials with a fixed, preselected model and protocol**. It does not give a universal rate:
- on curated planted cases, which are not a sample of any population;
- on repeated calls on the same page, or on correlated cases;
- for recall, usefulness, real-world calibration or robustness to shift.

So most figures from the planted corpus are statements about that corpus (spec 10.4: "x of n cases on corpus X"), not a promise about real pages. A bound near 3/n also needs a stated population before it means anything.

## Cost and privacy

- **Cost.** Labelling is human time. Running several hundred cases more than once costs model calls, to be set in the M6 budget.
- **Privacy.** Nothing is sent by default. Spec 8.7 sends sanitised evidence only, and nothing from a page examined with the saved session without the second switch. **That does not make sanitised content safe to send.** Privacy classification, user consent, logging and remote data handling are separate design questions, and a judgment may need the full original context, which the sanitiser removes. The M6 gate should test this with planted values, as the M3 gate does, and not assume it. The corpus runs on local pages, so a model measured on it sends only corpus content.

## Order of work

| When | What |
|---|---|
| M2 | Nothing for the model. Where a deterministic check already records the text and context of titles, legends and labels, keep them in `evidence`, as far as 8.7 allows. |
| M5 | Collect independently labelled cases for the first families, beside the deterministic ones. Fix the protocol and the thresholds before any run. |
| M6 | Stage 0 for the first families. Stage 1 measurement on one family; 8.6.1 is the natural one. |
| After v1 | If Fabien decides, a promotion policy that answers the seven questions above. Not before. |

## What this does not do

- It does not give a model a verdict in v1, and it does not recommend one afterwards.
- It does not promise that any family will pass. If the numbers are poor, it stays a suggestion, and the measure is the finding.
- It does not show that a model beats a trained auditor. It shows how often a model agrees with independent labels on a stated corpus.

## Decisions asked of Fabien

1. **Adopt the measurement path** (stages 0 and 1), with independent labels and frozen thresholds. Promotion is not part of it.
2. **Confirm the hypothesis families as first candidates**, with 8.6.1 first, understanding they are hypotheses. Codex has reviewed the sorting once; it should review again before M5.
3. **Who labels:** a trained auditor, or two independent labellers with adjudication.
4. **The measurement protocol and thresholds,** written before any evaluation: the denominators, the minimum coverage, and the population the numbers describe.
5. **Leave the promotion decision to after v1,** and require the seven questions to be answered before it is taken.
6. **The M2 line,** as worded in the order of work.

If adopted, the orchestrator amends the M5 plan, logs the decision on the bridge, and sends the family list and the protocol to Codex before M5.
