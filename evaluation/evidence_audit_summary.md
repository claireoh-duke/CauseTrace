# CauseTrace saved-evidence audit metrics

Five original CauseTrace cases; saved artifacts only. No AI responses regenerated, system modified, LLM judging, frontend testing or answer-quality scoring performed. Baselines and all prior results are preserved.

## Units and interpretation

- Citation Integrity uses raw structured citation entries in claims[].evidence_ids, including repeated entries; each entry must belong to its named supplied edge and resolve to a saved full record. Inline repetitions are not double-counted. All text citation IDs occur in those lists in these cases.
- Metadata uses unique evidence_id records per case and a global union of **38 distinct cited records** overall. Cross-case repeats count once in overall metadata, while citation integrity retains all 42 entries. Missing fields in an available record are distinguished from absent record/field data.
- A field is populated when present and non-null/nonempty. Stored year is treated as the dataset’s publication-year metadata, without independent publication-date verification. Recorded method labels are not validated identification strategies. “other” and “do not know” populate a field but convey an unspecified method; informative labels exclude those placeholders. “theoretical/non-empirical” is an informative study-method label, not an empirical identification design.
- Paper diversity deduplicates exact paper_id values. Distinct IDs may represent versions of the same work; no title-based consolidation was performed. A count has no meaningful denominator/percentage and is explicitly N/A for those columns.
- Disclosure is a manual, literal text-presence check of raw generated answer and claim statements. System-computed limitations, fixed_notes, pack disclosures and request prompts are excluded. Cross-paper explicitness is separated from merely mentioning several papers. This is not a semantic faithfulness or causal-uncertainty score.

## Citation integrity and diversity

| Case | Valid entries / entries | Citation integrity | Unique cited records | Unique paper IDs |
|---|---|---|---|---|
| Q1 | 7/7 | 100.0% | 7 | 7 |
| Q2 | 8/8 | 100.0% | 8 | 6 |
| Q3 | 12/12 | 100.0% | 12 | 11 |
| Q4 | 6/6 | 100.0% | 6 | 6 |
| Q5 | 9/9 | 100.0% | 9 | 8 |
| Overall | 42/42 | 100.0% | 38 (global union) | 33 (global union) |

Paper-ID union: DP10087, DP11018, DP14057, DP1727, DP18265, DP2550, DP3092, DP4114, DP4846, DP513, DP6216, DP6782, DP7840, DP7876, DP9763, w0885, w10356, w10448, w10780, w1230, w1498, w16218, w18888, w19009, w2047, w21576, w2389, w26333, w2682, w3576, w4565, w7010, w8767.

## Metadata completeness

| Scope | Paper ID | Title | Publication year | Method field populated | All four fields | Informative method label |
|---|---|---|---|---|---|---|
| Q1 | 7/7 (100%) | 7/7 (100%) | 7/7 (100%) | 7/7 (100%) | 7/7 (100%) | 4/7 (57.1%) |
| Q2 | 8/8 (100%) | 8/8 (100%) | 8/8 (100%) | 8/8 (100%) | 8/8 (100%) | 4/8 (50.0%) |
| Q3 | 12/12 (100%) | 12/12 (100%) | 12/12 (100%) | 12/12 (100%) | 12/12 (100%) | 7/12 (58.3%) |
| Q4 | 6/6 (100%) | 6/6 (100%) | 6/6 (100%) | 6/6 (100%) | 6/6 (100%) | 4/6 (66.7%) |
| Q5 | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 5/9 (55.6%) |
| Overall | 38/38 (100%) | 38/38 (100%) | 38/38 (100%) | 38/38 (100%) | 38/38 (100%) | 21/38 (55.3%) |

For the four requested fields there are **0 null/empty values and 0 unavailable records/fields** in the cited record set. However, **17 of 38 method values are unspecified placeholders**: ev259105=`other`, ev263781=`other`, ev263784=`other`, ev263789=`other`, ev273509=`other`, ev273510=`other`, ev275503=`other`, ev281441=`other`, ev289213=`other`, ev290165=`other`, ev290564=`other`, ev292325=`other`, ev292327=`other`, ev316547=`other`, ev316553=`other`, ev336494=`other`, ev4187=`do not know`. Treat these as present-but-uninformative method metadata, not verified identification methods.

Original paper texts and independently verified study-identification details are unavailable in the saved inputs. Other fields, such as sources_of_exogenous_variation, can be null; this is recorded missing text, not proof the original paper lacked exogenous variation. Citation associations, method labels and source metadata do not validate the papers or generated claims.

## Path disclosure in generated answers

| Case | Explicit cross-paper path assembly | Generated retrieval limits stated | Exact relevant generated excerpt |
|---|---|---|---|
| Q1 | yes | No (0/1; 0%) | These paths are assembled from different papers and their compatibility is not assessed. |
| Q2 | no | No (0/1; 0%) | No relevant explicit cross-paper disclosure. |
| Q3 | yes | No (0/1; 0%) | These paths are assembled from different papers and their compatibility is not assessed. |
| Q4 | partial_not_explicit_path_assembly | No (0/1; 0%) | These links are supported by evidence from various papers across different years. |
| Q5 | yes | No (0/1; 0%) | Each path involves evidence from different papers with varying methods. |

**Strict explicit cross-paper disclosure: 3/5 (60%)**, Q1, Q3 and Q5. **Partial multi-paper attribution: 1/5 (20%)**, Q4; its sentence does not explicitly state that individual paths combine papers. Q2 lacks either explicit path-assembly disclosure or this partial attribution. Merely listing paper counts/dates or paths does not qualify as an explicit assembly caveat.

**Generated retrieval-limit disclosure: 0/5 (0%)**. None of the answers or claims states numeric search bounds, stopping limits or pack-selection bounds. Path identifiers and paper counts are not retrieval limits. **Saved retrieval-limit availability: 5/5 (100%)**, a separate system-artifact result: max_hops=3, max_paths=50, time_limit_s=5.0. System-added notes disclose subset and truncation information, but were not credited to generated text. Four saved searches were truncated at max_paths; this is not output truncation or proof of unsupported claims.

## Figure and limitations

The 5,400 × 3,600-pixel (18 × 12-inch at 300 dpi) navy/blue figure is sized for use within a 36 × 24-inch poster; full-poster enlargement yields 150 dpi. It shows only measured citation associations, recorded metadata coverage, exact paper-ID counts and explicit generated-text disclosures. No frontend-accessibility or untested causal-validity values are plotted. Counts and percentages are annotated with numerators and denominators where meaningful.

The metadata panel reports literal field population and separately annotates informative-method coverage; it must not be described as 100% verified identification-method completeness. The figure does not turn missing or untested functionality into zeros. Disclosure zeros are observed absences in available generated text, not missing tests. System/backend availability and human-facing access are different claims; no browser access is verified here.

This is a five-case descriptive artifact audit, not evidence that Graph RAG causes better economic reasoning or establishes economic causality. Valid citation IDs, greater paper counts and disclosure wording are not measures of semantic faithfulness or causal validity. The generated claims and original papers remain substantively unverified.

## Deliverables and preservation

- evaluation/evidence_audit_metrics.csv — long-form numerators, denominators, percentages, metadata status and measurement definitions.
- evaluation/evidence_audit_summary.md — this report.
- evaluation/evidence_audit_figure.png — annotated publication-ready figure.

All pre-existing evaluation files were hash-checked unchanged, including raw outputs, baseline comparisons, exploratory answer-quality files, final judge dataset and inspectability comparison. Only these three evaluation deliverables were created.
