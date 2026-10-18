"""Help when a mapped concept is poorly connected or a path search comes back empty.

The graph keeps surface forms as separate nodes ("stock price" vs "stock prices"), and the evidence is
often concentrated in one of them. These helpers never merge or rename concepts. They only point out
better-connected related nodes and let the user choose.
"""

import time
from typing import Any, Dict, List, Optional

from . import config
from .graph import GraphStore
from .paths import find_paths


def total_degree(store: GraphStore, name: str) -> int:
    return store.graph.in_degree(name) + store.graph.out_degree(name)


def connectivity_hint(store: GraphStore, selected: str, candidates: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Warn when the selected node is thin but a close semantic neighbor is far better connected."""
    own = total_degree(store, selected)
    if own > config.THIN_NODE_MAX_DEGREE:
        return None
    better = []
    for cand in candidates:
        if cand["node"] == selected or cand["similarity"] < config.HINT_MIN_SIMILARITY:
            continue
        degree = total_degree(store, cand["node"])
        if degree >= config.HINT_MIN_DEGREE_RATIO * max(own, 1):
            better.append({"node": cand["node"], "node_id": cand["node_id"],
                           "similarity": cand["similarity"], "total_edges": degree})
    if not better:
        return None
    better.sort(key=lambda c: -c["total_edges"])
    return {
        "selected_total_edges": own,
        "alternatives": better,
        "message": (
            "'{}' has only {} edge(s) in the graph. Closely related concepts with much more data exist; "
            "they are different nodes, not the same concept.".format(selected, own)
        ),
    }


def _side(store: GraphStore, candidate: Dict[str, Any], original: str) -> Dict[str, Any]:
    """One side of a suggested pair, with connectivity and whether it is the concept originally requested."""
    name = candidate["node"]
    return {
        "node": name,
        "node_id": candidate["node_id"],
        "similarity": candidate["similarity"],
        "out_degree": store.graph.out_degree(name),
        "in_degree": store.graph.in_degree(name),
        "is_original": name == original,
    }


def suggest_pairs(
    store: GraphStore,
    source: str,
    target: str,
    source_candidates: List[Dict[str, Any]],
    target_candidates: List[Dict[str, Any]],
    max_hops: int,
    max_paths: int = config.SUGGEST_MAX_PATHS_PER_PAIR,
    per_pair_time_s: float = config.SUGGEST_PAIR_TIME_S,
    total_time_s: float = config.SUGGEST_TOTAL_TIME_S,
) -> Dict[str, Any]:
    """Try related source/target pairs and report the ones that have paths (bounded)."""
    deadline = time.monotonic() + total_time_s
    found: List[Dict[str, Any]] = []
    tried = 0
    incomplete = False
    for s in source_candidates:
        for t in target_candidates:
            if (s["node"], t["node"]) == (source, target) or s["node"] == t["node"]:
                continue
            if s["node"] not in store.graph or t["node"] not in store.graph:
                continue
            if time.monotonic() > deadline:
                incomplete = True
                break
            tried += 1
            result = find_paths(store, s["node"], t["node"], max_hops=max_hops,
                                max_paths=max_paths, time_limit_s=per_pair_time_s)
            if result["paths"]:
                found.append({
                    "source": _side(store, s, source),
                    "target": _side(store, t, target),
                    "paths_found": len(result["paths"]),
                    "more_possible": result["truncated"],
                    "shortest_hops": min(len(p) - 1 for p in result["paths"]),
                })
        if incomplete:
            break
    found.sort(key=lambda r: -(r["source"]["similarity"] * r["target"]["similarity"]))
    return {"pairs_tried": tried, "suggestions": found, "incomplete": incomplete, "max_hops": max_hops}
