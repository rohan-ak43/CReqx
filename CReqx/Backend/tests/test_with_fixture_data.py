"""
A small synthetic catalog + ratings fixture (6 movies, 4 users) so the
content, collaborative, and mood modules are testable without needing the
full ~100MB Kaggle dataset locally or in CI.
"""
import pandas as pd
import pytest

from ML.collaborative_model import CollaborativeModel
from ML.content_model import ContentModel
from ML import mood_engine


@pytest.fixture
def catalog():
    rows = [
        {"tmdbId": 1, "title": "Space Raiders", "genres": ["Action", "Science Fiction"],
         "keywords": ["spaceship", "chase"], "overview": "a crew races across the galaxy",
         "vote_average": 7.5, "vote_count": 500},
        {"tmdbId": 2, "title": "Galactic War", "genres": ["Action", "Science Fiction"],
         "keywords": ["spaceship", "battle"], "overview": "warships clash near a dying star",
         "vote_average": 7.0, "vote_count": 400},
        {"tmdbId": 3, "title": "Quiet Kitchen", "genres": ["Drama", "Romance"],
         "keywords": ["cooking", "love"], "overview": "two chefs fall slowly in love",
         "vote_average": 8.0, "vote_count": 100},
        {"tmdbId": 4, "title": "Garden of Years", "genres": ["Drama"],
         "keywords": ["family", "loss"], "overview": "a family tends a garden through grief",
         "vote_average": 8.2, "vote_count": 90},
        {"tmdbId": 5, "title": "Laugh Track", "genres": ["Comedy"],
         "keywords": ["friendship", "wedding"], "overview": "a wedding goes hilariously wrong",
         "vote_average": 6.5, "vote_count": 300},
        {"tmdbId": 6, "title": "Scream House", "genres": ["Horror"],
         "keywords": ["monster", "supernatural"], "overview": "something is in the walls",
         "vote_average": 6.8, "vote_count": 250},
    ]
    df = pd.DataFrame(rows)
    df["movieId"] = range(101, 107)  # fake MovieLens ids
    df["soup"] = df.apply(
        lambda r: " ".join(r["genres"] * 3) + " " + " ".join(r["keywords"] * 2) + " " + r["overview"],
        axis=1,
    )
    return df.set_index("tmdbId", drop=False)


@pytest.fixture
def ratings():
    # user 1 & 2 like sci-fi, user 3 likes drama
    return pd.DataFrame([
        {"userId": 1, "movieId": 101, "rating": 5.0},
        {"userId": 1, "movieId": 102, "rating": 4.5},
        {"userId": 2, "movieId": 101, "rating": 4.0},
        {"userId": 2, "movieId": 102, "rating": 4.5},
        {"userId": 3, "movieId": 103, "rating": 5.0},
        {"userId": 3, "movieId": 104, "rating": 4.5},
    ])


def test_content_model_groups_similar_genres(catalog):
    model = ContentModel().fit(catalog)
    sims = model.similar_to_movies([1])  # Space Raiders
    assert sims is not None
    # Galactic War (same genres) should score higher than Quiet Kitchen (unrelated)
    assert sims.loc[2] > sims.loc[3]


def test_content_model_handles_unknown_movie_gracefully(catalog):
    model = ContentModel().fit(catalog)
    assert model.similar_to_movies([999]) is None


def test_mood_free_text_prefers_matching_genre(catalog):
    model = ContentModel().fit(catalog)
    scores = mood_engine.free_text_mood_score(model, "spaceship battle in outer space")
    assert scores.loc[1] > scores.loc[3]
    assert scores.loc[2] > scores.loc[3]


def test_mood_fixed_profile_scares_beats_romance_for_scared_mood(catalog):
    scores = mood_engine.fixed_mood_score(catalog, "scared")
    assert scores.loc[6] > scores.loc[3]  # Scream House > Quiet Kitchen


def test_collaborative_model_finds_genre_aligned_neighbors(catalog, ratings):
    model = CollaborativeModel().fit(ratings)
    neighbors = dict(model.neighbors_of(101))  # Space Raiders (MovieLens id)
    # 102 (Galactic War) was co-rated highly by the same users -> should appear
    assert 102 in neighbors


def test_collaborative_model_cold_start_returns_none(catalog, ratings):
    model = CollaborativeModel().fit(ratings)
    ml_to_tmdb = dict(zip(catalog["movieId"], catalog["tmdbId"]))
    # a user with no ratings coverage at all
    result = model.score_from_history([999], ml_to_tmdb, index=list(catalog.index))
    assert result is None
