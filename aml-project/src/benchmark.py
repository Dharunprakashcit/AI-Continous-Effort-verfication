"""Comparison against the baseline paper (Cortez & Silva, 2008).

Reproduces the paper's protocol: per course (mat / por), per setup (A / B / C),
repeated stratified 10-fold CV accuracy for pass/fail. Our tuned champion
architecture is compared with the best model reported in the paper.

Usage: python -m src.benchmark
"""
import json
import os

import numpy as np
from sklearn.model_selection import RepeatedStratifiedKFold, cross_val_score
from scipy import stats

from .data import ROOT, dataset, load_config
from .train import pipeline


def main():
    cfg = load_config()
    seed = cfg["seed"]
    art = os.path.join(ROOT, cfg["paths"]["artifacts"])
    with open(os.path.join(art, "train_report.json")) as f:
        rep = json.load(f)
    with open(os.path.join(ROOT, "benchmark_baseline.json")) as f:
        base = json.load(f)

    champ = rep["champion"].replace("+PCA", "")
    params = {}
    for k, v in rep["models"][rep["champion"]]["best_params"].items():
        try:
            params[k] = json.loads(v)
        except ValueError:
            try:
                params[k] = eval(v, {})          # tuples such as (64, 32)
            except Exception:
                params[k] = v
    contenders = {champ: params, "LogisticRegression": {}}

    cv = RepeatedStratifiedKFold(n_splits=cfg["benchmark"]["folds"], n_repeats=cfg["benchmark"]["repeats"], random_state=seed)
    rows = []
    for course in ["mat", "por"]:
        for setup in ["A", "B", "C"]:
            X, y, num, cat = dataset(cfg, setup=setup, course=course)
            paper = base["results"][course][setup]
            row = {"course": course, "setup": setup, "n": len(X),
                   "paper_model": paper["model"], "paper_acc": paper["acc"]}
            for name, p in contenders.items():
                s = cross_val_score(pipeline(name, p, num, cat, seed), X, y, cv=cv, scoring="accuracy", n_jobs=-1) * 100
                row[name] = {"mean": round(s.mean(), 2), "std": round(s.std(), 2)}
                if name == champ:
                    # one-sample t-test of our fold accuracies against the paper's reported mean
                    row["t_test_p"] = float(stats.ttest_1samp(s, paper["acc"]).pvalue)
                    row["delta"] = round(s.mean() - paper["acc"], 2)
            rows.append(row)
            print(course, setup, "paper", paper["acc"], "ours", row[champ]["mean"], "+-", row[champ]["std"])

    out = {"baseline": base["paper"], "protocol": f"{cfg['benchmark']['repeats']}x{cfg['benchmark']['folds']}-fold stratified CV",
           "champion": champ, "rows": rows}
    with open(os.path.join(art, "benchmark_report.json"), "w") as f:
        json.dump(out, f, indent=2)


if __name__ == "__main__":
    main()
