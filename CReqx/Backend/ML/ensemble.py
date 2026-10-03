"""
Combines every signal into one ranked score per movie.

Each signal is already normalized to roughly [0, 1] by the module that
produces it. This module's only job is the weighted blend — and the
renormalization trick: if a signal isn't available for a given request
(e.g. no mood given, or a brand-new user with no CF coverage), its weight
is redistributed proportionally across the remaining signals rather than
silently treating the missing signal as a 0, which would unfairly punish
every movie equally.
"""
from __future__ import annotations

import pandas as pd

from config import DEFAULT_WEIGHTS


def blend(signals: dict[str, pd.Series | None], weights: dict[str, float] | None = None) -> pd.Series:
    """signals: {"content": Series|None, "cf": Series|None, "supervised": Series|None,
    "mood": Series|None, "quality": Series} — quality should always be present
    (it's the floor signal with no cold-start case)."""
    weights = weights or DEFAULT_WEIGHTS
    available = {name: s for name, s in signals.items() if s is not None}
    if not available:
        raise ValueError("No signals available to blend — quality prior should always be present")

    total_weight = sum(weights.get(name, 0.0) for name in available)
    if total_weight == 0:
        # fall back to equal weighting across whatever's available
        total_weight = len(available)
        normalized = {name: 1.0 / total_weight for name in available}
    else:
        normalized = {name: weights.get(name, 0.0) / total_weight for name in available}

    index = next(iter(available.values())).index
    score = pd.Series(0.0, index=index)
    for name, series in available.items():
        score = score.add(series.reindex(index, fill_value=0.0) * normalized[name], fill_value=0.0)

    return score.sort_values(ascending=False)
