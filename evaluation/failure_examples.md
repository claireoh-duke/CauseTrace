# Observed failures and review warnings

Saved artifacts only; no semantic Pass/Fail judgments or rubric scores. Causal-wording flags are heuristic warnings, not hallucination counts.

### Q1 — Baseline Qwen3:4b: incomplete generation

`done_reason=length`, output tokens=900, cap=900. Exact returned ending:

```text
and simple analogies could help. Like comparing stock prices to a house value—higher inflation might make the house more expensive, but if the house is in a bad area (high interest rates), it might drop.

But maybe stick to the economic terms. Focus on the key points: profit impact, interest rates, expectations, and central bank actions.

Double-check sources. From what I remember, the Fed's policy is a big factor. When they raise rates to combat
```

Original: baseline_response.txt (`pilot_q1/baseline_response.txt`, raw artifact not published). No replacement generated.

### Q1 — CauseTrace: causal-language heuristic warnings

6 flagged claim(s); this is not a hallucination count. Example unchanged statement:

```text
inflation affects monetary policy (ev290564, DP9763, 2013)
```

Citation membership, semantic support and causal validity are separate assessments. See pilot_q1/citation_validation.json (`pilot_q1/citation_validation.json`, raw artifact not published).

### Q1 — CauseTrace: incomplete retrieval

50 candidate paths returned; truncation reason `max_paths`. This is a bounded candidate list, not exhaustive causal evidence.

### Q2 — Baseline Qwen3:4b: incomplete generation

`done_reason=length`, output tokens=900, cap=900. Exact returned ending:

```text
2008, growth was negative but stocks were down.

The user might be looking for practical advice. So conclude with why it's important to consider the context—what's driving the growth, current economic conditions, etc. Maybe add that investors should look at growth quality and not just the number.

Alright, structure the response: Introduction, direct effects, indirect effects, time frames, sector differences, key caveats, and a summary. Make sure
```

Original: baseline_response.txt (`case_q2/baseline_response.txt`, raw artifact not published). No replacement generated.

### Q3 — Baseline Qwen3:4b: incomplete generation

`done_reason=length`, output tokens=900, cap=900. Exact returned ending:

```text
ns could be useful without giving advice. 

Make sure to avoid markdown. Use clear sections with headings in the response. But since the user said no markdown, I’ll write it in plain English with clear paragraphs. 

Double-check facts: Yes, higher interest rates increase the cost of borrowing, which reduces investment. Higher rates also increase the return on savings, so investors might shift to safer assets. 

Also, in emerging markets, interest
```

Original: baseline_response.txt (`case_q3/baseline_response.txt`, raw artifact not published). No replacement generated.

### Q3 — CauseTrace: incomplete retrieval

50 candidate paths returned; truncation reason `max_paths`. This is a bounded candidate list, not exhaustive causal evidence.

### Q4 — Baseline Qwen3:4b: incomplete generation

`done_reason=length`, output tokens=900, cap=900. Exact returned ending:

```text
ownturns helps more than during booms.

Check if there's a common misconception. For example, some think government spending always causes inflation. But in the short term, it might not if the economy is not at full capacity. Inflation is more of a concern when the economy is overheating.

Make sure to mention that the effect isn't uniform. For instance, spending on military vs. education has different impacts. The user might not realize that the
```

Original: baseline_response.txt (`case_q4/baseline_response.txt`, raw artifact not published). No replacement generated.

### Q4 — CauseTrace: incomplete retrieval

50 candidate paths returned; truncation reason `max_paths`. This is a bounded candidate list, not exhaustive causal evidence.

### Q5 — Baseline Qwen3:4b: incomplete generation

`done_reason=length`, output tokens=900, cap=900. Exact returned ending:

```text
d be useful. But since they asked for the mechanism, stick to that.

Double-check sources. From what I recall, the literature shows that monetary policy shocks have a significant impact on exchange rates, especially in the short term. The exchange rate is a key transmission channel for monetary policy.

Avoid getting too technical with models. Keep it accessible. Use terms like "sudden change" instead of "shock" if needed, but the question uses "
```

Original: baseline_response.txt (`case_q5/baseline_response.txt`, raw artifact not published). No replacement generated.

### Q5 — CauseTrace: incomplete retrieval

50 candidate paths returned; truncation reason `max_paths`. This is a bounded candidate list, not exhaustive causal evidence.
