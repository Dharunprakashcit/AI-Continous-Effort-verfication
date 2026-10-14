"""
Read-only experiments on the deployed free-riding ANN.

Nothing here modifies model.h5, scaler.pkl, metrics.json or dataset.csv. The
seed-variance study retrains in memory only. Outputs go to
report/ann/ann_experiments.json and report/ann/figures/*.png.

Run: python ann_experiments.py
"""
import json
import os
import platform
import statistics
import time

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
import tensorflow as tf
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from tensorflow import keras

FEATURES = [
    "tasks_completed_pct",
    "doc_edits",
    "messages_sent",
    "commits",
    "deadline_adherence_pct",
    "active_days_last7",
]
LABELS = {
    "tasks_completed_pct": "Tasks completed (%)",
    "doc_edits": "Document edits",
    "messages_sent": "Messages sent",
    "commits": "Commits",
    "deadline_adherence_pct": "Deadline adherence (%)",
    "active_days_last7": "Active days (last 7)",
}
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "report", "ann"))
FIG = os.path.join(OUT, "figures")
os.makedirs(FIG, exist_ok=True)

plt.rcParams.update(
    {
        "font.family": "serif",
        "font.size": 8,
        "axes.titlesize": 8.5,
        "axes.labelsize": 8,
        "legend.fontsize": 7,
        "xtick.labelsize": 7,
        "ytick.labelsize": 7,
        "axes.grid": True,
        "grid.alpha": 0.3,
        "figure.dpi": 100,
    }
)


def metrics_at(y, prob, thr=0.5):
    pred = (prob > thr).astype(int)
    return {
        "accuracy": float(accuracy_score(y, pred)),
        "precision": float(precision_score(y, pred, zero_division=0)),
        "recall": float(recall_score(y, pred)),
        "f1": float(f1_score(y, pred)),
        "roc_auc": float(roc_auc_score(y, prob)),
    }


def build_model():
    m = keras.Sequential(
        [
            keras.layers.Input(shape=(len(FEATURES),)),
            keras.layers.Dense(16, activation="relu"),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(8, activation="relu"),
            keras.layers.Dense(1, activation="sigmoid"),
        ]
    )
    m.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return m


def savefig(name):
    plt.tight_layout()
    plt.savefig(os.path.join(FIG, name), dpi=220)
    plt.close()


