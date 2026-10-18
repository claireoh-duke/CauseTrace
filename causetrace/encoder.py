"""CPU-only BGE-M3 query encoder.

On this machine, BGE-M3 on MPS gave inconsistent results between single and batched
inputs, so queries are always encoded on CPU. CPU single-input and batch embeddings
matched the stored vector (cosine 1.0) for the node that was tested.
"""

import logging
from threading import Lock
from typing import Any, Optional, Tuple

import numpy as np

from . import config

logger = logging.getLogger("uvicorn.error")


class CpuQueryEncoder:
    """Loads BGE-M3 lazily, once per process, and encodes one query at a time."""

    def __init__(self) -> None:
        self._model: Optional[Any] = None
        self._lock = Lock()

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def _ensure_model(self) -> Any:
        if self._model is None:
            from FlagEmbedding import BGEM3FlagModel

            logger.info("Loading %s on CPU for query encoding...", config.EMBEDDING_MODEL)
            self._model = BGEM3FlagModel(
                config.EMBEDDING_MODEL, use_fp16=False, devices=["cpu"]
            )
        return self._model

    def encode(self, text: str) -> Tuple[np.ndarray, bool]:
        """Return an L2-normalized float32 vector of shape (1, 1024) and a truncation flag."""
        with self._lock:
            model = self._ensure_model()
            token_count = len(model.tokenizer(text, add_special_tokens=True)["input_ids"])
            output = model.encode_single_device(
                [text],
                device="cpu",
                batch_size=1,
                max_length=config.QUERY_MAX_TOKENS,
                return_dense=True,
                return_sparse=False,
                return_colbert_vecs=False,
            )
            vector = np.array(output["dense_vecs"], dtype="float32", copy=True)

        if (
            vector.shape != (1, config.EMBEDDING_DIM)
            or not np.isfinite(vector).all()
            or np.linalg.norm(vector) == 0
        ):
            raise ValueError("The query encoder returned an invalid vector.")

        vector /= np.linalg.norm(vector)
        return vector, token_count > config.QUERY_MAX_TOKENS
