# data/

This directory holds the **claims table** that CauseTrace reads at startup. It is intentionally empty in the repository.

| File | Contents | Approx. size |
|---|---|---|
| `macro_claims.parquet` | One row per macroeconomic claim record (cause, effect, `paper_id`, `title`, `year`, method fields, field flags). Required columns: `paper_id`, `cause`, `effect`. | 14 MB (347,571 rows in the development build) |

The table is derived from the aggregated graph shards of the original *Causal Claims in Economics* data release (filtered to `is_macroeconomics == True`, with `cause`/`effect` stripped and lower-cased). The data is **not redistributed here**: the original repository publishes no license, so no redistribution right can be assumed. See the [technical guide](../docs/TECHNICAL_GUIDE.md#original-research-data-attribution) and `notebooks/build_index.ipynb` for how to build it yourself from the original release.

Files in this directory are ignored by Git (see `.gitignore`). Do not commit them.
