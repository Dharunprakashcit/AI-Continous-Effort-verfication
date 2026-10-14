"""Visualisations, explainability and error analysis.

Figures: EDA, correlation, PCA variance, t-SNE embedding, model comparison,
ROC + PR curves, confusion matrix, Optuna history, calibration, SHAP summary,
SHAP bar, SHAP waterfall. Also writes an error-analysis table.

Usage: python -m src.analysis
"""
import json
import os

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.calibration import calibration_curve
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.metrics import ConfusionMatrixDisplay, PrecisionRecallDisplay, RocCurveDisplay

from .data import ROOT, engineer, load_config, load_raw, preprocessor, feature_columns

plt.rcParams.update({"figure.dpi": 130, "axes.spines.top": False, "axes.spines.right": False, "font.size": 9})


def save(fig, figs, name):
    fig.tight_layout()
    fig.savefig(os.path.join(figs, name), bbox_inches="tight")
    plt.close(fig)


def main():
    cfg = load_config()
    art = os.path.join(ROOT, cfg["paths"]["artifacts"])
    figs = os.path.join(ROOT, cfg["paths"]["figures"])
    os.makedirs(figs, exist_ok=True)
    with open(os.path.join(art, "train_report.json")) as f:
        rep = json.load(f)
    df = engineer(load_raw(cfg))

    # 1. EDA: grade distribution + pass rate by failures / higher-ed intent
    fig, ax = plt.subplots(1, 3, figsize=(11, 3))
    ax[0].hist(df["G3"], bins=21, color="#4C72B0"); ax[0].axvline(9.5, color="red", ls="--"); ax[0].set_title("Final grade G3 (pass >= 10)")
    df.groupby("failures")["pass"].mean().plot.bar(ax=ax[1], color="#55A868"); ax[1].set_title("Pass rate by past failures")
    df.groupby("higher")["pass"].mean().plot.bar(ax=ax[2], color="#C44E52"); ax[2].set_title("Pass rate by higher-ed intent")
    save(fig, figs, "01_eda.png")

    # 2. Correlation heatmap of numeric features
    num_cols = df.select_dtypes("number").columns
    corr = df[num_cols].corr()
    fig, ax = plt.subplots(figsize=(9, 7))
    im = ax.imshow(corr, cmap="RdBu_r", vmin=-1, vmax=1)
    ax.set_xticks(range(len(num_cols)), num_cols, rotation=90, fontsize=6); ax.set_yticks(range(len(num_cols)), num_cols, fontsize=6)
    fig.colorbar(im); ax.set_title("Feature correlation")
    save(fig, figs, "02_correlation.png")

    # 3-4. Dimensionality reduction on the setup-C feature matrix
    num, cat = feature_columns(df, cfg["data"]["primary_setup"])
    Z = preprocessor(num, cat).fit_transform(df[num + cat])
    pca = PCA(random_state=cfg["seed"]).fit(Z)
    cum = np.cumsum(pca.explained_variance_ratio_)
    k95 = int(np.searchsorted(cum, 0.95) + 1)
    fig, ax = plt.subplots(figsize=(5, 3))
    ax.plot(range(1, len(cum) + 1), cum, marker="."); ax.axhline(0.95, color="red", ls="--")
    ax.set_xlabel("components"); ax.set_ylabel("cumulative variance"); ax.set_title(f"PCA: {k95} of {Z.shape[1]} components keep 95%")
    save(fig, figs, "03_pca_variance.png")

    emb = TSNE(n_components=2, perplexity=30, random_state=cfg["seed"], init="pca").fit_transform(Z)
    pc = PCA(2, random_state=cfg["seed"]).fit_transform(Z)
    fig, ax = plt.subplots(1, 2, figsize=(10, 4))
    for a, E, t in [(ax[0], pc, "PCA (2D)"), (ax[1], emb, "t-SNE (2D)")]:
        s = a.scatter(E[:, 0], E[:, 1], c=df["pass"], cmap="coolwarm_r", s=8, alpha=0.7)
        a.set_title(t)
    fig.legend(*s.legend_elements(), title="pass", loc="upper right")
    save(fig, figs, "04_embeddings.png")

    # 5. Model comparison
    names = list(rep["models"])
    fig, ax = plt.subplots(figsize=(8, 3.5))
    w = 0.27
    for i, m in enumerate(["roc_auc", "f1", "accuracy"]):
        ax.bar(np.arange(len(names)) + (i - 1) * w, [rep["models"][n]["test"][m] for n in names], w, label=m)
    ax.set_xticks(range(len(names)), names, rotation=20); ax.set_ylim(0.5, 1); ax.legend(); ax.set_title("Held-out test performance")
    save(fig, figs, "05_model_comparison.png")

    # 6. ROC + PR curves for all models
    X_te, y_te = joblib.load(os.path.join(art, "test_split.pkl"))
    fig, ax = plt.subplots(1, 2, figsize=(10, 4))
    probs = {}
    for n in names:
        p = joblib.load(os.path.join(art, f"{n}.pkl"))
        probs[n] = p.predict_proba(X_te)[:, 1]
        RocCurveDisplay.from_predictions(y_te, probs[n], name=n, ax=ax[0])
        PrecisionRecallDisplay.from_predictions(y_te, probs[n], name=n, ax=ax[1])
    ax[0].set_title("ROC"); ax[1].set_title("Precision-Recall")
    for a in ax: a.legend(fontsize=6)
    save(fig, figs, "06_roc_pr.png")

    champ = rep["champion"]
    model = joblib.load(os.path.join(art, "champion.pkl"))
    prob = probs[champ]

    # 7. Confusion matrix (champion)
    fig, ax = plt.subplots(figsize=(3.6, 3.2))
    ConfusionMatrixDisplay.from_predictions(y_te, (prob >= 0.5).astype(int), display_labels=["fail", "pass"], ax=ax, colorbar=False)
    ax.set_title(f"Confusion matrix: {champ}")
    save(fig, figs, "07_confusion_matrix.png")

    # 8. Optuna optimisation history
    fig, ax = plt.subplots(figsize=(7, 3.5))
    for n, h in rep["optuna_history"].items():
        ax.plot(np.maximum.accumulate(h), label=n)
    ax.set_xlabel("trial"); ax.set_ylabel("best CV ROC-AUC"); ax.legend(fontsize=6); ax.set_title("Optuna (TPE) optimisation history")
    save(fig, figs, "08_optuna_history.png")

    # 9. Calibration
    fig, ax = plt.subplots(figsize=(4, 4))
    for n in names:
        fy, fx = calibration_curve(y_te, probs[n], n_bins=8)
        ax.plot(fx, fy, marker=".", label=n)
    ax.plot([0, 1], [0, 1], "k--"); ax.set_xlabel("predicted"); ax.set_ylabel("observed"); ax.legend(fontsize=6); ax.set_title("Calibration")
    save(fig, figs, "09_calibration.png")

    # 10-12. SHAP explainability (on the transformed feature space)
    prep, clf = model.named_steps["prep"], model.named_steps["clf"]
    Xt = prep.transform(X_te)
    if "pca" in model.named_steps:
        Xt = model.named_steps["pca"].transform(Xt)
        fnames = [f"PC{i+1}" for i in range(Xt.shape[1])]
    else:
        fnames = [n.split("__", 1)[1] for n in prep.get_feature_names_out()]
    Xt = pd.DataFrame(Xt, columns=fnames)
    try:
        explainer = shap.TreeExplainer(clf)
        sv = explainer(Xt)
    except Exception:
        bg = shap.sample(Xt, 50, random_state=cfg["seed"])
        explainer = shap.Explainer(lambda a: clf.predict_proba(a)[:, 1], bg)
        sv = explainer(Xt)
    if sv.values.ndim == 3:
        sv = sv[..., 1]
    shap.plots.beeswarm(sv, max_display=15, show=False); plt.title(f"SHAP summary: {champ}")
    plt.gcf().savefig(os.path.join(figs, "10_shap_summary.png"), bbox_inches="tight", dpi=130); plt.close()
    shap.plots.bar(sv, max_display=15, show=False); plt.title("Mean |SHAP| importance")
    plt.gcf().savefig(os.path.join(figs, "11_shap_bar.png"), bbox_inches="tight", dpi=130); plt.close()
    worst = int(np.argmax(np.abs(prob - y_te)))
    shap.plots.waterfall(sv[worst], max_display=12, show=False); plt.title("Most confident error explained")
    plt.gcf().savefig(os.path.join(figs, "12_shap_waterfall_error.png"), bbox_inches="tight", dpi=130); plt.close()
    shap_rank = pd.Series(np.abs(sv.values).mean(0), index=fnames).sort_values(ascending=False)

    # Error analysis: where does the champion fail?
    test = df.loc[X_te.index].copy()
    test["prob"] = prob
    test["pred"] = (prob >= 0.5).astype(int)
    test["error"] = np.where(test["pred"] == test["pass"], "correct",
                             np.where(test["pred"] == 1, "missed_fail", "false_alarm"))  # positive class = pass
    seg = {}
    for col in ["course", "failures", "higher", "school", "sex"]:
        g = test.groupby(col).apply(lambda d: pd.Series({"n": len(d), "error_rate": float((d["error"] != "correct").mean())}),
                                    include_groups=False)
        seg[col] = g.round(3).reset_index().to_dict("records")
    thr = []
    for t in np.arange(0.3, 0.8, 0.05):
        p = (prob >= t).astype(int)
        thr.append({"threshold": round(float(t), 2), "missed_fail": int(((p == 1) & (y_te == 0)).sum()),
                    "false_alarm": int(((p == 0) & (y_te == 1)).sum())})
    errors = {"counts": test["error"].value_counts().to_dict(), "by_segment": seg, "threshold_tradeoff": thr,
              "shap_top": shap_rank.head(15).round(4).to_dict(), "pca_components_95": k95, "encoded_dims": int(Z.shape[1]),
              "missed_fail_profile": test[test["error"] == "missed_fail"][["absences", "failures", "studytime", "G3"]].describe().round(2).to_dict()}
    with open(os.path.join(art, "error_analysis.json"), "w") as f:
        json.dump(errors, f, indent=2, default=float)
    print("figures written to", figs)


if __name__ == "__main__":
    main()
