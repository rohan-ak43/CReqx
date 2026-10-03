"""
Collaborative filtering signal: item-based KNN over a user x movie rating
matrix.

Trained on the bootstrap MovieLens ratings for now (see README — this is a
foreign dataset standing in for real CReqx interactions until Milestone 4,
when it should be retrained on/blended with CReqx's own interaction table).
"""
from __future__ import annotations

import pandas as pd
import scipy.sparse as sp
from sklearn.neighbors import NearestNeighbors


class CollaborativeModel:
    def __init__(self):
        self.knn: NearestNeighbors | None = None
        self.movie_vectors = None       # sparse, rows = movies, cols = users
        self.ml_ids: list[int] = []     # row order -> MovieLens movieId
        self._n_neighbors = 0

    def fit(self, ratings: pd.DataFrame) -> "CollaborativeModel":
        pivot = ratings.pivot_table(index="movieId", columns="userId", values="rating")
        pivot = pivot.fillna(0)
        self.ml_ids = list(pivot.index)
        self.movie_vectors = sp.csr_matrix(pivot.values)

        self._n_neighbors = min(21, len(self.ml_ids))  # self + up to 20 neighbors
        self.knn = NearestNeighbors(metric="cosine", algorithm="brute")
        self.knn.fit(self.movie_vectors)
        return self

    def neighbors_of(self, ml_id: int) -> list[tuple[int, float]]:
        """Returns [(neighbor_ml_id, similarity), ...] excluding ml_id itself.
        Empty list if ml_id has no ratings coverage."""
        if ml_id not in self.ml_ids:
            return []
        idx = self.ml_ids.index(ml_id)
        distances, neighbor_idx = self.knn.kneighbors(
            self.movie_vectors[idx], n_neighbors=self._n_neighbors
        )
        out = []
        for dist, n_idx in zip(distances[0], neighbor_idx[0]):
            neighbor_ml_id = self.ml_ids[n_idx]
            if neighbor_ml_id == ml_id:
                continue
            out.append((neighbor_ml_id, max(1 - dist, 0.0)))
        return out

    def score_from_history(self, watched_ml_ids: list[int], ml_to_tmdb: dict[int, int],
                             index: list[int]) -> pd.Series | None:
        """For each watched movie, accumulate neighbor similarity into a
        score per tmdbId. Returns None if none of the watched movies have CF
        coverage (this is the CF cold-start case)."""
        watched = [m for m in watched_ml_ids if m in self.ml_ids]
        if not watched:
            return None

        scores = pd.Series(0.0, index=index)
        for ml_id in watched:
            for neighbor_ml_id, similarity in self.neighbors_of(ml_id):
                tmdb_id = ml_to_tmdb.get(neighbor_ml_id)
                if tmdb_id is None or tmdb_id not in scores.index:
                    continue
                scores.loc[tmdb_id] += similarity

        max_val = scores.max()
        return scores / max_val if max_val > 0 else scores
