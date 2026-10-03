"""
Central configuration for the CReqx ML backend.

Everything that used to be hardcoded (dataset path, model weights, artifact
location) lives here so it can be overridden with environment variables
instead of editing code.
"""
from __future__ import annotations

import os

# --- Paths -------------------------------------------------------------
# Where the raw Kaggle "Movies Dataset" CSVs live (movies_metadata.csv,
# keywords.csv, links_small.csv, ratings_small.csv). This directory is
# gitignored (see .gitignore: CReqx/Backend/Dataset/) — you provide it
# locally, it's never committed.
DATA_DIR = os.environ.get(
    "CREQX_DATA_DIR",
    os.path.join(os.path.dirname(__file__), "Dataset"),
)

# Where trained model artifacts (pickled recommender) are written/read.
ARTIFACT_DIR = os.environ.get(
    "CREQX_ARTIFACT_DIR",
    os.path.join(os.path.dirname(__file__), "artifacts"),
)

# --- Ensemble blend weights ---------------------------------------------
# Used by ensemble.py to combine signals. Renormalized at request time over
# whichever signals are actually available (e.g. no mood given -> mood's
# weight is redistributed to the rest). Keeping these here (not buried in
# code) makes them the one place to tune the recommender's "personality".
DEFAULT_WEIGHTS = {
    "content": 0.20,   # TF-IDF / cosine similarity to a reference movie or profile
    "cf": 0.20,         # item-based KNN collaborative filtering
    "supervised": 0.30,  # blended LogisticRegression + RandomForest probability
    "mood": 0.20,        # NLP mood-text matching
    "quality": 0.10,     # Bayesian quality prior (always available, floor signal)
}

# --- Supervised model ----------------------------------------------------
# Threshold used to turn a MovieLens 1-5 star rating into a binary "liked"
# label for training LogisticRegression / RandomForest.
LIKE_RATING_THRESHOLD = 4.0

RANDOM_STATE = 42
