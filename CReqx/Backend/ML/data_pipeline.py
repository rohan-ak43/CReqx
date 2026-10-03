"""
Loads and cleans the raw dataset into a single "catalog" dataframe that every
other ML module builds on.

This is the same shape as the original CReqx data_pipeline.py, with one fix:
the dataset directory is no longer hardcoded to a sandbox path, it comes from
config.DATA_DIR (overridable via the CREQX_DATA_DIR env var).
"""
from __future__ import annotations

import ast
import logging
import re

import pandas as pd

from config import DATA_DIR

logger = logging.getLogger(__name__)


def _safe_literal_list(raw, key: str = "name") -> list[str]:
    """Parse TMDB's stringified list-of-dicts columns (genres, keywords)."""
    if not isinstance(raw, str) or not raw.strip():
        return []
    try:
        items = ast.literal_eval(raw)
        return [d[key] for d in items if isinstance(d, dict) and key in d]
    except (ValueError, SyntaxError):
        return []


def _clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_movies_metadata() -> pd.DataFrame:
    md = pd.read_csv(f"{DATA_DIR}/movies_metadata.csv", low_memory=False)

    # A handful of rows in the source CSV are corrupted (a shifted-column bug
    # puts a date string where the numeric TMDB id should be) — drop those.
    before = len(md)
    md = md[md["id"].astype(str).str.isnumeric()].copy()
    dropped = before - len(md)
    if dropped:
        logger.warning("Dropped %d rows with a corrupted id column", dropped)

    md["id"] = md["id"].astype(int)
    md = md.drop_duplicates(subset="id")

    md["vote_average"] = pd.to_numeric(md["vote_average"], errors="coerce").fillna(0)
    md["vote_count"] = pd.to_numeric(md["vote_count"], errors="coerce").fillna(0)
    md["popularity"] = pd.to_numeric(md["popularity"], errors="coerce").fillna(0)
    md["overview"] = md["overview"].fillna("")
    md["genres"] = md["genres"].apply(_safe_literal_list)

    return md[[
        "id", "title", "genres", "overview",
        "vote_average", "vote_count", "popularity", "release_date",
    ]].rename(columns={"id": "tmdbId"})


def load_keywords() -> pd.DataFrame:
    kw = pd.read_csv(f"{DATA_DIR}/keywords.csv")
    kw = kw.drop_duplicates(subset="id")
    kw["keywords"] = kw["keywords"].apply(_safe_literal_list)
    return kw.rename(columns={"id": "tmdbId"})[["tmdbId", "keywords"]]


def load_links_small() -> pd.DataFrame:
    links = pd.read_csv(f"{DATA_DIR}/links_small.csv")
    links = links.dropna(subset=["tmdbId"])
    links["tmdbId"] = links["tmdbId"].astype(int)
    return links[["movieId", "tmdbId"]]


def load_ratings_small(valid_movie_ids: set[int]) -> pd.DataFrame:
    ratings = pd.read_csv(f"{DATA_DIR}/ratings_small.csv")
    ratings = ratings[ratings["movieId"].isin(valid_movie_ids)]
    return ratings[["userId", "movieId", "rating"]]


def build_catalog():
    """Returns (catalog_df, ml_to_tmdb, tmdb_to_ml, ratings_df).

    catalog_df is indexed by tmdbId and carries a "soup" text column used by
    the content model, alongside genres/keywords lists used by the mood
    engine and vote_average/vote_count used by the quality prior.
    """
    md = load_movies_metadata()
    kw = load_keywords()
    links = load_links_small()

    # Restrict the content catalog to movies with MovieLens ratings coverage
    # so content features and the collaborative signal stay aligned on the
    # same movie set.
    catalog = links.merge(md, on="tmdbId", how="inner")
    catalog = catalog.merge(kw, on="tmdbId", how="left")
    catalog["keywords"] = catalog["keywords"].apply(lambda x: x if isinstance(x, list) else [])
    catalog = catalog.drop_duplicates(subset="tmdbId").reset_index(drop=True)

    def make_soup(row):
        # genres/keywords repeated so they outweigh the noisier free-text
        # overview in the TF-IDF vector — cleaner signal for both content
        # similarity and mood matching.
        genre_txt = " ".join(row["genres"]) * 3
        kw_txt = " ".join(row["keywords"]) * 2
        overview_txt = _clean_text(row["overview"])
        return _clean_text(f"{genre_txt} {kw_txt} {overview_txt}")

    catalog["soup"] = catalog.apply(make_soup, axis=1)
    catalog = catalog.set_index("tmdbId", drop=False)

    ml_to_tmdb = dict(zip(catalog["movieId"], catalog["tmdbId"]))
    tmdb_to_ml = dict(zip(catalog["tmdbId"], catalog["movieId"]))

    ratings = load_ratings_small(valid_movie_ids=set(ml_to_tmdb.keys()))
    logger.info(
        "Catalog built: %d movies, %d ratings from %d users",
        len(catalog), len(ratings), ratings["userId"].nunique(),
    )

    return catalog, ml_to_tmdb, tmdb_to_ml, ratings


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    catalog, ml_to_tmdb, tmdb_to_ml, ratings = build_catalog()
    print(f"Catalog: {len(catalog)} movies")
    print(f"Ratings: {len(ratings)} rows, {ratings['userId'].nunique()} users")
    print(catalog[["title", "genres", "vote_average"]].head())
