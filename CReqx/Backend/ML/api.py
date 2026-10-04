"""
Flask blueprint for recommendation endpoints.

The trained model is loaded once at import time (process startup), not per
request — this is the "inference" half of train/inference separation.
If the artifact is missing (you haven't run `python -m ML.train` yet), the
blueprint still registers but every endpoint returns a 503 with a clear
message instead of crashing the whole app.
"""
from __future__ import annotations

import logging
import pickle
from pathlib import Path

from flask import Blueprint, jsonify, request

from config import ARTIFACT_DIR

logger = logging.getLogger(__name__)
ml_bp = Blueprint("ml", __name__)

_model = None
_load_error: str | None = None


def _load_model():
    global _model, _load_error
    latest_path = Path(ARTIFACT_DIR) / "creqx_model_latest.pkl"
    if not latest_path.exists():
        _load_error = (
            f"No trained model found at {latest_path}. "
            f"Run `python -m ML.train` first."
        )
        logger.warning(_load_error)
        return
    try:
        with open(latest_path, "rb") as f:
            _model = pickle.load(f)
        logger.info("Loaded model artifact from %s", latest_path)
    except Exception as exc:  # noqa: BLE001 — want to surface any load failure as a 503, not a crash
        _load_error = f"Failed to load model artifact: {exc}"
        logger.exception(_load_error)


_load_model()


def _require_model():
    if _model is None:
        return jsonify({"error": _load_error or "Model not loaded"}), 503
    return None


@ml_bp.get("/health")
def health():
    return jsonify({"status": "ok" if _model is not None else "model_not_loaded", "error": _load_error})


@ml_bp.get("/trending")
def trending():
    err = _require_model()
    if err:
        return err
    top_k = request.args.get("top_k", default=20, type=int)
    df = _model.trending(top_k=top_k)
    return jsonify(df.to_dict(orient="records"))


@ml_bp.get("/similar/<int:tmdb_id>")
def similar(tmdb_id: int):
    err = _require_model()
    if err:
        return err
    top_k = request.args.get("top_k", default=12, type=int)
    df = _model.similar_to(tmdb_id, top_k=top_k)
    if df.empty:
        return jsonify({"error": f"movie {tmdb_id} not found in catalog"}), 404
    return jsonify(df.to_dict(orient="records"))


@ml_bp.post("/mood")
def mood():
    err = _require_model()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    mood_name = body.get("mood")
    mood_text = body.get("text")
    if not mood_name and not mood_text:
        return jsonify({"error": "provide either 'mood' (a fixed mood name) or 'text' (free text)"}), 400

    top_k = body.get("top_k", 20)
    df = _model.recommend_for_user(
        watched_tmdb_ids=body.get("watched_tmdb_ids", []),
        mood=mood_name, mood_text=mood_text, top_k=top_k,
    )
    return jsonify(df.to_dict(orient="records"))


@ml_bp.post("/recommendations")
def recommendations():
    err = _require_model()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    watched_tmdb_ids = body.get("watched_tmdb_ids", [])
    if not isinstance(watched_tmdb_ids, list):
        return jsonify({"error": "watched_tmdb_ids must be a list of TMDB ids"}), 400

    top_k = body.get("top_k", 20)
    df = _model.recommend_for_user(watched_tmdb_ids=watched_tmdb_ids, top_k=top_k)
    return jsonify(df.to_dict(orient="records"))
