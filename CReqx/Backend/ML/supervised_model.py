"""
Supervised meta-learner: instead of hand-picking blend weights, learn them.

Why this exists (and why plain LogisticRegression/RandomForest don't make
sense as *the* recommender): they're classifiers, they need a label. There's
no first-party CReqx label yet (no persisted interactions — see Milestone 0
in the architecture plan), so this trains on the bootstrap MovieLens
ratings, binarized at config.LIKE_RATING_THRESHOLD ("did this user rate the
movie >= 4?"). Once CReqx has its own interaction data, retrain this on
real favorite/watchlist/rating events instead (Milestone 4).

Per (user, movie) training row, the features are:
  - content_sim   : cosine similarity between the movie and the user's
                     content profile, built from their OTHER positively
                     rated movies (leave-one-out, to avoid the trivial leak
                     of "this movie is literally in its own profile")
  - cf_score       : sum of item-KNN similarity between this movie and the
                     user's OTHER positively rated movies (same
                     leave-one-out idea, via a precomputed neighbor map)
  - quality        : the Bayesian quality prior for the movie
  - genre_overlap  : count of genres this movie shares with the user's
                     positively-rated movies (NOT leave-one-out — a
                     documented simplification; it's one signal among
                     several and the risk is small, but it's real, so it's
                     written down here rather than left implicit)

The label is rating >= LIKE_RATING_THRESHOLD.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split

from config import LIKE_RATING_THRESHOLD, RANDOM_STATE
from ML.collaborative_model import CollaborativeModel
from ML.content_model import ContentModel

logger = logging.getLogger(__name__)

FEATURE_NAMES = ["content_sim", "cf_score", "quality", "genre_overlap"]


def _build_neighbor_map(cf_model: CollaborativeModel) -> dict[int, list[tuple[int, float]]]:
    return {ml_id: cf_model.neighbors_of(ml_id) for ml_id in cf_model.ml_ids}


def build_training_table(
    catalog: pd.DataFrame,
    ratings: pd.DataFrame,
    ml_to_tmdb: dict[int, int],
    content_model: ContentModel,
    cf_model: CollaborativeModel,
    quality_prior: pd.Series,
) -> pd.DataFrame:
    """Returns a dataframe with FEATURE_NAMES columns + a 'label' column,
    one row per (userId, movieId) rating in the bootstrap dataset."""
    row_by_tmdb = {t: i for i, t in enumerate(content_model.tmdb_ids)}
    neighbor_map = _build_neighbor_map(cf_model)

    genres_by_tmdb = catalog.set_index("tmdbId")["genres"].to_dict()

    rows = []
    for user_id, group in ratings.groupby("userId"):
        positive = group[group["rating"] >= LIKE_RATING_THRESHOLD]
        positive_ml_ids = set(positive["movieId"])
        positive_tmdb_ids = [ml_to_tmdb[m] for m in positive_ml_ids if m in ml_to_tmdb]

        # user's favorite genres, from all their positively-rated movies
        # (documented simplification: not leave-one-out, see module docstring)
        user_genres: set[str] = set()
        for t in positive_tmdb_ids:
            user_genres.update(genres_by_tmdb.get(t, []))

        for _, r in group.iterrows():
            ml_id, tmdb_id, rating = r["movieId"], ml_to_tmdb.get(r["movieId"]), r["rating"]
            if tmdb_id is None or tmdb_id not in row_by_tmdb:
                continue

            is_positive = rating >= LIKE_RATING_THRESHOLD
            other_positive_tmdb = (
                set(positive_tmdb_ids) - {tmdb_id} if is_positive else set(positive_tmdb_ids)
            )

            # content_sim: cosine to leave-one-out profile centroid
            if other_positive_tmdb:
                idxs = [row_by_tmdb[t] for t in other_positive_tmdb]
                profile_vec = np.asarray(content_model.matrix[idxs].mean(axis=0))
                content_sim = float(cosine_similarity(profile_vec, content_model.matrix[[row_by_tmdb[tmdb_id]]])[0][0])
            else:
                content_sim = 0.0

            # cf_score: sum similarity to the user's other positive movies
            # that happen to be this movie's item-KNN neighbors
            other_positive_ml = (
                positive_ml_ids - {ml_id} if is_positive else positive_ml_ids
            )
            cf_score = sum(
                sim for nid, sim in neighbor_map.get(ml_id, []) if nid in other_positive_ml
            )

            genre_overlap = len(set(genres_by_tmdb.get(tmdb_id, [])) & user_genres)

            rows.append({
                "content_sim": content_sim,
                "cf_score": cf_score,
                "quality": float(quality_prior.get(tmdb_id, 0.0)),
                "genre_overlap": genre_overlap,
                "label": int(is_positive),
            })

    table = pd.DataFrame(rows)
    logger.info("Built supervised training table: %d rows, %.1f%% positive",
                len(table), 100 * table["label"].mean() if len(table) else 0.0)
    return table


class SupervisedEnsemble:
    """Wraps a LogisticRegression + a RandomForest trained on the same
    feature table; scores are averaged into one probability ('ensemble
    methods')."""

    def __init__(self):
        self.logreg = LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)
        self.forest = RandomForestClassifier(
            n_estimators=200, max_depth=8, random_state=RANDOM_STATE, n_jobs=-1
        )
        self._fitted = False

    def fit(self, table: pd.DataFrame) -> "SupervisedEnsemble":
        X = table[FEATURE_NAMES].values
        y = table["label"].values

        # Stratified split needs >=2 examples of the minority class; on the
        # real ~100k-row bootstrap dataset this is never an issue, but it
        # can bite on a tiny dataset (e.g. local experiments), so fall back
        # to an unstratified split, and skip validation entirely below a
        # size where any split would be meaningless.
        min_class_count = pd.Series(y).value_counts().min() if len(y) else 0
        if len(y) < 20 or min_class_count < 2:
            logger.warning(
                "Training table too small (%d rows) for a held-out validation "
                "split — fitting on all rows, skipping accuracy reporting.",
                len(y),
            )
            self.logreg.fit(X, y)
            self.forest.fit(X, y)
            self._fitted = True
            return self

        try:
            X_train, X_val, y_train, y_val = train_test_split(
                X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
            )
        except ValueError:
            X_train, X_val, y_train, y_val = train_test_split(
                X, y, test_size=0.2, random_state=RANDOM_STATE
            )

        self.logreg.fit(X_train, y_train)
        self.forest.fit(X_train, y_train)
        self._fitted = True

        logreg_acc = self.logreg.score(X_val, y_val)
        forest_acc = self.forest.score(X_val, y_val)
        logger.info("LogisticRegression val accuracy: %.3f", logreg_acc)
        logger.info("RandomForest val accuracy: %.3f", forest_acc)
        return self

    def predict_proba(self, features: np.ndarray) -> float:
        """features: 1D array in FEATURE_NAMES order. Returns the averaged
        'liked' probability from both models."""
        if not self._fitted:
            return 0.0
        return float(self.predict_proba_batch(features.reshape(1, -1))[0])

    def predict_proba_batch(self, X: np.ndarray) -> np.ndarray:
        """X: (n, len(FEATURE_NAMES)) array. Batched — used at request time
        so we score the whole catalog in two matrix calls instead of one
        Python-level call per candidate movie."""
        if not self._fitted or len(X) == 0:
            return np.zeros(len(X))
        p_logreg = self.logreg.predict_proba(X)[:, 1]
        p_forest = self.forest.predict_proba(X)[:, 1]
        return (p_logreg + p_forest) / 2
