"""Stage 2 tests on a small synthetic claims table (no index or model is loaded).

Run with: .venv/bin/python -m unittest discover -s tests -v
"""

import unittest

import pandas as pd

from causetrace import evidence
from causetrace.graph import GraphStore
from causetrace.paths import find_paths, group_by_first_intermediate


def row(paper, cause, effect, flag=0.0, method="theoretical/non-empirical", title="t", year=2000.0):
    return {
        "paper_id": paper, "title": title, "year": year, "edge_overlap": 1,
        "cause": cause, "effect": effect, "sources_of_exogenous_variation": None,
        "jel_cause": "E00", "jel_effect": "E00",
        "is_method_causal_inference": flag, "causal_inference_method": method,
    }


ROWS = [
    # Duplicate displayed record from one paper, plus a causal-tagged record from another.
    row("P1", " A ", "b", title="same title"),
    row("P1", "a", "B", title="same title"),
    row("P2", "a", "b", flag=1.0, method="did", title="other title"),
    row("P3", "b", "c"),
    row("P1", "a", "c"),
    row("P4", "c", "a"),               # reverse direction only
    row("P5", "c", "d"), row("P5", "d", "e"),
    row("P6", "a", "x1"), row("P6", "x1", "t"),
    row("P6", "a", "x2"), row("P6", "x2", "t"),
    row("P6", "a", "x3"), row("P6", "x3", "t"),
    row("P7", "f", "g"),
    row("P8", "b", "b", method="other"),  # self loop
]
NODES = sorted({"a", "b", "c", "d", "e", "x1", "x2", "x3", "t", "f", "g"})


def make_store():
    return GraphStore(pd.DataFrame(ROWS), NODES)


class PathDirectionTest(unittest.TestCase):
    def setUp(self):
        self.store = make_store()

    def test_follows_edge_direction(self):
        self.assertTrue(self.store.has_edge("a", "b"))
        self.assertFalse(self.store.has_edge("b", "a"))
        paths = find_paths(self.store, "a", "c", max_hops=3)["paths"]
        self.assertIn(["a", "c"], paths)
        self.assertIn(["a", "b", "c"], paths)
        for path in paths:
            for src, dst in zip(path, path[1:]):
                self.assertTrue(self.store.has_edge(src, dst))

    def test_reverse_query_uses_reverse_edges_only(self):
        paths = find_paths(self.store, "c", "a", max_hops=3)["paths"]
        self.assertEqual(paths, [["c", "a"]])

    def test_shortest_first_no_repeated_nodes_no_duplicates(self):
        paths = find_paths(self.store, "a", "c", max_hops=4)["paths"]
        self.assertEqual([len(p) for p in paths], sorted(len(p) for p in paths))
        self.assertEqual(len(paths), len({tuple(p) for p in paths}))
        for path in paths:
            self.assertEqual(len(path), len(set(path)))

    def test_distinct_concepts_stay_distinct_in_channels(self):
        result = find_paths(self.store, "a", "t", max_hops=2)
        vias = {g["via"] for g in group_by_first_intermediate(result["paths"])}
        self.assertEqual(vias, {"x1", "x2", "x3"})


class SearchBoundsTest(unittest.TestCase):
    def setUp(self):
        self.store = make_store()

    def test_max_hops_is_respected(self):
        result = find_paths(self.store, "c", "e", max_hops=1)
        self.assertEqual(result["paths"], [])
        self.assertEqual(find_paths(self.store, "c", "e", max_hops=2)["paths"], [["c", "d", "e"]])

    def test_max_paths_truncates_and_reports(self):
        result = find_paths(self.store, "a", "t", max_hops=2, max_paths=2)
        self.assertEqual(len(result["paths"]), 2)
        self.assertTrue(result["truncated"])
        self.assertEqual(result["truncated_reason"], "max_paths")

    def test_exact_fit_is_not_reported_as_truncated(self):
        result = find_paths(self.store, "a", "t", max_hops=2, max_paths=3)
        self.assertEqual(len(result["paths"]), 3)
        self.assertFalse(result["truncated"])

    def test_time_limit_is_reported(self):
        result = find_paths(self.store, "a", "t", max_hops=2, time_limit_s=-1)
        self.assertTrue(result["truncated"])
        self.assertEqual(result["truncated_reason"], "time_limit")


class MissingResultTest(unittest.TestCase):
    def test_unreachable_pair_returns_empty_not_error(self):
        result = find_paths(make_store(), "a", "g", max_hops=4)
        self.assertEqual(result["paths"], [])
        self.assertFalse(result["truncated"])
        self.assertEqual(result["limits"]["max_hops"], 4)


class EvidenceMappingTest(unittest.TestCase):
    def setUp(self):
        self.store = make_store()

    def test_all_rows_preserved_and_labels_normalized(self):
        summary = evidence.edge_summary(self.store, "a", "b")
        self.assertEqual(summary["claim_rows"], 3)

    def test_duplicate_rows_do_not_inflate_paper_count(self):
        summary = evidence.edge_summary(self.store, "a", "b")
        self.assertEqual(summary["unique_papers"], 2)  # P1 (twice) and P2

    def test_identical_records_merged_but_row_ids_kept(self):
        detail = evidence.edge_evidence(self.store, "a", "b")
        self.assertEqual(detail["evidence_records_total"], 2)
        merged = [r for r in detail["evidence"] if r["paper_id"] == "P1"][0]
        self.assertEqual(merged["row_count"], 2)
        self.assertEqual(len(merged["row_ids"]), 2)
        self.assertEqual(sum(r["row_count"] for r in detail["evidence"]), 3)

    def test_evidence_does_not_leak_across_edges_or_directions(self):
        self.assertEqual(evidence.edge_summary(self.store, "b", "c")["claim_rows"], 1)
        self.assertEqual(evidence.edge_rows(self.store, "b", "a").shape[0], 0)
        self.assertEqual(evidence.edge_summary(self.store, "c", "a")["claim_rows"], 1)

    def test_evidence_classes_are_kept_distinct(self):
        classes = evidence.edge_summary(self.store, "a", "b")["evidence_class_rows"]
        self.assertEqual(classes, {"theoretical": 2, "causal_method_tagged": 1})
        self.assertEqual(evidence.classify_evidence(0.0, "other"), "unspecified_method")
        self.assertEqual(evidence.classify_evidence(0.0, None), "unspecified_method")
        self.assertEqual(evidence.classify_evidence(0.0, "simulation"), "other_method_not_causal_tagged")

    def test_missing_paper_ids_are_not_counted_as_papers(self):
        rows = [row(None, "a", "b"), row(None, "a", "b"), row("P1", "a", "b")]
        store = GraphStore(pd.DataFrame(rows), ["a", "b"])
        summary = evidence.edge_summary(store, "a", "b")
        self.assertEqual(
            (summary["claim_rows"], summary["unique_papers"], summary["rows_without_paper_id"]), (3, 1, 2)
        )

    def test_cross_paper_join_is_flagged(self):
        overlap = evidence.path_paper_overlap(self.store, ["a", "b", "c"])
        self.assertTrue(overlap["joins_findings_across_papers"])
        same = evidence.path_paper_overlap(self.store, ["a", "x1", "t"])
        self.assertEqual(same["papers_on_every_edge"], ["P6"])
        self.assertFalse(same["joins_findings_across_papers"])

    def test_edge_evidence_limit_reports_truncation(self):
        detail = evidence.edge_evidence(self.store, "a", "b", limit=1)
        self.assertTrue(detail["truncated"])
        self.assertEqual(detail["evidence_records_returned"], 1)


if __name__ == "__main__":
    unittest.main()
