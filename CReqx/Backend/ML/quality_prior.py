"""
Quality prior: Bayesian average of vote_average/vote_count (the classic
"weighted rating" formula, same idea IMDb's Top 250 uses).

Why not just sort by vote_average? A movie with one 10/10 vote would beat
a movie with 10,000 ratings averaging 8.5/10 — the Bayesian average pulls
low-evidence scores toward the overall mean until they've earned enough
votes to be trusted.
"""
from __future__ import annotations

import pandas as pd


def fit_quality_prior(catalog: pd.DataFrame, vote_count_quantile: float = 0.60) -> pd.Series:
    m = catalog["vote_count"].quantile(vote_count_quantile)  # min-votes threshold
    v_mean = catalog["vote_average"].mean()

    def bayesian_avg(row):
        v, r = row["vote_count"], row["vote_average"]
        return (v / (v + m)) * r + (m / (v + m)) * v_mean

    raw = catalog.apply(bayesian_avg, axis=1)
    span = raw.max() - raw.min()
    return (raw - raw.min()) / span if span > 0 else raw
