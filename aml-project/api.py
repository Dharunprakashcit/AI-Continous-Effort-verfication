"""Local production API (Flask) for real-time inference with input validation.

    python api.py                     # http://localhost:8080
    POST /predict  {"age": 17, "failures": 1, "absences": 10, ...}
    GET  /health   GET /schema
"""
import json
import os
import time

import joblib
from flask import Flask, jsonify, request

from src.data import ROOT
from src.schema import CATEGORICAL, NUMERIC, validate_record

app = Flask(__name__)
MODEL = joblib.load(os.path.join(ROOT, "artifacts", "champion.pkl"))
with open(os.path.join(ROOT, "artifacts", "train_report.json")) as f:
    REPORT = json.load(f)
COLUMNS = list(MODEL.named_steps["prep"].feature_names_in_)


@app.get("/health")
def health():
    return {"status": "ok", "model": REPORT["champion"]}


@app.get("/schema")
def schema():
    return {"numeric": {k: {"min": a, "max": b, "default": d} for k, (a, b, d) in NUMERIC.items()},
            "categorical": CATEGORICAL}


@app.post("/predict")
def predict():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "body must be a JSON object"}), 400
    X, errors = validate_record(body)
    if errors:
        return jsonify({"error": "validation failed", "details": errors}), 422
    t0 = time.perf_counter()
    p_pass = float(MODEL.predict_proba(X[COLUMNS])[0, 1])
    return jsonify({"p_pass": round(p_pass, 4), "p_fail": round(1 - p_pass, 4),
                    "prediction": "pass" if p_pass >= 0.5 else "at risk of failing",
                    "model": REPORT["champion"], "latency_ms": round((time.perf_counter() - t0) * 1000, 2)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
