# indexes/

Search indexes used for semantic concept matching. Intentionally empty in the repository.

| File | Contents | Approx. size |
|---|---|---|
| `kg_bge_m3.faiss` | `IndexFlatIP`, L2-normalised BGE-M3 dense vectors, 1024 dimensions, one per graph node | 1.56 GiB / 1.68 GB (410,160 vectors in the development build) |
| `kg_nodes.json` | JSON list of node names **in exact FAISS ID order** | 19 MB |

Both files must come from the same build. `kg_nodes.json[i]` is the text that produced vector `i`; never reorder, rename or regenerate one without the other. At startup the backend checks that the node list equals the set of normalised cause/effect labels in `data/macro_claims.parquet`, that the vector count equals the node count, and that a sample of stored vectors has unit length.

Build them with `notebooks/build_index.ipynb`. They are far above GitHub's 100 MB file limit and are ignored by Git (see `.gitignore`).
