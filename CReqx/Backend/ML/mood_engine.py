"""
Mood signal, in two parts:

1. Fixed mood picker (e.g. "excited") -> hand-authored genre/keyword weights.
   This part is a lookup table, not ML — it's deliberately simple because
   there are only ~9 moods and they rarely change.

2. Free-text mood ("kind of a cozy night") -> NLP: the text is vectorized
   with the *same* TF-IDF vectorizer already fit on the movie catalog
   (via ContentModel.similarity_to_text), then compared to every movie by
   cosine similarity. That's the actual "NLP-based mood-matching layer" —
   a vector-space comparison, not a keyword lexicon.
"""
from __future__ import annotations

import pandas as pd

from ML.content_model import ContentModel

MOOD_PROFILES: dict[str, dict[str, float]] = {
    "happy": {
        "Comedy": 1.0, "Family": 0.8, "Animation": 0.7, "Music": 0.5,
        "feel good": 0.6, "friendship": 0.4,
    },
    "sad": {
        "Drama": 1.0, "Romance": 0.4,
        "loss": 0.5, "tearjerker": 0.6, "grief": 0.5,
    },
    "excited": {
        "Action": 1.0, "Adventure": 0.8, "Science Fiction": 0.5,
        "chase": 0.5, "superhero": 0.4,
    },
    "relaxed": {
        "Documentary": 0.7, "Romance": 0.6, "Comedy": 0.4,
        "slow burn": 0.3, "nature": 0.4,
    },
    "scared": {
        "Horror": 1.0, "Thriller": 0.7, "Mystery": 0.5,
        "supernatural": 0.5, "monster": 0.4,
    },
    "romantic": {
        "Romance": 1.0, "Drama": 0.4, "Comedy": 0.3,
        "wedding": 0.4, "love": 0.5,
    },
    "thoughtful": {
        "Drama": 0.7, "Mystery": 0.6, "Science Fiction": 0.6, "History": 0.5,
        "philosophy": 0.5, "identity": 0.4,
    },
    "nostalgic": {
        "Family": 0.6, "Animation": 0.6, "Adventure": 0.5,
        "childhood": 0.6, "1980s": 0.3,
    },
    "tense": {
        "Thriller": 1.0, "Crime": 0.7, "Mystery": 0.6,
        "conspiracy": 0.4, "heist": 0.4,
    },
}


def fixed_mood_score(catalog: pd.DataFrame, mood: str) -> pd.Series:
    """Score every movie against a fixed mood's genre/keyword profile."""
    weights = MOOD_PROFILES.get(mood, {})
    if not weights:
        return pd.Series(0.0, index=catalog.index)

    def score_row(row):
        tags = set(row["genres"]) | set(row["keywords"])
        return sum(w for tag, w in weights.items() if tag in tags)

    raw = catalog.apply(score_row, axis=1)
    max_val = raw.max()
    return raw / max_val if max_val > 0 else raw


def free_text_mood_score(content_model: ContentModel, mood_text: str) -> pd.Series:
    """NLP path: vectorize free text against the fitted catalog vector space."""
    sims = content_model.similarity_to_text(mood_text)
    max_val = sims.max()
    return sims / max_val if max_val > 0 else sims


def mood_score(catalog: pd.DataFrame, content_model: ContentModel,
                mood: str | None = None, mood_text: str | None = None) -> pd.Series | None:
    if mood and mood in MOOD_PROFILES:
        return fixed_mood_score(catalog, mood)
    if mood_text:
        return free_text_mood_score(content_model, mood_text)
    return None
