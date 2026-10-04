"""
Data-drift monitoring: compares live prediction inputs (logged by
predict_service.py) against the training distribution using the
Kolmogorov-Smirnov test and the Population Stability Index (PSI).

  python drift_monitor.py          # check the live log
  python drift_monitor.py --demo   # simulate a cohort that disengages over time
"""
import json
import os
import sys

import numpy as np
import pandas as pd
from scipy.stats import ks_2samp

FEATURES = [
    "tasks_completed_pct",
    "doc_edits",
    "messages_sent",
    "commits",
    "deadline_adherence_pct",
    "active_days_last7",
]
LOG_PATH = "predictions_log.jsonl"
MIN_SAMPLES = 10
PSI_THRESHOLD = 0.2
KS_P_THRESHOLD = 0.01


def psi(expected, actual, bins=10):
    edges = np.unique(np.quantile(expected, np.linspace(0, 1, bins + 1)))
    if len(edges) < 3:
        return 0.0
    edges[0], edges[-1] = -np.inf, np.inf
    e = np.histogram(expected, edges)[0] / len(expected)
    a = np.histogram(actual, edges)[0] / len(actual)
    e, a = np.clip(e, 1e-4, None), np.clip(a, 1e-4, None)
    return float(np.sum((a - e) * np.log(a / e)))


def load_live():
    if not os.path.exists(LOG_PATH):
        return pd.DataFrame(columns=FEATURES)
    rows = [json.loads(line) for line in open(LOG_PATH) if line.strip()]
    return pd.DataFrame(rows)[FEATURES] if rows else pd.DataFrame(columns=FEATURES)


def compute_drift(live=None):
    train = pd.read_csv("dataset.csv")[FEATURES]
    live = load_live() if live is None else live
    if len(live) < MIN_SAMPLES:
        return {"status": "insufficient_data", "live_samples": len(live), "min_required": MIN_SAMPLES}

    features = {}
    for f in FEATURES:
        ks = ks_2samp(train[f], live[f])
        score = psi(train[f].values, live[f].values)
        features[f] = {
            "ks_statistic": round(float(ks.statistic), 4),
            "ks_p_value": round(float(ks.pvalue), 6),
            "psi": round(score, 4),
            "drifted": bool(score > PSI_THRESHOLD and ks.pvalue < KS_P_THRESHOLD),
        }
    drifted = [f for f, v in features.items() if v["drifted"]]
    return {
        "status": "drift_detected" if drifted else "stable",
        "live_samples": len(live),
        "drifted_features": drifted,
        "features": features,
        "recommendation": "Collect faculty feedback and run retrain.py" if drifted else "No action needed",
    }


def simulated_disengaging_cohort(n=200, seed=7):
    rng = np.random.default_rng(seed)
    return pd.DataFrame(
        {
            "tasks_completed_pct": np.clip(rng.normal(35, 20, n), 0, 100),
            "doc_edits": rng.gamma(1.5, 3.0, n),
            "messages_sent": rng.gamma(1.5, 2.0, n),
            "commits": rng.gamma(1.2, 1.5, n),
            "deadline_adherence_pct": np.clip(rng.normal(45, 22, n), 0, 100),
            "active_days_last7": np.clip(rng.normal(2.5, 1.8, n), 0, 7),
        }
    )


if __name__ == "__main__":
    live = simulated_disengaging_cohort() if "--demo" in sys.argv else None
    print(json.dumps(compute_drift(live), indent=2))
