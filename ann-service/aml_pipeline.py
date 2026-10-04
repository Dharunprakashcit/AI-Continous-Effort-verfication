"""
Applied Machine Learning workflow around the ANN:
  1. data validation   2. model comparison with stratified CV
  3. hyperparameter tuning   4. held-out evaluation (same split as the ANN)
  5. champion selection   6. versioned model registry

Run after train_model.py:  python aml_pipeline.py
Outputs: aml_report.json, aml_comparison.png, models/*.pkl, models/registry.json
"""
import datetime
import hashlib
import json
import os

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_validate, train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "tasks_completed_pct",
    "doc_edits",
    "messages_sent",
    "commits",
    "deadline_adherence_pct",
    "active_days_last7",
]
RANGES = {
    "tasks_completed_pct": (0, 100),
    "deadline_adherence_pct": (0, 100),
    "active_days_last7": (0, 7),
    "doc_edits": (0, None),
    "messages_sent": (0, None),
    "commits": (0, None),
}
MODELS_DIR = "models"


def validate_data(df):
    report = {"rows": len(df), "issues": []}
    missing = df[FEATURES + ["risk_label"]].isna().sum()
    if missing.any():
        report["issues"].append(f"missing values: {missing[missing > 0].to_dict()}")
    for col, (lo, hi) in RANGES.items():
        if (df[col] < lo).any() or (hi is not None and (df[col] > hi).any()):
            report["issues"].append(f"{col} outside [{lo}, {hi}]")
    balance = df["risk_label"].mean()
    report["positive_rate"] = round(float(balance), 3)
    if balance < 0.2 or balance > 0.8:
        report["issues"].append(f"class imbalance: positive rate {balance:.2f}")
    report["passed"] = not report["issues"]
    return report


def candidate_models():
    def make(clf):
        return Pipeline([("scale", StandardScaler()), ("clf", clf)])

    return {
        "LogisticRegression": make(LogisticRegression(max_iter=1000)),
        "RandomForest": make(RandomForestClassifier(random_state=42)),
        "GradientBoosting": make(GradientBoostingClassifier(random_state=42)),
        "MLP (sklearn)": make(MLPClassifier(hidden_layer_sizes=(16, 8), max_iter=500, random_state=42)),
    }


def tuning_grids():
    return {
        "RandomForest": {"clf__n_estimators": [100, 200], "clf__max_depth": [4, 8, None]},
        "GradientBoosting": {"clf__n_estimators": [100, 200], "clf__learning_rate": [0.05, 0.1]},
    }


def test_metrics(y_true, y_prob):
    y_pred = (y_prob > 0.5).astype(int)
    return {
        "accuracy": round(accuracy_score(y_true, y_pred), 4),
        "precision": round(precision_score(y_true, y_pred), 4),
        "recall": round(recall_score(y_true, y_pred), 4),
        "f1": round(f1_score(y_true, y_pred), 4),
        "roc_auc": round(roc_auc_score(y_true, y_prob), 4),
    }


def evaluate_keras_ann(X_test, y_test):
    if not (os.path.exists("model.h5") and os.path.exists("scaler.pkl")):
        return None, None
    from tensorflow import keras

    ann = keras.models.load_model("model.h5", compile=False)
    scaler = joblib.load("scaler.pkl")
    prob = ann.predict(scaler.transform(X_test), verbose=0).ravel()
    return test_metrics(y_test, prob), prob