def main():
    t0 = time.time()
    df = pd.read_csv(os.path.join(HERE, "dataset.csv"))
    X, y = df[FEATURES].values, df["risk_label"].values
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = joblib.load(os.path.join(HERE, "scaler.pkl"))
    model = keras.models.load_model(os.path.join(HERE, "model.h5"), compile=False)
    Xs_tr, Xs_te = scaler.transform(X_tr), scaler.transform(X_te)
    prob = model.predict(Xs_te, verbose=0).ravel()

    res = {"environment": {
        "python": platform.python_version(),
        "tensorflow": tf.__version__,
        "scikit_learn": sklearn.__version__,
        "numpy": np.__version__,
        "platform": platform.platform(),
        "processor": platform.processor(),
    }}

    # Dataset description
    res["dataset"] = {
        "rows": int(len(df)),
        "train": int(len(X_tr)),
        "test": int(len(X_te)),
        "positive_rate": float(y.mean()),
        "train_positive_rate": float(y_tr.mean()),
        "test_positive_rate": float(y_te.mean()),
        "majority_class_accuracy_test": float(max(y_te.mean(), 1 - y_te.mean())),
        "features": {
            f: {
                "mean": float(df[f].mean()),
                "std": float(df[f].std()),
                "min": float(df[f].min()),
                "max": float(df[f].max()),
                "mean_normal": float(df.loc[df.risk_label == 0, f].mean()),
                "mean_at_risk": float(df.loc[df.risk_label == 1, f].mean()),
            }
            for f in FEATURES
        },
    }

    # 1. Reproduce stored metrics
    stored = json.load(open(os.path.join(HERE, "metrics.json")))
    m = metrics_at(y_te, prob)
    res["reproduction"] = {
        "recomputed": m,
        "stored": {k: stored[k] for k in ("accuracy", "precision", "recall", "f1_score", "roc_auc")},
        "max_abs_difference": max(
            abs(m["accuracy"] - stored["accuracy"]),
            abs(m["precision"] - stored["precision"]),
            abs(m["recall"] - stored["recall"]),
            abs(m["f1"] - stored["f1_score"]),
            abs(m["roc_auc"] - stored["roc_auc"]),
        ),
        "parameters": int(model.count_params()),
    }

    # 2. Confusion matrix
    cm = confusion_matrix(y_te, (prob > 0.5).astype(int))
    res["confusion_matrix"] = cm.tolist()
    fig, ax = plt.subplots(figsize=(3.0, 2.7))
    ax.imshow(cm, cmap="Blues")
    ax.grid(False)
    for i in range(2):
        for j in range(2):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center", color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=11)
    ax.set_xticks([0, 1], ["Normal", "At risk"])
    ax.set_yticks([0, 1], ["Normal", "At risk"])
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title("Confusion matrix, test set (n=800)")
    savefig("cm.png")

    # 3. ROC
    fpr, tpr, _ = roc_curve(y_te, prob)
    pred = (prob > 0.5).astype(int)
    op_fpr = ((pred == 1) & (y_te == 0)).sum() / (y_te == 0).sum()
    op_tpr = ((pred == 1) & (y_te == 1)).sum() / (y_te == 1).sum()
    fig, ax = plt.subplots(figsize=(3.2, 2.9))
    ax.plot(fpr, tpr, lw=1.6, label=f"ANN (AUC {m['roc_auc']:.3f})")
    ax.plot([0, 1], [0, 1], "k--", lw=0.8, label="Chance")
    ax.scatter([op_fpr], [op_tpr], c="red", zorder=5, s=18, label="Threshold 0.5")
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.set_title("ROC curve, test set")
    ax.legend(loc="lower right")
    savefig("roc.png")

    # 4. Threshold sweep
    thrs = [round(t, 2) for t in np.arange(0.10, 0.91, 0.05)]
    sweep = [{"threshold": t, **{k: v for k, v in metrics_at(y_te, prob, t).items() if k != "roc_auc"}} for t in thrs]
    best = max(sweep, key=lambda r: r["f1"])
    res["threshold_sweep"] = {"rows": sweep, "best_f1": best}
    fig, ax = plt.subplots(figsize=(3.4, 2.8))
    for key, lab in (("precision", "Precision"), ("recall", "Recall"), ("f1", "F1"), ("accuracy", "Accuracy")):
        ax.plot(thrs, [r[key] for r in sweep], label=lab, lw=1.4)
    ax.axvline(0.5, color="gray", ls=":", lw=1)
    ax.set_xlabel("Decision threshold")
    ax.set_ylabel("Score")
    ax.set_title("Threshold sweep, test set")
    ax.legend(loc="lower center", ncol=2)
    savefig("threshold.png")

    # 5. Calibration
    bins = np.linspace(0, 1, 11)
    idx = np.digitize(prob, bins[1:-1])
    rel = []
    ece = 0.0
    for b in range(10):
        mask = idx == b
        if mask.sum() == 0:
            continue
        conf, acc, n = float(prob[mask].mean()), float(y_te[mask].mean()), int(mask.sum())
        rel.append({"bin": b, "mean_predicted": conf, "observed_rate": acc, "n": n})
        ece += n / len(prob) * abs(acc - conf)
    res["calibration"] = {"bins": rel, "ece": float(ece), "brier": float(brier_score_loss(y_te, prob))}
    fig, ax = plt.subplots(figsize=(3.0, 2.8))
    ax.plot([0, 1], [0, 1], "k--", lw=0.8, label="Perfect")
    ax.plot([r["mean_predicted"] for r in rel], [r["observed_rate"] for r in rel], "o-", lw=1.4, ms=4, label=f"ANN (ECE {ece:.3f})")
    ax.set_xlabel("Mean predicted probability")
    ax.set_ylabel("Observed at-risk rate")
    ax.set_title("Reliability diagram")
    ax.legend(loc="upper left")
    savefig("calibration.png")

    # 6. Permutation importance (AUC drop)
    rng = np.random.default_rng(0)
    base_auc = roc_auc_score(y_te, prob)
    imp = {}
    for j, f in enumerate(FEATURES):
        drops = []
        for _ in range(20):
            Xp = Xs_te.copy()
            Xp[:, j] = rng.permutation(Xp[:, j])
            drops.append(base_auc - roc_auc_score(y_te, model.predict(Xp, verbose=0).ravel()))
        imp[f] = {"mean": float(np.mean(drops)), "std": float(np.std(drops))}
    res["permutation_importance"] = imp
    order = sorted(FEATURES, key=lambda f: imp[f]["mean"])
    fig, ax = plt.subplots(figsize=(3.4, 2.5))
    ax.barh([LABELS[f] for f in order], [imp[f]["mean"] for f in order], xerr=[imp[f]["std"] for f in order], color="#4b7bec")
    ax.set_xlabel("Drop in ROC-AUC when permuted")
    ax.set_title("Permutation importance, ANN")
    savefig("importance.png")

    # 7. Sensitivity curves (one feature at a time, others at training median)
    med = np.median(X_tr, axis=0)
    fig, axes = plt.subplots(2, 3, figsize=(6.9, 3.4))
    mono = {}
    for ax, (j, f) in zip(axes.ravel(), enumerate(FEATURES)):
        lo, hi = np.percentile(X_tr[:, j], [5, 95])
        grid = np.linspace(lo, hi, 60)
        Xg = np.tile(med, (60, 1))
        Xg[:, j] = grid
        p = model.predict(scaler.transform(Xg), verbose=0).ravel()
        d = np.diff(p)
        mono[f] = {"non_increasing": bool((d <= 1e-6).all()), "p_at_5th": float(p[0]), "p_at_95th": float(p[-1])}
        ax.plot(grid, p, lw=1.5, color="#d64545")
        ax.set_title(LABELS[f], fontsize=7.5)
        ax.set_ylim(0, 1)
    fig.supxlabel("Feature value (5th to 95th percentile)", fontsize=8)
    fig.supylabel("ANN risk probability", fontsize=8)
    savefig("sensitivity.png")
    res["sensitivity"] = mono
    res["median_profile"] = {f: float(med[j]) for j, f in enumerate(FEATURES)}

    # 8. Noise robustness
    noise = []
    for sigma in (0.0, 0.1, 0.25, 0.5, 1.0):
        aucs, f1s = [], []
        for r in range(10 if sigma else 1):
            Xn = Xs_te + np.random.default_rng(r).normal(0, sigma, Xs_te.shape)
            pn = model.predict(Xn, verbose=0).ravel()
            mm = metrics_at(y_te, pn)
            aucs.append(mm["roc_auc"])
            f1s.append(mm["f1"])
        noise.append({"sigma": sigma, "roc_auc": float(np.mean(aucs)), "f1": float(np.mean(f1s))})
    res["noise_robustness"] = noise
    fig, ax = plt.subplots(figsize=(3.2, 2.6))
    ax.plot([n["sigma"] for n in noise], [n["roc_auc"] for n in noise], "o-", label="ROC-AUC", lw=1.4)
    ax.plot([n["sigma"] for n in noise], [n["f1"] for n in noise], "s-", label="F1", lw=1.4)
    ax.set_xlabel("Gaussian noise (std. dev. in standardized units)")
    ax.set_ylabel("Score")
    ax.set_title("Robustness to input noise")
    ax.legend()
    savefig("noise.png")

    # 9. Ceiling from the labelling formula itself
    latent = (
        0.30 * (X_te[:, 0] / 100)
        + 0.20 * np.tanh(X_te[:, 1] / 20)
        + 0.15 * np.tanh(X_te[:, 2] / 15)
        + 0.15 * np.tanh(X_te[:, 3] / 10)
        + 0.15 * (X_te[:, 4] / 100)
        + 0.05 * (X_te[:, 5] / 7)
    )
    rule_risk = 1 - latent
    res["rule_ceiling"] = {
        "roc_auc": float(roc_auc_score(y_te, rule_risk)),
        "accuracy_at_0.45": float(accuracy_score(y_te, (rule_risk > 0.45).astype(int))),
        "f1_at_0.45": float(f1_score(y_te, (rule_risk > 0.45).astype(int))),
    }

    # 10. In-process latency
    one = Xs_te[:1]
    model.predict(one, verbose=0)
    t_pred, t_call = [], []
    for _ in range(200):
        s = time.perf_counter()
        model.predict(one, verbose=0)
        t_pred.append((time.perf_counter() - s) * 1000)
        s = time.perf_counter()
        model(one, training=False)
        t_call.append((time.perf_counter() - s) * 1000)
    s = time.perf_counter()
    model.predict(Xs_te, verbose=0)
    batch_ms = (time.perf_counter() - s) * 1000
    res["latency_in_process"] = {
        "predict_single_median_ms": statistics.median(t_pred),
        "predict_single_p95_ms": float(np.percentile(t_pred, 95)),
        "call_single_median_ms": statistics.median(t_call),
        "batch_800_total_ms": batch_ms,
        "batch_800_per_sample_ms": batch_ms / len(Xs_te),
    }

    # 11. Seed variance (in-memory retraining; deployed files untouched)
    runs, history0 = [], None
    for seed in range(5):
        keras.utils.set_random_seed(seed)
        sc = StandardScaler().fit(X_tr)
        mm = build_model()
        hist = mm.fit(
            sc.transform(X_tr), y_tr, validation_split=0.15, epochs=100, batch_size=32,
            callbacks=[keras.callbacks.EarlyStopping(monitor="val_loss", patience=8, restore_best_weights=True)],
            verbose=0,
        )
        p = mm.predict(sc.transform(X_te), verbose=0).ravel()
        r = {"seed": seed, "epochs": len(hist.history["loss"]), **metrics_at(y_te, p)}
        runs.append(r)
        if seed == 0:
            history0 = {k: [float(v) for v in vals] for k, vals in hist.history.items()}
    agg = {}
    for k in ("accuracy", "precision", "recall", "f1", "roc_auc", "epochs"):
        vals = [r[k] for r in runs]
        agg[k] = {"mean": float(np.mean(vals)), "std": float(np.std(vals, ddof=1)), "min": float(min(vals)), "max": float(max(vals))}
    res["seed_variance"] = {"runs": runs, "aggregate": agg}

    fig, axes = plt.subplots(1, 2, figsize=(6.9, 2.6))
    ep = range(1, len(history0["loss"]) + 1)
    axes[0].plot(ep, history0["loss"], label="Training loss", lw=1.4)
    axes[0].plot(ep, history0["val_loss"], label="Validation loss", lw=1.4)
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Binary cross-entropy")
    axes[0].set_title("Loss (re-run, seed 0)")
    axes[0].legend()
    axes[1].plot(ep, history0["accuracy"], label="Training accuracy", lw=1.4)
    axes[1].plot(ep, history0["val_accuracy"], label="Validation accuracy", lw=1.4)
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Accuracy")
    axes[1].set_title("Accuracy (re-run, seed 0)")
    axes[1].legend()
    savefig("training.png")
    res["training_history_seed0"] = {"epochs": len(history0["loss"]), "final_train_loss": history0["loss"][-1], "final_val_loss": history0["val_loss"][-1], "best_val_loss": min(history0["val_loss"])}

    fig, ax = plt.subplots(figsize=(3.2, 2.6))
    for key, lab in (("accuracy", "Accuracy"), ("f1", "F1"), ("roc_auc", "ROC-AUC")):
        ax.plot([r["seed"] for r in runs], [r[key] for r in runs], "o-", label=lab, lw=1.2, ms=4)
    ax.axhline(stored["roc_auc"], color="gray", ls=":", lw=0.9)
    ax.set_xlabel("Training seed")
    ax.set_ylabel("Test score")
    ax.set_title("Variation across 5 seeds")
    ax.set_xticks(range(5))
    ax.legend()
    savefig("seeds.png")

    res["elapsed_seconds"] = round(time.time() - t0, 1)
    json.dump(res, open(os.path.join(OUT, "ann_experiments.json"), "w"), indent=2)
    print(json.dumps({k: res[k] for k in ("reproduction", "calibration", "rule_ceiling", "latency_in_process")}, indent=1))
    print(json.dumps(res["seed_variance"]["aggregate"], indent=1))
    print("elapsed", res["elapsed_seconds"])


if __name__ == "__main__":
    main()
