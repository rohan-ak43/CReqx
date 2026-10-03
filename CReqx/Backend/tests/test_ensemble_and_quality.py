"""
Tests for the components that don't need the full Kaggle dataset to run —
ensemble blending and the quality prior. The dataset-dependent modules
(data_pipeline, content_model, collaborative_model, supervised_model,
recommender) need real CSVs; see tests/test_with_fixture_data.py for a
small synthetic fixture that exercises those instead of requiring the
full ~100MB dataset in CI.
"""
import pandas as pd
import pytest

from ML import ensemble, quality_prior


def test_blend_renormalizes_when_a_signal_is_missing():
    idx = [1, 2, 3]
    signals = {
        "content": pd.Series([0.9, 0.1, 0.5], index=idx),
        "cf": None,  # cold-start user: no CF coverage
        "supervised": None,
        "mood": None,
        "quality": pd.Series([0.2, 0.8, 0.5], index=idx),
    }
    result = ensemble.blend(signals)
    assert set(result.index) == set(idx)
    assert result.is_monotonic_decreasing


def test_blend_raises_if_nothing_is_available():
    with pytest.raises(ValueError):
        ensemble.blend({"content": None, "cf": None, "supervised": None, "mood": None, "quality": None})


def test_quality_prior_rewards_evidence_not_just_raw_average():
    # movie 1: a single perfect vote. movie 2: 5000 votes averaging 8.0.
    # movies 3-5 establish what a "typical" vote count looks like, so the
    # Bayesian prior's m (minimum-votes threshold) isn't degenerate with
    # only two data points.
    catalog = pd.DataFrame({
        "tmdbId": [1, 2, 3, 4, 5],
        "vote_average": [10.0, 8.0, 7.0, 7.5, 6.9],
        "vote_count": [1, 5000, 300, 450, 500],
    }).set_index("tmdbId", drop=False)

    scores = quality_prior.fit_quality_prior(catalog)
    # the well-evidenced 8.0 should beat the single-vote 10.0
    assert scores.loc[2] > scores.loc[1]
