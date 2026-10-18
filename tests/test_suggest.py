"""Tests for thin-node hints and related-pair suggestions (synthetic data, no model)."""

import unittest

import pandas as pd

from causetrace import suggest
from causetrace.graph import GraphStore
from tests.test_stage2 import row


def make_store():
    rows = [row("P1", "growth", "mid"), row("P2", "mid", "stock prices"),
            row("P3", "growth", "stock price")]             # thin singular node: 1 edge
    rows += [row("Q{}".format(i), "driver{}".format(i), "stock prices") for i in range(12)]
    nodes = sorted({"growth", "mid", "stock prices", "stock price"} | {"driver{}".format(i) for i in range(12)})
    return GraphStore(pd.DataFrame(rows), nodes)


def cand(node, sim, node_id=0):
    return {"node": node, "node_id": node_id, "similarity": sim}


class ConnectivityHintTest(unittest.TestCase):
    def setUp(self):
        self.store = make_store()

    def test_thin_exact_node_gets_a_hint_naming_the_better_connected_neighbor(self):
        hint = suggest.connectivity_hint(
            self.store, "stock price", [cand("stock price", 1.0), cand("stock prices", 0.91)])
        self.assertEqual(hint["selected_total_edges"], 1)
        self.assertEqual([a["node"] for a in hint["alternatives"]], ["stock prices"])
        self.assertIn("not the same concept", hint["message"])

    def test_well_connected_node_gets_no_hint(self):
        self.assertIsNone(suggest.connectivity_hint(
            self.store, "stock prices", [cand("stock prices", 1.0), cand("stock price", 0.91)]))

    def test_dissimilar_neighbors_are_not_suggested(self):
        self.assertIsNone(suggest.connectivity_hint(
            self.store, "stock price", [cand("stock price", 1.0), cand("stock prices", 0.60)]))


class SuggestPairsTest(unittest.TestCase):
    def setUp(self):
        self.store = make_store()
        self.sources = [cand("growth", 1.0)]
        self.targets = [cand("stock price", 1.0), cand("stock prices", 0.91)]

    def test_finds_related_pair_with_paths_when_original_has_none(self):
        self.assertEqual(suggest.suggest_pairs(self.store, "mid", "stock price", [cand("mid", 1.0)],
                                               [cand("stock price", 1.0)], 3)["suggestions"], [])
        out = suggest.suggest_pairs(self.store, "growth", "mid", self.sources, [cand("mid", 1.0), cand("stock prices", 0.9)], 3)
        self.assertEqual([s["target"]["node"] for s in out["suggestions"]], ["stock prices"])

    def test_original_pair_is_not_suggested_and_concepts_are_not_merged(self):
        out = suggest.suggest_pairs(self.store, "growth", "stock price", self.sources, self.targets, 3)
        pairs = [(s["source"]["node"], s["target"]["node"]) for s in out["suggestions"]]
        self.assertEqual(pairs, [("growth", "stock prices")])
        self.assertEqual(out["suggestions"][0]["shortest_hops"], 2)
        first = out["suggestions"][0]
        self.assertTrue(first["source"]["is_original"])      # growth is what was asked for
        self.assertFalse(first["target"]["is_original"])     # stock prices replaces stock price
        self.assertEqual(first["target"]["in_degree"], 13)   # connectivity is passed to the UI

    def test_time_budget_is_reported(self):
        out = suggest.suggest_pairs(self.store, "growth", "stock price", self.sources, self.targets, 3,
                                    total_time_s=-1)
        self.assertTrue(out["incomplete"])


if __name__ == "__main__":
    unittest.main()
