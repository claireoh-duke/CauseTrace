"""Stage 1 tests that need neither the FAISS index nor the embedding model.

Run with: .venv/bin/python -m unittest discover -s tests -v
"""

import unittest

import pandas as pd
from fastapi.testclient import TestClient

from api import app
from causetrace import config
from causetrace.labels import normalize_label, normalize_series


class NormalizeLabelTest(unittest.TestCase):
    def test_strips_and_lowercases(self):
        self.assertEqual(normalize_label("  Economic Growth "), "economic growth")

    def test_missing_becomes_empty(self):
        self.assertEqual(normalize_label(None), "")

    def test_series_keeps_missing_as_na(self):
        result = normalize_series(pd.Series([" GDP ", None]))
        self.assertEqual(result.iloc[0], "gdp")
        self.assertTrue(pd.isna(result.iloc[1]))


class SearchBoundsTest(unittest.TestCase):
    """Request validation runs before the handler, so no resources are loaded here."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)  # not used as a context manager: lifespan is skipped

    def test_rejects_missing_query(self):
        self.assertEqual(self.client.get("/nodes/search").status_code, 422)

    def test_rejects_empty_query(self):
        self.assertEqual(self.client.get("/nodes/search", params={"query": ""}).status_code, 422)

    def test_rejects_overlong_query(self):
        query = "a" * (config.QUERY_MAX_CHARS + 1)
        self.assertEqual(self.client.get("/nodes/search", params={"query": query}).status_code, 422)

    def test_rejects_top_k_above_maximum(self):
        params = {"query": "inflation", "top_k": config.SEARCH_TOP_K_MAX + 1}
        self.assertEqual(self.client.get("/nodes/search", params=params).status_code, 422)

    def test_rejects_top_k_below_one(self):
        params = {"query": "inflation", "top_k": 0}
        self.assertEqual(self.client.get("/nodes/search", params=params).status_code, 422)


if __name__ == "__main__":
    unittest.main()
