"""
Academic risk model: estimates a student's overall academic risk from attendance,
marks, submissions, assignment scores and team contribution. This is separate from
the team free-riding network. A student can contribute little to one team project
and still have low academic risk overall.

There is no public dataset for this, so labels come from a simulator that combines
the same factors with noise. Figures describe the method, not real students.

Run: python academic_model.py
Outputs: academic_model.pkl, academic_report.json, academic_dataset.csv
"""
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "attendance_pct",
    "internal_marks",
    "previous_gpa",
    "submission_rate_pct",
    "late_submissions",
    "avg_assignment_score",
    "contribution_ratio",
    "tasks_completed_pct",
]
RNG = np.random.default_rng(11)


def latent_risk(d):
    return (
        0.20 * (1 - d["attendance_pct"] / 100)
        + 0.22 * (1 - d["internal_marks"] / 100)
        + 0.14 * (1 - d["previous_gpa"] / 10)
        + 0.14 * (1 - d["submission_rate_pct"] / 100)
        + 0.06 * np.minimum(d["late_submissions"] / 4, 1)
        + 0.10 * (1 - d["avg_assignment_score"] / 100)
        + 0.08 * (1 - np.minimum(d["contribution_ratio"], 1.2) / 1.2)
        + 0.06 * (1 - d["tasks_completed_pct"] / 100)
    )


def simulate(n=5000):
    ability = RNG.normal(0, 1, n)
    d = pd.DataFrame(
        {
            "attendance_pct": np.clip(80 + 9 * ability + RNG.normal(0, 6, n), 30, 100),
            "internal_marks": np.clip(62 + 16 * ability + RNG.normal(0, 7, n), 0, 100),
            "previous_gpa": np.clip(7.0 + 1.1 * ability + RNG.normal(0, 0.5, n), 2, 10),
            "submission_rate_pct": np.clip(80 + 14 * ability + RNG.normal(0, 8, n), 0, 100),
            "late_submissions": np.clip(np.round(RNG.poisson(1.2, n) - 0.7 * ability), 0, 8),
            "avg_assignment_score": np.clip(60 + 15 * ability + RNG.normal(0, 8, n), 0, 100),
            "contribution_ratio": np.clip(1.0 + 0.28 * ability + RNG.normal(0, 0.25, n), 0, 2),
            "tasks_completed_pct": np.clip(70 + 18 * ability + RNG.normal(0, 14, n), 0, 100),
        }
    )
    score = latent_risk(d) + RNG.normal(0, 0.03, n)
    d["at_risk"] = (score > np.quantile(score, 0.65)).astype(int)
    return d


def metrics(y, prob):
    pred = (prob > 0.5).astype(int)
    return {
        "accuracy": round(accuracy_score(y, pred), 4),
        "precision": round(precision_score(y, pred), 4),
        "recall": round(recall_score(y, pred), 4),
        "f1": round(f1_score(y, pred), 4),
        "roc_auc": round(roc_auc_score(y, prob), 4),
    }


def main():
    df = simulate()
    df.to_csv("academic_dataset.csv", index=False)
    X, y = df[FEATURES].values, df["at_risk"].values
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    def make(clf):
        return Pipeline([("scale", StandardScaler()), ("clf", clf)])

    candidates = {
        "LogisticRegression": (make(LogisticRegression(max_iter=1000)), None),
        "RandomForest": (make(RandomForestClassifier(random_state=42)), {"clf__n_estimators": [150, 300], "clf__max_depth": [5, 10, None]}),
        "GradientBoosting": (make(GradientBoostingClassifier(random_state=42)), {"clf__n_estimators": [100, 200], "clf__learning_rate": [0.05, 0.1]}),
    }
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    results, fitted = {}, {}
    for name, (pipe, grid) in candidates.items():
        if grid:
            search = GridSearchCV(pipe, grid, cv=cv, scoring="roc_auc", n_jobs=-1).fit(X_tr, y_tr)
            pipe, params = search.best_estimator_, search.best_params_
        else:
            pipe.fit(X_tr, y_tr)
            params = {}
        cvs = cross_validate(pipe, X_tr, y_tr, cv=cv, scoring=["roc_auc", "f1"])
        results[name] = {
            "cv_roc_auc_mean": round(cvs["test_roc_auc"].mean(), 4),
            "cv_f1_mean": round(cvs["test_f1"].mean(), 4),
            "test": metrics(y_te, pipe.predict_proba(X_te)[:, 1]),
            "best_params": params,
        }
        fitted[name] = pipe
        print(name, results[name]["test"])

    champion = max(results, key=lambda n: results[n]["test"]["roc_auc"])
    pipe = fitted[champion]
    imp = permutation_importance(pipe, X_te, y_te, n_repeats=10, random_state=42, scoring="roc_auc")
    importance = {f: round(float(v), 4) for f, v in sorted(zip(FEATURES, imp.importances_mean), key=lambda t: -t[1])}

    joblib.dump(pipe, "academic_model.pkl")
    report = {
        "features": FEATURES,
        "champion": champion,
        "positive_rate": round(float(y.mean()), 3),
        "n_train": len(X_tr),
        "n_test": len(X_te),
        "models": results,
        "feature_importance": importance,
    }
    json.dump(report, open("academic_report.json", "w"), indent=2)
    print(f"\nChampion: {champion}\nSaved academic_model.pkl and academic_report.json")


if __name__ == "__main__":
    main()