def main():
    df = pd.read_csv("dataset.csv")
    data_report = validate_data(df)
    print("Data validation:", json.dumps(data_report))
    if not data_report["passed"]:
        raise SystemExit("Data validation failed; fix the dataset before training.")

    X, y = df[FEATURES].values, df["risk_label"].values
    # Same split parameters as train_model.py, so the ANN is scored on identical rows.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    results, probs = {}, {}

    for name, pipe in candidate_models().items():
        grid = tuning_grids().get(name)
        if grid:
            search = GridSearchCV(pipe, grid, cv=cv, scoring="f1", n_jobs=-1)
            search.fit(X_train, y_train)
            pipe, best_params = search.best_estimator_, search.best_params_
        else:
            pipe.fit(X_train, y_train)
            best_params = {}

        cv_scores = cross_validate(pipe, X_train, y_train, cv=cv, scoring=["f1", "roc_auc"])
        prob = pipe.predict_proba(X_test)[:, 1]
        probs[name] = prob
        results[name] = {
            "cv_f1_mean": round(cv_scores["test_f1"].mean(), 4),
            "cv_f1_std": round(cv_scores["test_f1"].std(), 4),
            "cv_roc_auc_mean": round(cv_scores["test_roc_auc"].mean(), 4),
            "test": test_metrics(y_test, prob),
            "best_params": best_params,
            "_pipeline": pipe,
        }
        print(f"{name:20s} CV F1 {results[name]['cv_f1_mean']:.3f} | test {results[name]['test']}")

    ann_metrics, ann_prob = evaluate_keras_ann(X_test, y_test)
    if ann_metrics:
        probs["ANN (Keras, deployed)"] = ann_prob
        results["ANN (Keras, deployed)"] = {"test": ann_metrics, "best_params": {}}
        print(f"{'ANN (Keras)':20s} test {ann_metrics}")

    sklearn_names = [n for n in results if "_pipeline" in results[n]]
    champion = max(sklearn_names, key=lambda n: results[n]["test"]["roc_auc"])
    champion_pipe = results[champion]["_pipeline"]

    imp = permutation_importance(champion_pipe, X_test, y_test, n_repeats=10, random_state=42, scoring="roc_auc")
    importance = {f: round(float(v), 4) for f, v in sorted(zip(FEATURES, imp.importances_mean), key=lambda t: -t[1])}

    os.makedirs(MODELS_DIR, exist_ok=True)
    version = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S")
    safe_name = "".join(c if c.isalnum() else "_" for c in champion).strip("_")
    model_file = f"{MODELS_DIR}/{safe_name}_v{version}.pkl"
    joblib.dump(champion_pipe, model_file)
    joblib.dump(champion_pipe, f"{MODELS_DIR}/champion.pkl")

    registry_path = f"{MODELS_DIR}/registry.json"
    registry = json.load(open(registry_path)) if os.path.exists(registry_path) else []
    registry.append(
        {
            "version": version,
            "champion": champion,
            "file": model_file,
            "test_metrics": results[champion]["test"],
            "dataset_rows": len(df),
            "dataset_sha256": hashlib.sha256(open("dataset.csv", "rb").read()).hexdigest()[:16],
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
    )
    json.dump(registry, open(registry_path, "w"), indent=2)

    report = {
        "data_validation": data_report,
        "models": {n: {k: v for k, v in r.items() if k != "_pipeline"} for n, r in results.items()},
        "champion_sklearn": champion,
        "feature_importance": importance,
        "registry_version": version,
    }
    json.dump(report, open("aml_report.json", "w"), indent=2)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.5))
    for name, prob in probs.items():
        fpr, tpr, _ = roc_curve(y_test, prob)
        ax1.plot(fpr, tpr, label=f"{name} (AUC {roc_auc_score(y_test, prob):.3f})")
    ax1.plot([0, 1], [0, 1], "k--", linewidth=0.8)
    ax1.set(xlabel="False positive rate", ylabel="True positive rate", title="ROC curves (held-out test set)")
    ax1.legend(fontsize=8)
    ax2.barh(list(importance), list(importance.values()))
    ax2.invert_yaxis()
    ax2.set(xlabel="Permutation importance (AUC drop)", title=f"Feature importance: {champion}")
    fig.tight_layout()
    fig.savefig("aml_comparison.png", dpi=130)

    print(f"\nChampion (sklearn): {champion} -> {model_file}")
    print("Saved aml_report.json, aml_comparison.png, models/registry.json")


if __name__ == "__main__":
    main()
