"""
Offline training entrypoint.

Run manually during development:

    python -m ML.train

Training is deliberately NOT triggered by incoming API requests — see
README.md "Training vs inference" for why. This script fits the whole
CReqxRecommender and writes a timestamped pickle artifact. api.py loads the
most recent artifact once, at process startup, and serves from memory.
"""
from __future__ import annotations

import logging
import pickle
from datetime import datetime, timezone
from pathlib import Path

from config import ARTIFACT_DIR
from ML.recommender import CReqxRecommender


def train_and_save() -> Path:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    model = CReqxRecommender().fit()

    Path(ARTIFACT_DIR).mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    versioned_path = Path(ARTIFACT_DIR) / f"creqx_model_{timestamp}.pkl"
    latest_path = Path(ARTIFACT_DIR) / "creqx_model_latest.pkl"

    with open(versioned_path, "wb") as f:
        pickle.dump(model, f)
    with open(latest_path, "wb") as f:
        pickle.dump(model, f)

    logging.info("Saved model artifact: %s (and updated creqx_model_latest.pkl)", versioned_path)
    return versioned_path


if __name__ == "__main__":
    train_and_save()
