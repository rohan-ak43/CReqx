"""
CReqxRecommender — ties together all six components:

  1. TF-IDF content similarity        (content_model.py)
  2. Item-based KNN                   (collaborative_model.py)
  3. LogisticRegression  \\
  4. RandomForest          } supervised meta-learner (supervised_model.py)
  5. Ensemble blend                   (ensemble.py — averages 3+4, then
                                        blends everything together)
  6. NLP mood matching                (mood_engine.py)

Training (fit) and inference (recommend/similar/mood) are kept as separate
methods on purpose — see train.py for why they run at different times.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from ML import data_pipeline, ensemble, mood_engine, quality_prior
from ML.collaborative_model import CollaborativeModel
from ML.content_model import ContentModel
from ML.supervised_model import FEATURE_NAMES, SupervisedEnsemble, build_training_table

logger = logging.getLogger(__name__)


class CReqxRecommender:
    def __init__(self):
        self.catalog: pd.DataFrame | None = None
        self.ml_to_tmdb: dict[int, int] = {}
        self.tmdb_to_ml: dict[int, int] = {}
        self.content_model = ContentModel()
        self.cf_model = CollaborativeModel()
        self.supervised = SupervisedEnsemble()
        self.quality: pd.Series | None = None

    # ------------------------------------------------------------------ #
    # Training
    # ------------------------------------------------------------------ #
    def fit(self) -> "CReqxRecommender":
        logger.info("Loading dataset and building catalog...")
        self.catalog, self.ml_to_tmdb, self.tmdb_to_ml, ratings = data_pipeline.build_catalog()

        logger.info("Fitting content model (TF-IDF)...")
        self.content_model.fit(self.catalog)

        logger.info("Fitting collaborative model (item-based KNN)...")
        self.cf_model.fit(ratings)

        logger.info("Fitting quality prior...")
        self.quality = quality_prior.fit_quality_prior(self.catalog)

        logger.info("Building supervised training table (this is the slow step)...")
        table = build_training_table(
            self.catalog, ratings, self.ml_to_tmdb,
            self.content_model, self.cf_model, self.quality,
        )
        logger.info("Fitting supervised ensemble (LogisticRegression + RandomForest)...")
        self.supervised.fit(table)

        logger.info("Done.")
        return self

    # ------------------------------------------------------------------ #
    # Inference helpers
    # ------------------------------------------------------------------ #
    def _user_features(self, watched_tmdb_ids: list[int]) -> tuple[pd.Series | None, pd.Series | None, pd.DataFrame]:
        """Returns (content_scores, cf_scores, feature_table) for the whole
        catalog, given a user's watch/favorite history."""
        content_scores = self.content_model.similar_to_movies(watched_tmdb_ids)

        watched_ml_ids = [self.tmdb_to_ml[t] for t in watched_tmdb_ids if t in self.tmdb_to_ml]
        cf_scores = self.cf_model.score_from_history(
            watched_ml_ids, self.ml_to_tmdb, index=list(self.catalog.index)
        )

        genres_by_tmdb = self.catalog["genres"].to_dict()
        user_genres: set[str] = set()
        for t in watched_tmdb_ids:
            user_genres.update(genres_by_tmdb.get(t, []))

        feature_table = pd.DataFrame(index=self.catalog.index)
        feature_table["content_sim"] = content_scores if content_scores is not None else 0.0
        feature_table["cf_score"] = cf_scores if cf_scores is not None else 0.0
        feature_table["quality"] = self.quality
        feature_table["genre_overlap"] = self.catalog["genres"].apply(
            lambda g: len(set(g) & user_genres)
        )
        return content_scores, cf_scores, feature_table

    # ------------------------------------------------------------------ #
    # Public API used by ML/api.py
    # ------------------------------------------------------------------ #
    def recommend_for_user(self, watched_tmdb_ids: list[int], mood: str | None = None,
                            mood_text: str | None = None, top_k: int = 20) -> pd.DataFrame:
        content_scores, cf_scores, feature_table = self._user_features(watched_tmdb_ids)

        supervised_scores = None
        if watched_tmdb_ids:
            X = feature_table[FEATURE_NAMES].values
            supervised_scores = pd.Series(
                self.supervised.predict_proba_batch(X), index=feature_table.index
            )

        mood_scores = mood_engine.mood_score(self.catalog, self.content_model, mood, mood_text)

        final = ensemble.blend({
            "content": content_scores,
            "cf": cf_scores,
            "supervised": supervised_scores,
            "mood": mood_scores,
            "quality": self.quality,
        })

        final = final.drop(index=[t for t in watched_tmdb_ids if t in final.index], errors="ignore")
        return self._format(final.head(top_k))

    def similar_to(self, tmdb_id: int, top_k: int = 12) -> pd.DataFrame:
        scores = self.content_model.similar_to_movies([tmdb_id])
        if scores is None:
            return pd.DataFrame()
        scores = scores.drop(index=tmdb_id, errors="ignore").sort_values(ascending=False)
        return self._format(scores.head(top_k))

    def trending(self, top_k: int = 20) -> pd.DataFrame:
        return self._format(self.quality.sort_values(ascending=False).head(top_k))

    def _format(self, scores: pd.Series) -> pd.DataFrame:
        out = self.catalog.loc[scores.index, ["title", "genres", "vote_average"]].copy()
        out["score"] = scores.values
        return out.reset_index()
