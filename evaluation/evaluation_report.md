# CauseTrace XAI workflow comparison

Research question: “Can Graph RAG make AI's economic reasoning more traceable, transparent, and verifiable?”

## Runs and preservation

Q1 uses its saved pilot artifacts. Its baseline reached the 900-token limit and is incomplete. Q2–Q5 use the previously reviewed exact mappings; no parsing, remapping or concept substitution was performed. Q1 preservation is checked against q1_preservation_manifest.json. No application, prompts, model implementation, data, graph or index were changed.

| Case | Source | Target |
|---|---|---|
| Q1 | inflation (204739) | stock prices (359306) |
| Q2 | economic growth (104891) | stock prices (359306) |
| Q3 | interest rates (213238) | investment (216040) |
| Q4 | government spending (154840) | economic growth (104891) |
| Q5 | monetary policy shocks (257505) | exchange rates (124865) |

Baseline calls Ollama /api/chat with one user message and no retrieved context. CauseTrace calls the existing api.explain_retrieval implementation in process; observation wrappers delegate unchanged and capture the exact paths, pack and Ollama request/response. Both use qwen3:4b, think=false, temperature=0, num_ctx=8192, num_predict=900, stream=false, identical question per pair. CauseTrace retains its original system prompt/schema and baseline retains the Q1 plain-text protocol. Requests, model digest/version, actual completion reasons, timings and errors are saved per case.

## Verified automated metrics

Citation membership rate = valid raw structured evidence_ids entries on the named supplied edge / all raw structured evidence_ids entries. Repeated entries count separately. No attempts means N/A, not 100%. Unique cited IDs include structured and inline ev-number tokens. Structured claim counts refer to the CauseTrace claims array; baseline prose is not mechanically segmented, so baseline claim counts are N/A rather than zero. Raw evidence_ids are checked before sanitation; per-entry details are in citation_membership_q*.json. These checks are not semantic validation.

| Case | Condition | Status | Claims | Cited IDs (unique) | Valid / attempted citations | Candidate paths | Retrieval truncated | LLM incomplete |
|---|---|---|---:|---:|---|---:|---|---|
| Q1 | Baseline Qwen3:4b | completed | N/A | 0 | N/A/N/A | 0 | N/A | True |
| Q1 | CauseTrace | completed | 6 | 7 | 7/7 | 50 | True | False |
| Q2 | Baseline Qwen3:4b | completed | N/A | 0 | N/A/N/A | 0 | N/A | True |
| Q2 | CauseTrace | completed | 6 | 8 | 8/8 | 18 | False | False |
| Q3 | Baseline Qwen3:4b | completed | N/A | 0 | N/A/N/A | 0 | N/A | True |
| Q3 | CauseTrace | completed | 6 | 12 | 12/12 | 50 | True | False |
| Q4 | Baseline Qwen3:4b | completed | N/A | 0 | N/A/N/A | 0 | N/A | True |
| Q4 | CauseTrace | completed | 6 | 6 | 6/6 | 50 | True | False |
| Q5 | Baseline Qwen3:4b | completed | N/A | 0 | N/A/N/A | 0 | N/A | True |
| Q5 | CauseTrace | completed | 6 | 9 | 9/9 | 50 | True | False |

Baseline Qwen3:4b: 5/5 runs returned responses; 5 incomplete LLM responses; 0 truncated retrieval searches. Citation membership rate: N/A (no structured citation attempts).

CauseTrace: 5/5 runs returned responses; 0 incomplete LLM responses; 4 truncated retrieval searches. Citation membership: 42/42 (100.0%).

Per-case/per-condition settings, counts, pack sizes, causal-wording warnings and error fields are in automated_metrics.csv. Output incompleteness is measured from done_reason=length or done=false; missing envelopes are unknown, not assumed complete. No-path and failed generations remain distinct from an observed incomplete response.

## Human review

comparison_scores.csv has 40 rows: five questions × two conditions × four criteria. All scores begin blank; blank means pending, not 0 or N/A. Criterion-specific 0/1/2 anchors are in comparison_rubric.csv. Use 0 (absent/unsupported), 1 (partial), 2 (adequate) with a criterion-specific written rationale. Traceability asks whether key claims can be traced to identifiable records; Evidence Transparency asks whether source and method information is inspectable; Evidence Faithfulness asks whether claims accurately reflect their supporting evidence; Causal Uncertainty asks whether candidate paths are distinguished from established causal relationships. No automatic metric determines these scores.

Review original response, actual packed records, full saved edge records and available original papers. Record missing/unsupported claims, relevant IDs, reviewer and explanation. Use N/A only with na_reason where a meaningful assessment is unavailable. Set review_status=human_reviewed and reviewer when entering numeric scores. Citation existence, semantic faithfulness and causal validity are separate. The older Q1 rubric remains untouched; this comparison uses the four criteria requested for the poster.

Run `.venv/bin/python evaluation/build_comparison.py` after human review to refresh means and chart. Existing scores are preserved. Numeric values are accepted only with reviewer identity and human_reviewed status; means exclude N/A and blanks. human_score_averages.csv reports evaluable n, N/A n and pending n per group. The current chart has no bars and says “Awaiting human evaluation.” Missing scores are never drawn as zero.

## Methodological limits

This is five selected questions with one generation per condition, not a representative benchmark. The comparison includes retrieval, system-prompt and output-format differences, so differences cannot be attributed solely to retrieval. Token limits can leave baseline responses incomplete and constrain fairness. Model digest/version must be inspected across cases rather than assuming an unchanged runtime. Candidate paths may join unrelated paper contexts; metadata does not establish signs, magnitudes, identification or cross-paper compatibility. Dataset method flags and existing strong-wording heuristics are not causal proof or hallucination measures. Citation membership cannot guarantee semantic correctness. No human scores or causal-validity verdicts have been generated.

## Files

- comparison_scores.csv — blank human review rows.
- automated_metrics.csv and citation_membership_q1.json–citation_membership_q5.json — mechanical metrics and checks.
- evaluation_report.md — this report.
- failure_examples.md — observed incomplete outputs and heuristic/search warnings.
- xai_comparison_chart.png — 4,800 × 2,700 navy/light-blue chart template, white/pale-blue background.
- human_score_averages.csv — evaluable counts and pending means.
- pilot_q1/ — unchanged Q1 originals and evidence audit.
- case_q2/ through case_q5/ — raw responses/envelopes, exact requests, selected mappings, model identity/settings, retrieval and full packed-edge evidence, citation validation and error metadata.
- q1_preservation_manifest.json — hashes verifying Q1 preservation.
- run_remaining.py and build_comparison.py — evaluation-only capture/report scripts.
