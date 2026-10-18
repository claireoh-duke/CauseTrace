"""Load and validate the existing claims table, FAISS index and node list.

Nothing here writes to the data files or rebuilds embeddings.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List

# Load PyTorch before FAISS to avoid a reported macOS OpenMP import-order conflict.
import torch  # noqa: F401
import faiss
import networkx as nx
import numpy as np
import pandas as pd

from . import config
from .graph import GraphStore
from .labels import normalize_series

logger = logging.getLogger("uvicorn.error")

REQUIRED_CLAIM_COLUMNS = ("paper_id", "cause", "effect")


@dataclass
class Resources:
    claims: pd.DataFrame
    index: Any  # faiss.Index
    nodes: List[str]
    node_to_id: Dict[str, int]
    store: GraphStore
    stats: Dict[str, Any]


def _require_files() -> None:
    for path in (config.CLAIMS_PATH, config.FAISS_PATH, config.NODES_PATH):
        if not path.is_file():
            raise FileNotFoundError("Required file not found: {}".format(path))


def _load_nodes() -> List[str]:
    with config.NODES_PATH.open("r", encoding="utf-8") as file:
        nodes = json.load(file)
    if not isinstance(nodes, list) or not all(isinstance(n, str) for n in nodes):
        raise ValueError("kg_nodes.json must contain an ordered list of strings.")
    if len(set(nodes)) != len(nodes):
        raise ValueError("kg_nodes.json contains duplicate node names.")
    return nodes


def _check_index(index: Any, nodes: List[str]) -> Dict[str, Any]:
    if index.ntotal == 0 or index.ntotal != len(nodes):
        raise ValueError(
            "FAISS index has {} vectors but kg_nodes.json has {} nodes.".format(
                index.ntotal, len(nodes)
            )
        )
    if index.d != config.EMBEDDING_DIM or index.metric_type != faiss.METRIC_INNER_PRODUCT:
        raise ValueError("Expected a 1024-dimensional inner-product FAISS index.")

    # Spot check only: this does not prove every stored vector is correct.
    rng = np.random.default_rng(0)
    sample = min(config.NORM_CHECK_SAMPLE, index.ntotal)
    ids = rng.choice(index.ntotal, size=sample, replace=False)
    norms = np.array([np.linalg.norm(index.reconstruct(int(i))) for i in ids])
    max_dev = float(np.abs(norms - 1.0).max())
    if max_dev > config.NORM_CHECK_TOLERANCE:
        raise ValueError(
            "Sampled stored vectors are not unit length (max deviation {:.4f}); "
            "inner product would not equal cosine similarity.".format(max_dev)
        )
    return {"sampled_vectors": int(sample), "max_norm_deviation": max_dev}


def _claim_stats(claims: pd.DataFrame, nodes: List[str]) -> Dict[str, Any]:
    missing = set(REQUIRED_CLAIM_COLUMNS) - set(claims.columns)
    if missing:
        raise ValueError("Missing claim columns: {}".format(sorted(missing)))

    cause = normalize_series(claims["cause"])
    effect = normalize_series(claims["effect"])
    valid = cause.notna() & effect.notna() & (cause != "") & (effect != "")
    pairs = set(zip(cause[valid], effect[valid]))
    labels = set(cause[valid]) | set(effect[valid])

    only_in_nodes = len(set(nodes) - labels)
    only_in_claims = len(labels - set(nodes))
    if only_in_nodes or only_in_claims:
        raise ValueError(
            "Node list and claim labels disagree: {} nodes absent from claims, "
            "{} claim labels absent from nodes.".format(only_in_nodes, only_in_claims)
        )

    # Counts are kept separate on purpose: rows are not papers, and edges are not rows.
    return {
        "claim_rows": int(len(claims)),
        "claim_rows_with_valid_cause_and_effect": int(valid.sum()),
        "unique_paper_ids": int(claims["paper_id"].dropna().nunique()),
        "unique_directed_pairs": int(len(pairs)),
        "unique_labels": int(len(labels)),
    }


def load_resources() -> Resources:
    _require_files()

    logger.info("Loading claims table...")
    claims = pd.read_parquet(config.CLAIMS_PATH)

    logger.info("Loading node list and FAISS index...")
    nodes = _load_nodes()
    index = faiss.read_index(str(config.FAISS_PATH))

    stats = _claim_stats(claims, nodes)
    stats["indexed_nodes"] = int(index.ntotal)
    stats["embedding_dimension"] = int(index.d)
    stats["norm_check"] = _check_index(index, nodes)

    node_to_id = {name: i for i, name in enumerate(nodes)}

    logger.info("Building directed graph and pair index...")
    store = GraphStore(claims, nodes)
    stats["graph_nodes"] = int(store.graph.number_of_nodes())
    stats["graph_edges"] = int(store.graph.number_of_edges())
    stats["graph_self_loops"] = int(nx.number_of_selfloops(store.graph))
    logger.info(
        "Loaded %s claim rows (%s unique papers) and %s indexed nodes.",
        stats["claim_rows"], stats["unique_paper_ids"], stats["indexed_nodes"],
    )
    return Resources(claims=claims, index=index, nodes=nodes,
                     node_to_id=node_to_id, store=store, stats=stats)
