"""End-to-end training: validation -> Optuna tuning per model (MLflow-tracked) -> held-out test -> champion.

Usage: python -m src.train
"""
import json
import os
import time

import joblib
import mlflow
import numpy as np
import optuna
from sklearn.decomposition import PCA
from sklearn.metrics import (accuracy_score, f1_score, log_loss, precision_score, recall_score,
                             roc_auc_score)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline

from .data import ROOT, dataset, load_config, load_raw, preprocessor, validate
from .models import MODELS, build, space

optuna.logging.set_verbosity(optuna.logging.WARNING)


def pipeline(name, params, num, cat, seed, pca=None):
    steps = [("prep", preprocessor(num, cat))]
    if pca:
        steps.append(("pca", PCA(n_components=pca, random_state=seed)))
    steps.append(("clf", build(name, params, seed)))
    return Pipeline(steps)


def metrics(y, prob, thr=0.5):
    pred = (prob >= thr).astype(int)
    return {"accuracy": accuracy_score(y, pred), "precision": precision_score(y, pred),
            "recall": recall_score(y, pred), "f1": f1_score(y, pred),
            "roc_auc": roc_auc_score(y, prob), "log_loss": log_loss(y, prob)}


def main():
    cfg = load_config()
    seed = cfg["seed"]
    art = os.path.join(ROOT, cfg["paths"]["artifacts"])
    os.makedirs(art, exist_ok=True)

    report = {"validation": validate(load_raw(cfg))}
    X, y, num, cat = dataset(cfg)
    report["dataset"] = {"rows": len(X), "features_raw": len(num) + len(cat), "positive_rate": float(y.mean()),
                         "setup": cfg["data"]["primary_setup"]}
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=cfg["data"]["test_size"], stratify=y, random_state=seed)
    joblib.dump((X_te, y_te), os.path.join(art, "test_split.pkl"))
    cv = StratifiedKFold(cfg["cv"]["folds"], shuffle=True, random_state=seed)

    mlflow.set_tracking_uri("file:" + os.path.join(ROOT, cfg["mlflow"]["tracking_uri"]).replace("\\", "/"))
    mlflow.set_experiment(cfg["mlflow"]["experiment"])

    results, histories = {}, {}
    variants = [(m, None) for m in MODELS] + [("XGBoost", cfg["features"]["pca_components"])]
    for name, pca in variants:
        label = name + ("+PCA" if pca else "")
        with mlflow.start_run(run_name=label):
            def objective(trial):
                params = space(name, trial)
                score = cross_val_score(pipeline(name, params, num, cat, seed, pca), X_tr, y_tr,
                                        cv=cv, scoring="roc_auc", n_jobs=1).mean()
                with mlflow.start_run(run_name=f"{label}-t{trial.number}", nested=True):
                    mlflow.log_params({k: str(v) for k, v in params.items()})
                    mlflow.log_metric("cv_roc_auc", score)
                return score

            study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=seed))
            t0 = time.time()
            study.optimize(objective, n_trials=cfg["optuna"]["n_trials"])
            best = study.best_params
            if name == "LightGBM":
                best["subsample_freq"] = 1
            pipe = pipeline(name, best, num, cat, seed, pca).fit(X_tr, y_tr)
            prob = pipe.predict_proba(X_te)[:, 1]
            m = metrics(y_te, prob)
            results[label] = {"cv_roc_auc": study.best_value, "test": m, "best_params": {k: str(v) for k, v in best.items()},
                              "tuning_seconds": round(time.time() - t0, 1)}
            histories[label] = [t.value for t in study.trials]
            mlflow.log_params({k: str(v) for k, v in best.items()})
            mlflow.log_metrics({"cv_roc_auc": study.best_value, **{f"test_{k}": v for k, v in m.items()}})
            joblib.dump(pipe, os.path.join(art, f"{label}.pkl"))
            print(f"{label:22s} cv_auc={study.best_value:.4f} test_auc={m['roc_auc']:.4f} f1={m['f1']:.4f}")

    champion = max(results, key=lambda k: results[k]["cv_roc_auc"])  # chosen on CV, not on test
    joblib.dump(joblib.load(os.path.join(art, f"{champion}.pkl")), os.path.join(art, "champion.pkl"))
    report.update({"models": results, "champion": champion, "optuna_history": histories,
                   "features": {"numeric": num, "categorical": cat}})
    with open(os.path.join(art, "train_report.json"), "w") as f:
        json.dump(report, f, indent=2, default=float)
    print("champion:", champion)


if __name__ == "__main__":
    main()
