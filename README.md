# CReqx — ML-Powered Movie Recommendation System

> A movie recommendation system using Machine Learning, NLP, and Flask.

---

## Dataset Info

dataset consists of the following files:

movies_metadata.csv: The main Movies Metadata file. Contains information on 45,000 movies featured in the Full MovieLens dataset. Features include posters, backdrops, budget, revenue, release dates, languages, production countries and companies.

keywords.csv: Contains the movie plot keywords for our MovieLens movies. Available in the form of a stringified JSON Object.

credits.csv: Consists of Cast and Crew Information for all our movies. Available in the form of a stringified JSON Object.

links.csv: The file that contains the TMDB and IMDB IDs of all the movies featured in the Full MovieLens dataset.

links_small.csv: Contains the TMDB and IMDB IDs of a small subset of 9,000 movies of the Full Dataset.

ratings_small.csv: The subset of 100,000 ratings from 700 users on 9,000 movies.


# CReqx ML Backend

A Flask service that trains and serves a hybrid movie recommender for
CReqx, combining six components into one ranked score per movie.

## The six components, and why each one is there

| # | Component | File | What it needs | What it's for |
|---|---|---|---|---|
| 1 | TF-IDF content similarity | `ML/content_model.py` | Movie metadata only | Needs zero user data — the only signal that works day one, and the base for #6 |
| 2 | Item-based KNN (collaborative filtering) | `ML/collaborative_model.py` | Rating matrix | Captures "people who liked A also liked B" patterns content can't see |
| 3–4 | LogisticRegression + RandomForest | `ML/supervised_model.py` | Labeled (user, movie, liked?) rows | Learn how to weight content/CF/quality/genre signals instead of hand-picking weights — see "Why supervised models" below |
| 5 | Ensemble blend | `ML/ensemble.py` | Outputs of 1–4 (+ quality) | Averages 3 & 4, then blends everything, renormalizing over whatever signals are actually available for a given request |
| 6 | NLP mood matching | `ML/mood_engine.py` (uses #1's vectorizer) | Free text or a fixed mood name | Matches "kind of a cozy night" against every movie as an actual vector-space comparison, not keyword counting |

## Why supervised models, specifically

`LogisticRegression` and `RandomForest` are classifiers — they need a
label. CReqx doesn't have one yet: there's no persisted interaction table
in the frontend/backend today (favorites and watch history currently live
in React state only and vanish on refresh). So this backend does **not**
use these models to predict "will this user like this movie" directly from
raw features like a typical tutorial would. Instead they're a **stacking
meta-learner**: given `[content_sim, cf_score, quality, genre_overlap]` for
a (user, movie) pair, they learn a `rating >= 4` probability, trained on
the bootstrap MovieLens ratings (see "Data" below). This replaces the old
hand-tuned blend weights with learned ones — a legitimate hybrid-recommender
technique (stacked/blended ensembles), not models bolted on for appearances.

**When CReqx has its own interaction data** (Milestone 0 → 4 in the
architecture plan — a real `interactions` table instead of in-memory React
state), retrain `supervised_model.py` on that instead of, or blended with,
the bootstrap ratings. The feature functions don't change; only the
training labels do.

## Data

Two different things are both called "data" here — keep them separate:

- **Bootstrap dataset** (Kaggle "Movies Dataset": `movies_metadata.csv`,
  `keywords.csv`, `links_small.csv`, `ratings_small.csv`) — ~9k movies,
  ~100k ratings from ~700 *MovieLens* users. Not CReqx users. It exists to
  give every component something to train on before CReqx has any first-party
  signal. Place these files in `Backend/Dataset/` (gitignored — never
  committed) or point `CREQX_DATA_DIR` at wherever you keep them.
- **First-party CReqx data** — doesn't exist yet. Needs a persisted
  `interactions` table (user, movie, interaction type, timestamp) before
  any of this can personalize for a real CReqx user. That's infrastructure
  work, not ML, and isn't part of this change.

## Training vs. inference

These are deliberately separate, and training is **not** triggered by
incoming requests:

```
python -m ML.train
```

This fits the whole pipeline and writes a timestamped pickle to
`artifacts/` (path configurable via `CREQX_ARTIFACT_DIR`), plus updates
`creqx_model_latest.pkl`. `app.py` / `ML/api.py` load `creqx_model_latest.pkl`
once at process startup and serve from memory — retraining means re-running
the command above and restarting the process (or, later, a scheduled job —
not needed yet at this scale).

## Running locally

```bash
cp .env.example .env     # fill in CREQX_DATA_DIR
pip install -r ../requirements.txt --break-system-packages
python -m ML.train        # writes artifacts/creqx_model_latest.pkl
python app.py              # serves on :5000
```

## Endpoints

- `GET  /api/ml/health` — model load status
- `GET  /api/ml/trending?top_k=20` — quality-prior baseline, no user needed
- `GET  /api/ml/similar/<tmdb_id>?top_k=12` — content-based "similar movies"
- `POST /api/ml/mood` — `{ "mood": "excited" }` or `{ "text": "..." }`, optional `watched_tmdb_ids`
- `POST /api/ml/recommendations` — `{ "watched_tmdb_ids": [...] }`

Every endpoint returns `503` with an explanation if no trained artifact
exists yet, instead of crashing.

## Known simplifications (documented on purpose, not hidden)

- `genre_overlap` (one of the four supervised features) is **not**
  leave-one-out, unlike `content_sim` and `cf_score` — it uses all of a
  user's positively-rated movies' genres, including the row being scored.
  This is a minor leakage risk; it's one of four features feeding a
  blended ensemble, so the impact is small, but it's real and worth fixing
  before trusting evaluation numbers closely (Milestone 6).
- Collaborative filtering and the supervised labels both come from the
  bootstrap MovieLens dataset, not real CReqx users — see "Data" above.

## Tests

```bash
cd Backend
pytest
```

`tests/test_ensemble_and_quality.py` and `tests/test_with_fixture_data.py`
run against small synthetic data and don't need the full dataset.
`ML.train` / the full `CReqxRecommender.fit()` path isn't covered by
automated tests here since it needs the real (large, gitignored) dataset —
run it manually and sanity-check `artifacts/creqx_model_latest.pkl` loads
and `GET /api/ml/trending` returns sensible movies.

```

```

---
