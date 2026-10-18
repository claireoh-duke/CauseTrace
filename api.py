"""CauseTrace backend: data status, node search, bounded path retrieval, evidence and local-LLM explanation.

Run from the project root with a single worker:
    .venv/bin/python -m uvicorn api:app --host 127.0.0.1 --port 8000

Data files and the FAISS index are only read, never written or rebuilt.
"""

import logging
from contextlib import asynccontextmanager

import heapq
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from causetrace import config, evidence, explain as explain_lib, suggest
from causetrace.encoder import CpuQueryEncoder
from causetrace.labels import normalize_label
from causetrace.llm import LLMBadOutput, LLMUnavailable, OllamaClient
from causetrace.paths import find_paths, group_by_first_intermediate
from causetrace.resources import load_resources

logger = logging.getLogger("uvicorn.error")
state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load saved artifacts once per process; BGE-M3 loads on the first search."""
    try:
        state["resources"] = load_resources()
        state["encoder"] = CpuQueryEncoder()
        state["llm"] = OllamaClient()
        logger.info("Ready. BGE-M3 will load on CPU when the first search arrives.")
        yield
    finally:
        state.clear()


app = FastAPI(
    title="CauseTrace API",
    version="0.4.0",
    description=(
        "Data status, semantic node search, bounded directed path retrieval and original evidence lookup. "
        "Cosine similarity measures semantic relatedness, not causal confidence."
    ),
    lifespan=lifespan,
)

# The browser UI runs on the Vite dev/preview servers on this machine only.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:4173", "http://127.0.0.1:4173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    """Report loaded artifacts. Counts of rows, edges and papers are kept separate."""
    resources = state["resources"]
    return {
        "status": "ready",
        "counts": resources.stats,
        "embedding_model": config.EMBEDDING_MODEL,
        "embedding_device": "cpu",
        "embedding_model_loaded": state["encoder"].loaded,
        "notes": [
            "claim_rows counts parquet rows, not papers or graph edges.",
            "unique_directed_pairs is the edge count of the DiGraph built from cause -> effect.",
            "norm_check samples stored vectors only; it does not validate every vector.",
        ],
    }


def _semantic_search(normalized: str, top_k: int) -> dict:
    """Encode one normalized query on CPU and search the original, unchanged FAISS index."""
    resources = state["resources"]
    try:
        vector, truncated = state["encoder"].encode(normalized)
        scores, ids = resources.index.search(vector, min(top_k, resources.index.ntotal))
    except Exception as exc:
        logger.exception("Node search failed.")
        raise HTTPException(
            status_code=500,
            detail="Node search failed. Check the backend terminal for details.",
        ) from exc

    exact_id = resources.node_to_id.get(normalized)
    return {
        "normalized_query": normalized,
        "query_truncated": truncated,
        "max_query_tokens": config.QUERY_MAX_TOKENS,
        "exact_match": (
            None if exact_id is None else {"node_id": exact_id, "node": resources.nodes[exact_id]}
        ),
        "results": [
            {
                "rank": rank,
                "node_id": int(node_id),
                "node": resources.nodes[int(node_id)],
                "similarity": float(score),
                "is_exact": int(node_id) == exact_id,
                "out_degree": resources.store.graph.out_degree(resources.nodes[int(node_id)]),
                "in_degree": resources.store.graph.in_degree(resources.nodes[int(node_id)]),
            }
            for rank, (score, node_id) in enumerate(zip(scores[0], ids[0]), start=1)
            if node_id >= 0
        ],
    }


@app.get("/nodes/search")
def search_nodes(
    query: str = Query(..., min_length=1, max_length=config.QUERY_MAX_CHARS),
    top_k: int = Query(config.SEARCH_TOP_K_DEFAULT, ge=1, le=config.SEARCH_TOP_K_MAX),
):
    """Semantic search over indexed node names (CPU query encoding)."""
    normalized = normalize_label(query)
    if not normalized:
        raise HTTPException(status_code=400, detail="Please enter a non-empty query.")
    found = _semantic_search(normalized, top_k)
    return {
        "query": query,
        **found,
        "similarity_meaning": (
            "Cosine similarity between BGE-M3 embeddings: semantic relatedness of the "
            "text only, not causal confidence or evidence quality."
        ),
    }


# ---------------------------------------------------------------- Stage 2 ----


def _node_name(node_id: int) -> str:
    resources = state["resources"]
    if node_id < 0 or node_id >= len(resources.nodes):
        raise HTTPException(status_code=404, detail="Unknown node_id {}.".format(node_id))
    return resources.nodes[node_id]


def _node_info(name: str) -> dict:
    store = state["resources"].store
    graph = store.graph
    return {
        "node_id": store.node_to_id[name],
        "node": name,
        "out_degree": graph.out_degree(name),
        "in_degree": graph.in_degree(name),
    }


@app.get("/graph/overview")
def graph_overview(top_n: int = Query(15, ge=1, le=config.OVERVIEW_TOP_N_MAX)):
    """Full-dataset counts plus a bounded list of the best-connected nodes."""
    store = state["resources"].store
    by_out = heapq.nlargest(top_n, store.graph.out_degree(), key=lambda x: x[1])
    by_in = heapq.nlargest(top_n, store.graph.in_degree(), key=lambda x: x[1])
    return {
        "counts": state["resources"].stats,
        "top_by_out_degree": [_node_info(n) for n, _ in by_out],
        "top_by_in_degree": [_node_info(n) for n, _ in by_in],
        "note": "Only the top {} nodes per list are returned; the graph is explored progressively.".format(top_n),
    }


@app.get("/nodes/lookup")
def lookup_node(name: str = Query(..., min_length=1, max_length=config.QUERY_MAX_CHARS)):
    """Exact (normalized) match against indexed node names."""
    normalized = normalize_label(name)
    node_id = state["resources"].node_to_id.get(normalized)
    if node_id is None:
        return {"found": False, "normalized_name": normalized}
    return {"found": True, "normalized_name": normalized, **_node_info(normalized)}


@app.get("/graph/neighborhood")
def neighborhood(
    node_id: int,
    direction: str = Query("both", pattern="^(out|in|both)$"),
    limit: int = Query(config.NEIGHBORHOOD_LIMIT_DEFAULT, ge=1, le=config.NEIGHBORHOOD_LIMIT_MAX),
):
    """Direct neighbors, ordered by number of supporting claim rows (descending).

    Ordering is by data volume only; it says nothing about causal strength.
    """
    store = state["resources"].store
    name = _node_name(node_id)
    candidates = []
    if direction in ("out", "both"):
        candidates += [(name, other) for other in store.graph.successors(name)]
    if direction in ("in", "both"):
        candidates += [(other, name) for other in store.graph.predecessors(name)]
    candidates.sort(key=lambda e: (-len(store.pair_rows[e]), e))
    shown = candidates[:limit]
    members = {name}
    for a, b in shown:
        members.update((a, b))
    return {
        "center": _node_info(name),
        "direction": direction,
        "edges_total": len(candidates),
        "edges_returned": len(shown),
        "truncated": len(candidates) > limit,
        "nodes": [_node_info(n) for n in sorted(members)],
        "edges": [evidence.edge_summary(store, a, b) for a, b in shown],
    }


@app.get("/edges/evidence")
def edge_evidence(
    source_id: int,
    target_id: int,
    limit: int = Query(config.EVIDENCE_LIMIT_DEFAULT, ge=1, le=config.EVIDENCE_LIMIT_MAX),
):
    """Original claim records behind one directed edge (source_id -> target_id)."""
    store = state["resources"].store
    source, target = _node_name(source_id), _node_name(target_id)
    if not store.has_edge(source, target):
        raise HTTPException(
            status_code=404,
            detail="No directed edge {!r} -> {!r}. The reverse direction is a different edge.".format(source, target),
        )
    return evidence.edge_evidence(store, source, target, limit=limit)


class PathRequest(BaseModel):
    source_id: int
    target_id: int
    max_hops: int = Field(config.PATH_MAX_HOPS_DEFAULT, ge=1, le=config.PATH_MAX_HOPS_LIMIT)
    max_paths: int = Field(config.PATH_MAX_RESULTS_DEFAULT, ge=1, le=config.PATH_MAX_RESULTS_LIMIT)
    time_limit_s: float = Field(config.PATH_TIME_LIMIT_DEFAULT_S, gt=0, le=config.PATH_TIME_LIMIT_MAX_S)


def _run_retrieval(request: PathRequest):
    """Bounded, shortest-first directed paths source -> target with edge-level evidence summaries."""
    store = state["resources"].store
    source, target = _node_name(request.source_id), _node_name(request.target_id)
    if source == target:
        raise HTTPException(status_code=400, detail="source_id and target_id must differ.")
    for name in (source, target):
        if name not in store.graph:
            raise HTTPException(status_code=404, detail="Node {!r} has no graph edges.".format(name))

    result = find_paths(
        store, source, target,
        max_hops=request.max_hops, max_paths=request.max_paths, time_limit_s=request.time_limit_s,
    )
    edge_cache = {}
    paths = []
    for number, nodes in enumerate(result["paths"]):
        edges = []
        for a, b in zip(nodes, nodes[1:]):
            if (a, b) not in edge_cache:
                edge_cache[(a, b)] = evidence.edge_summary(store, a, b)
            edges.append(edge_cache[(a, b)])
        paths.append({
            "path_index": number,
            "hops": len(nodes) - 1,
            "nodes": [{"node_id": store.node_to_id[n], "node": n} for n in nodes],
            "edges": edges,
            **evidence.path_paper_overlap(store, nodes),
        })

    if paths:
        message = "{} candidate path(s) found{}.".format(
            len(paths), "; the list is incomplete (" + result["truncated_reason"] + ")" if result["truncated"] else "")
    else:
        message = (
            "No path found within these limits (max_hops={max_hops}, time_limit_s={time_limit_s}"
            "{extra}). This does not mean no economic relationship exists."
        ).format(extra=", search stopped early: " + result["truncated_reason"] if result["truncated"] else "", **result["limits"])

    response = {
        "source": _node_info(source),
        "target": _node_info(target),
        "found": bool(paths),
        "message": message,
        "limits": result["limits"],
        "truncated": result["truncated"],
        "truncated_reason": result["truncated_reason"],
        "elapsed_s": result["elapsed_s"],
        "paths": paths,
        "channels": group_by_first_intermediate(result["paths"]),
        "channels_note": "Channels are an algorithmic grouping by first intermediate concept, not validated economic mechanisms.",
        "caveats": [
            "Paths are candidates assembled from separate claim records; they are not validated causal chains.",
            "Path length and paper counts are not measures of credibility.",
            "Cross-paper compatibility and conditions have not been assessed.",
        ],
    }
    return response, result


@app.post("/paths")
def retrieve_paths(request: PathRequest):
    """Bounded, shortest-first directed paths with edge-level evidence summaries."""
    return _run_retrieval(request)[0]


# ---------------------------------------------------------------- Stage 4 ----


@app.get("/llm/status")
def llm_status():
    """Whether the local Ollama server is reachable and has the configured model."""
    info = state["llm"].status()
    info["ready"] = info["reachable"] and info["model_installed"]
    return info


def _require_llm() -> OllamaClient:
    info = state["llm"].status()
    if not (info["reachable"] and info["model_installed"]):
        raise HTTPException(status_code=503, detail=info["error"] or "The local LLM is unavailable.")
    return state["llm"]


def _map_phrase(phrase: str) -> Optional[dict]:
    """Resolve an extracted phrase to graph nodes: exact match first, then semantic candidates."""
    if not phrase:
        return None
    found = _semantic_search(phrase, config.PARSE_CANDIDATES)
    candidates = []
    for result in found["results"]:
        candidates.append({**_node_info(result["node"]), "similarity": result["similarity"],
                           "is_exact": result["is_exact"]})
    selected = next((c for c in candidates if c["is_exact"]), candidates[0] if candidates else None)
    hint = suggest.connectivity_hint(state["resources"].store, selected["node"], candidates) if selected else None
    return {
        "phrase": phrase,
        "connectivity_hint": hint,
        "has_exact_match": found["exact_match"] is not None,
        "selected": selected,
        "candidates": candidates,
        "query_truncated": found["query_truncated"],
    }


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=config.QUESTION_MAX_CHARS)


@app.post("/ask/parse")
def ask_parse(request: AskRequest):
    """Extract cause/effect phrases with the local LLM, then map them onto graph nodes.

    The phrases are proposals. The mapping must be confirmed by the user unless both are exact matches.
    """
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Please enter a question.")
    client = _require_llm()
    try:
        phrases = explain_lib.parse_question(client, question)
    except LLMUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LLMBadOutput as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    source = _map_phrase(phrases["cause"])
    target = _map_phrase(phrases["effect"])
    return {
        "question": question,
        "model": client.model,
        "source": source,
        "target": target,
        "needs_confirmation": not (
            source and target and source["has_exact_match"] and target["has_exact_match"]
            and not source["connectivity_hint"] and not target["connectivity_hint"]
        ),
        "note": "Extracted phrases are model proposals. Check the mapped graph concepts before relying on them.",
    }


class ExplainRequest(PathRequest):
    question: Optional[str] = Field(None, max_length=config.QUESTION_MAX_CHARS)


@app.post("/explain")
def explain_retrieval(request: ExplainRequest):
    """Re-run bounded retrieval, then explain only a bounded subset of those records with the local LLM.

    Retrieval is repeated on the server so the model never sees client-supplied evidence.
    """
    client = _require_llm()
    retrieval, result = _run_retrieval(request)
    if not result["paths"]:
        return {"explanation": None, "message": retrieval["message"], "retrieval_found": False}

    pack = explain_lib.build_pack(
        state["resources"].store, result["paths"], result["truncated_reason"]
    )
    try:
        explanation = explain_lib.explain(
            client, request.question, retrieval["source"]["node"], retrieval["target"]["node"], pack
        )
    except LLMUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LLMBadOutput as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    store = state["resources"].store
    explanation["paths_summarized"] = [
        {"path_id": "P{}".format(rank), "node_ids": [store.node_to_id[n] for n in result["paths"][i]]}
        for rank, i in enumerate(pack["path_indices"], start=1)
    ]
    return {"explanation": explanation, "message": None, "retrieval_found": True}


class SuggestRequest(BaseModel):
    source_id: int
    target_id: int
    max_hops: int = Field(config.PATH_MAX_HOPS_DEFAULT, ge=1, le=config.PATH_MAX_HOPS_LIMIT)


@app.post("/paths/suggest")
def suggest_paths(request: SuggestRequest):
    """When a pair has no path, look for related concept pairs that do (bounded; the user chooses)."""
    store = state["resources"].store
    source, target = _node_name(request.source_id), _node_name(request.target_id)

    def candidates(name: str):
        found = _semantic_search(name, config.SUGGEST_CANDIDATES_PER_SIDE)["results"]
        return [{"node": r["node"], "node_id": r["node_id"], "similarity": r["similarity"]} for r in found]

    result = suggest.suggest_pairs(store, source, target, candidates(source), candidates(target), request.max_hops)
    result["note"] = (
        "These are related concepts, not the same concept. A path between them says nothing about "
        "whether the originally requested pair is related."
    )
    return result
