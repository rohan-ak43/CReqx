"""
Content-based signal: TF-IDF over each movie's "soup" text (genres +
keywords + overview), compared with cosine similarity.

This is the one component that needs zero user-interaction data — it works
from movie metadata alone, which is why it's the safest first signal to
ship (see Milestone 2 in the architecture plan).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class ContentModel:
    def __init__(self, max_features: int = 20000):
        self.vectorizer = TfidfVectorizer(max_features=max_features, stop_words="english")
        self.matrix = None          # sparse, rows aligned to catalog order
        self.tmdb_ids: list[int] = []  # row order -> tmdbId

    def fit(self, catalog: pd.DataFrame) -> "ContentModel":
        self.matrix = self.vectorizer.fit_transform(catalog["soup"])
        self.tmdb_ids = list(catalog["tmdbId"])
        return self

    def similar_to_movies(self, tmdb_ids: list[int]) -> pd.Series | None:
        """Average similarity to a set of reference movies (e.g. a watchlist
        or a single movie's detail page 'similar movies' widget)."""
        present = [t for t in tmdb_ids if t in self.tmdb_ids]
        if not present:
            return None
        rows = [self.tmdb_ids.index(t) for t in present]
        profile_vector = np.asarray(self.matrix[rows].mean(axis=0))
        sims = cosine_similarity(profile_vector, self.matrix)[0]
        return pd.Series(sims, index=self.tmdb_ids)

    def similarity_to_text(self, text: str) -> pd.Series:
        """Vectorize arbitrary free text with the *same* fitted vectorizer
        and compare it against every movie. This is the NLP half of mood
        matching — a real vector-space comparison, not keyword counting."""
        query_vector = self.vectorizer.transform([text])
        sims = cosine_similarity(query_vector, self.matrix)[0]
        return pd.Series(sims, index=self.tmdb_ids)
