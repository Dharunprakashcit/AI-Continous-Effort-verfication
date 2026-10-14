"""Streamlit UI (Streamlit Community Cloud entry point).

    streamlit run streamlit_app.py
"""
import json
import os

import joblib
import numpy as np
import pandas as pd
import shap
import streamlit as st

from src.data import ROOT
from src.schema import CATEGORICAL, NUMERIC, validate_record

LABELS = {"Medu": "Mother's education (0-4)", "Fedu": "Father's education (0-4)", "studytime": "Weekly study time (1-4)",
          "failures": "Past class failures", "Dalc": "Weekday alcohol (1-5)", "Walc": "Weekend alcohol (1-5)",
          "goout": "Going out (1-5)", "famrel": "Family relationship (1-5)", "higher": "Wants higher education",
          "schoolsup": "Extra school support", "famsup": "Family support", "paid": "Paid extra classes",
          "traveltime": "Travel time (1-4)", "freetime": "Free time (1-5)", "health": "Health (1-5)", "course": "Course"}


@st.cache_resource
def load():
    model = joblib.load(os.path.join(ROOT, "artifacts", "champion.pkl"))
    with open(os.path.join(ROOT, "artifacts", "train_report.json")) as f:
        report = json.load(f)
    try:
        explainer = None if "pca" in model.named_steps else shap.TreeExplainer(model.named_steps["clf"])
    except Exception:
        explainer = None
    return model, report, explainer


MODEL, REPORT, EXPLAINER = load()
PREP = MODEL.named_steps["prep"]
COLUMNS = list(PREP.feature_names_in_)
test = REPORT["models"][REPORT["champion"]]["test"]

st.set_page_config(page_title="Student Failure Early Warning", page_icon="🎓", layout="wide")
st.title("🎓 Student Failure Early Warning")
st.write("Predicts whether a student will pass (final grade ≥ 10/20) **before any grades exist**, "
         "using the UCI Student Performance data.")
c1, c2, c3 = st.columns(3)
c1.metric("Model", f"{REPORT['champion']} (Optuna-tuned)")
c2.metric("Test ROC-AUC", f"{test['roc_auc']:.3f}")
c3.metric("Test F1", f"{test['f1']:.3f}")

with st.form("student"):
    st.subheader("Student profile")
    rec, cols = {}, st.columns(3)
    for i, (k, (lo, hi, d)) in enumerate(NUMERIC.items()):
        rec[k] = cols[i % 3].slider(LABELS.get(k, k), lo, hi, d)
    with st.expander("Background", expanded=False):
        cols = st.columns(3)
        for i, (k, opts) in enumerate(CATEGORICAL.items()):
            rec[k] = cols[i % 3].selectbox(LABELS.get(k, k), opts)
    submitted = st.form_submit_button("Predict", type="primary")

if submitted:
    X, errors = validate_record(rec)
    if errors:
        st.error("; ".join(errors))
        st.stop()
    X = X[COLUMNS]
    p = float(MODEL.predict_proba(X)[0, 1])
    left, right = st.columns([1, 2])
    with left:
        if p >= 0.5:
            st.success(f"**Likely to pass** ({p:.0%})")
        else:
            st.error(f"**At risk of failing** ({1 - p:.0%})")
        st.progress(p, text=f"P(pass) = {p:.2f}")
    if EXPLAINER is not None:
        sv = np.asarray(EXPLAINER.shap_values(PREP.transform(X)))
        sv = sv[1] if sv.ndim == 3 else sv
        names = [n.split("__", 1)[1] for n in PREP.get_feature_names_out()]
        s = pd.Series(sv.reshape(-1)[: len(names)], index=names)
        top = s.reindex(s.abs().sort_values(ascending=False).index)[:10][::-1]
        with right:
            st.caption("Top drivers for this student (SHAP; positive pushes toward pass)")
            st.bar_chart(pd.DataFrame({"SHAP": top.values}, index=top.index), horizontal=True)

with st.expander("Model evaluation figures"):
    figs = os.path.join(ROOT, "figures")
    for name, cap in [("06_roc_pr.png", "ROC and PR curves"), ("10_shap_summary.png", "SHAP summary"),
                      ("07_confusion_matrix.png", "Confusion matrix")]:
        path = os.path.join(figs, name)
        if os.path.exists(path):
            st.image(path, caption=cap)
