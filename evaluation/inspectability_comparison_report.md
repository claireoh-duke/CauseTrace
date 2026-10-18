# Evidence inspectability capability comparison

Scope: five saved V2 baseline answers and five original CauseTrace responses, using final_judge_dataset.json for selection and original saved records for independent consistency checks. No answers regenerated, system changed, LLM judge run or prior scores overwritten. This is a deterministic capability audit, not new human answer-quality ratings.

## Identical scoring rules

| Score/status | Rule applied to both systems |
|---|---|
| 0 — capability absent | The tested workflow supplies no relevant inspectability capability or target. Absence is supported by saved protocol/response, not inferred from a missing test alone. |
| 1 — capability present but incorrect or incomplete | Relevant capability exists, but inspected mappings/metadata/disclosures fail or cover only part of the criterion. Record the defect; never count this as absence. |
| 2 — capability present and verified | The defined criterion is fully verified within its explicitly stated test scope. |
| N/A — not assessable, missing test evidence | Relevant functionality may exist, but evidence necessary for that criterion is absent; do not assign 0 or 2. |

No 1 states were observed in the defined saved-artifact checks. This does not establish an absence of defects outside those checks.

## Criterion definitions and verification boundaries

- **Citation Traceability:** 0 when no research-record citations/mappings are provided; 1 when mappings exist but are unresolved, wrong, or incomplete; 2 when every cited entry resolves through a named directed edge to identifiable saved paper metadata. No frontend-click claim is made by this criterion.
- **Evidence Accessibility:** 0 when the workflow provides no evidence target/access capability; 1 when a tested access interaction fails or returns incomplete/wrong evidence; 2 only when an actual citation activation and correct record display are verified. N/A when an existing access route lacks the required interaction test. This concerns access to dataset records, not obtaining full original papers or accessibility compliance.
- **Evidence Transparency:** 0 when no supporting source/method metadata is offered; 1 when offered fields are mislabeled, inconsistent or incompletely disclosed; 2 when sources, methods, evidence-class flags and missing values are inspectable in saved records. This is an artifact-level metadata test, not proof those fields render correctly in the frontend or accurately describe a paper.
- **Retrieval Transparency:** 0 when no retrieval inspection capability is part of the tested workflow; 1 when retrieval disclosures are wrong/incomplete; 2 when saved limits, stop/truncation reason, actual selected paths, record counts and pack disclosure reconcile. An evaluator stating “no retrieval” does not add a retrieval capability to baseline. No retrieval-quality or causal-path-validity score is implied.

Each rule has the same scope for both systems. N/A applies to untested functionality, not to a capability demonstrably absent in the baseline protocol. A verified artifact can score 2 on a record-level criterion while its UI access remains N/A. The chart and CSV explicitly expose this distinction.

## Results

| System | Citation Traceability | Evidence Accessibility | Evidence Transparency | Retrieval Transparency |
|---|---|---|---|---|
| Baseline | 0 (n=5) | 0 (n=5) | 0 (n=5) | 0 (n=5) |
| CauseTrace | 2 (n=5) | N/A (n=0; five untested cases) | 2 (n=5) | 2 (n=5) |

Each of Q1–Q5 has the same criterion results shown above; inspectability_comparison.csv has 40 rows with case-specific checks, evidence paths, capability state and rationale. Baseline 0 scores mean the tested workflow offers no identifiable record tracing, evidence access, source/method record transparency or retrieval-inspection capability. They do not mean hallucination or economic inaccuracy.

For CauseTrace, saved graph edges, node IDs/names, raw generated citations, exact model packs and full evidence records were cross-checked. Sources/method fields exist with missing entries explicitly null. Actual candidate paths and evidence-pack disclosures reconcile. These are verified saved-artifact capabilities only.

## Citation membership — separate backend metric

| Case | Valid entries / attempted entries | Candidate paths | Retrieval truncated |
|---|---|---|
| Q1 | 7/7 | 50 | True |
| Q2 | 8/8 | 18 | False |
| Q3 | 12/12 | 50 | True |
| Q4 | 6/6 | 50 | True |
| Q5 | 9/9 | 50 | True |

**42/42 citation entries (100%) belong to the named supplied edge**; this independently reproduces the existing membership result. The denominator is raw structured evidence_ids entries, not papers, human-facing links, or semantic support judgments. Baseline has no citation attempts, so membership rate is N/A, not 0% or 100%. This metric is separate from Evidence Accessibility and is not an extra scored criterion.

## Human-facing accessibility: untested

Static inspection of frontend/src/components/ExplanationBox.jsx shows citation chips and a click callback; frontend/src/App.jsx routes a citation to an edge; frontend/src/components/EvidencePanel.jsx calls the evidence API and renders record fields. This establishes an implemented route, not successful functionality for these saved cases. No citation interaction was run in this audit, and no case-specific saved browser trace/screenshot was available to verify end-to-end opening, correct record rendering or error-free navigation. CauseTrace Evidence Accessibility therefore remains N/A for all five cases. Backend records are not used as a substitute.

docs/EVALUATION.md contains earlier developer-reported browser observations, including a citation-opening check. Those historical observations are not a reproducible interaction artifact for each of the five selected cases and were not promoted to current verified accessibility scores. The N/A result does not assert that clicking is broken. Full-paper availability, keyboard/screen-reader access and current service reachability are also not verified.

## Limitations and interpretation

- This compares available capabilities of the two tested complete workflows. The baseline was configured without retrieval; absence of inspectability support is expected and is not evidence of false economic claims.
- Traceable records and visible metadata do not demonstrate semantic faithfulness, validity of the underlying research, economic reasoning accuracy, or established economic causality.
- System-computed limitations/disclosures count as system capability evidence, not as model-generated answer-quality qualifications.
- V2 baselines used a concise-answer prompt and 2,048 output tokens; saved CauseTrace responses used a different grounded prompt/schema and 900 tokens. All selected responses stopped naturally, but these remain unequal conditions. Model, temperature and context size match. This design cannot estimate the isolated causal effect of Graph RAG.
- Five selected cases and deterministic artifact checks do not establish general usability, completeness of evidence, retrieval recall or frontend reliability. Missing original-paper texts and null metadata limit substantive verification.
- Means exclude N/A and report evaluable n. Numeric zero scores are annotated because zero-height bars can be invisible; N/A has no bar and is never treated as zero. No pooled overall score mixes these differing coverage levels.

## Files and preservation

- evaluation/inspectability_comparison.csv
- evaluation/inspectability_comparison_report.md
- evaluation/inspectability_comparison_chart.png

All pre-existing evaluation files were hash-checked unchanged, including exploratory answer-quality CSV/chart/report, final judge dataset, V1/V2 raw responses and Q1 evidence audit. Only the three requested deliverables were created under evaluation/. No model generation, live retrieval, LLM judging, answer-quality scoring or application development was performed.
