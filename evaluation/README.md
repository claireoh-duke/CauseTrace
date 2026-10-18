# Evaluation summaries

Descriptive, saved-artifact evaluation of CauseTrace on **five selected questions**, compared with a no-retrieval Qwen3:4b baseline. It is not a benchmark: one generation per condition, hand-chosen questions, and the two conditions differ in prompt, output format and token limit. Read the "Methodological limits" and "Limitations" sections of the reports before quoting any number.

| Question | Source concept | Target concept |
|---|---|---|
| Q1 | inflation | stock prices |
| Q2 | economic growth | stock prices |
| Q3 | interest rates | investment |
| Q4 | government spending | economic growth |
| Q5 | monetary policy shocks | exchange rates |

## What is included

| File | What it is |
|---|---|
| `evaluation_report.md` | Workflow comparison: runs, automated metrics, citation membership, methodological limits |
| `inspectability_comparison_report.md`, `inspectability_comparison.csv`, `inspectability_comparison_chart.png` | Deterministic capability audit (citation traceability, evidence accessibility, evidence transparency, retrieval transparency) |
| `evidence_audit_summary.md`, `evidence_audit_metrics.csv`, `evidence_audit_figure.png` | Audit of the 38 distinct evidence records cited by CauseTrace (citation integrity, metadata completeness, path disclosure) |
| `failure_examples.md` | Observed incomplete outputs and heuristic warnings |
| `automated_metrics.csv`, `comparison_rubric.csv`, `comparison_scores.csv`, `human_score_averages.csv`, `xai_comparison_chart.png` | Metrics, rubric and the (still blank) human-review template |

**Human answer-quality scores have not been entered.** `comparison_scores.csv` is a template with blank scores, and `xai_comparison_chart.png` is an empty chart that says "Awaiting human evaluation". No semantic-faithfulness or causal-validity verdicts exist.

## What is intentionally not included

The reports refer to raw run artifacts that are **not published** in this repository:

- per-case folders (`pilot_q1/`, `case_q2/` … `case_q5/`, `v2/`) with exact requests, raw model responses, and the retrieved evidence records, which contain record text (paper titles and claim fields) from the original research dataset, which has no published license and therefore cannot be assumed redistributable;
- run metadata that records local machine paths;
- preservation manifests (SHA-256 hashes), the final judge dataset, and the evaluation-only capture/report scripts that read those folders.

Links and file names in the reports that point to those items are therefore unresolved here. The numbers in the published reports and CSVs were computed from the original artifacts, which the author keeps privately.

## Note on the copied reports

The reports and CSVs are copied unchanged from the author's working directory, with one exception: in `failure_examples.md`, Markdown links to unpublished raw files were converted to plain text so that no link in this repository is broken.
