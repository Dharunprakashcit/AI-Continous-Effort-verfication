"""Interactive Gradio UI (Hugging Face Spaces entry point).

    python app.py                     # http://localhost:7860
"""
import json
import os

import gradio as gr
import joblib
import numpy as np
import pandas as pd
import shap

from src.data import ROOT
from src.schema import CATEGORICAL, FIELDS, NUMERIC, validate_record

MODEL = joblib.load(os.path.join(ROOT, "artifacts", "champion.pkl"))
with open(os.path.join(ROOT, "artifacts", "train_report.json")) as f:
    REPORT = json.load(f)
COLUMNS = list(MODEL.named_steps["prep"].feature_names_in_)
PREP, CLF = MODEL.named_steps["prep"], MODEL.named_steps["clf"]
HAS_PCA = "pca" in MODEL.named_steps
try:
    EXPLAINER = None if HAS_PCA else shap.TreeExplainer(CLF)
except Exception:
    EXPLAINER = None

LABELS = {"Medu": "Mother's education (0-4)", "Fedu": "Father's education (0-4)", "studytime": "Weekly study time (1-4)",
          "failures": "Past class failures", "Dalc": "Weekday alcohol (1-5)", "Walc": "Weekend alcohol (1-5)",
          "goout": "Going out (1-5)", "famrel": "Family relationship (1-5)", "higher": "Wants higher education",
          "schoolsup": "Extra school support", "famsup": "Family support", "paid": "Paid extra classes"}


def predict(*values):
    X, errors = validate_record(dict(zip(FIELDS, values)))
    if errors:
        raise gr.Error("; ".join(errors))
    X = X[COLUMNS]
    p = float(MODEL.predict_proba(X)[0, 1])
    label = {"Pass": p, "At risk of failing": 1 - p}
    drivers = pd.DataFrame(columns=["feature", "effect on pass (SHAP)"])
    if EXPLAINER is not None:
        sv = np.asarray(EXPLAINER.shap_values(PREP.transform(X)))
        sv = sv[1] if sv.ndim == 3 else sv
        names = [n.split("__", 1)[1] for n in PREP.get_feature_names_out()]
        s = pd.Series(sv.reshape(-1)[: len(names)], index=names)
        top = s.reindex(s.abs().sort_values(ascending=False).index)[:8]
        drivers = pd.DataFrame({"feature": top.index, "effect on pass (SHAP)": top.round(3).values})
    return label, drivers


inputs = [gr.Slider(lo, hi, value=d, step=1, label=LABELS.get(k, k)) for k, (lo, hi, d) in NUMERIC.items()]
inputs += [gr.Dropdown(opts, value=opts[0], label=LABELS.get(k, k)) for k, opts in CATEGORICAL.items()]

with gr.Blocks(title="Student Failure Early Warning") as demo:
    gr.Markdown(f"# Student Failure Early Warning\nPredicts whether a student will pass (final grade >= 10/20) "
                f"**before any grades exist** (setup C), using the UCI Student Performance data. "
                f"Model: **{REPORT['champion']}** tuned with Optuna. "
                f"Test ROC-AUC {REPORT['models'][REPORT['champion']]['test']['roc_auc']:.3f}.")
    with gr.Row():
        with gr.Column(scale=2):
            with gr.Accordion("Study and history", open=True):
                for c in inputs[:13]:
                    c.render()
            with gr.Accordion("Background", open=False):
                for c in inputs[13:]:
                    c.render()
            btn = gr.Button("Predict", variant="primary")
        with gr.Column(scale=1):
            out = gr.Label(label="Prediction")
            drv = gr.Dataframe(label="Top drivers for this student")
    btn.click(predict, inputs, [out, drv])

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=int(os.environ.get("PORT", 7860)))
