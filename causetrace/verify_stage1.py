"""Check a running CauseTrace backend against the stored index (HTTP only).

For random nodes, querying with the node's own text should return that node first
with similarity close to 1.0. This samples the index; it does not validate every vector.

    .venv/bin/python -m causetrace.verify_stage1 --base-url http://127.0.0.1:8000 --samples 25
"""

import argparse
import json
import random
import sys

import requests

from . import config

NAMED_QUERIES = ["economic growth", "inflation", "stock prices"]


def search(base_url, query, top_k=5):
    response = requests.get(
        base_url + "/nodes/search", params={"query": query, "top_k": top_k}, timeout=300
    )
    response.raise_for_status()
    return response.json()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--samples", type=int, default=25)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    health = requests.get(args.base_url + "/health", timeout=30).json()
    print("Health:", json.dumps(health["counts"], indent=2))

    with config.NODES_PATH.open("r", encoding="utf-8") as file:
        nodes = json.load(file)
    sample = random.Random(args.seed).sample(nodes, args.samples)

    failures = 0
    print("\nNamed queries (top 3 each):")
    for query in NAMED_QUERIES:
        body = search(args.base_url, query, top_k=3)
        shown = ", ".join("{} ({:.3f})".format(r["node"], r["similarity"]) for r in body["results"])
        print("  {!r}: exact={} -> {}".format(query, body["exact_match"] is not None, shown))

    print("\nSelf-retrieval of {} random nodes (seed {}):".format(args.samples, args.seed))
    for node in sample:
        body = search(args.base_url, node, top_k=1)
        top = body["results"][0]
        ok = top["node"] == node and top["similarity"] > 0.999
        if not ok:
            failures += 1
        print("  [{}] sim={:.4f} truncated={} {!r}{}".format(
            "ok" if ok else "MISMATCH", top["similarity"], body["query_truncated"], node[:70],
            "" if ok else " -> got {!r}".format(top["node"][:70]),
        ))

    print("\n{} of {} sampled nodes did not retrieve themselves at rank 1.".format(
        failures, args.samples))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
