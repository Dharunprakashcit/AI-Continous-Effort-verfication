"""
Small inference API in front of the trained ANN. The Node.js backend's
Risk Agent calls POST /predict with a student's activity features and
gets back a risk probability. Kept separate from the Node backend so
the ANN can be retrained/redeployed independently.

Run: python predict_service.py  (listens on :5001)
"""
import json
import os
import time

from drift_monitor import compute_drift
from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib
import numpy as np
from tensorflow import keras

app = Flask(__name__)
CORS(app)

LOG_PATH = "predictions_log.jsonl"
MODEL_VERSION = (
    time.strftime("%Y%m%d%H%M%S", time.gmtime(os.path.getmtime("model.h5")))
    if os.path.exists("model.h5")
    else "untrained"
)
MODEL_PATH = "model.h5"
SCALER_PATH = "scaler.pkl"
FEATURES_PATH = "feature_names.json"

model = None
scaler = None
feature_names = None


def load_artifacts():
    global model, scaler, feature_names
    if not (os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH)):
        raise RuntimeError(
            "Model artifacts not found. Run `python train_model.py` first."
        )
    model = keras.models.load_model(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    with open(FEATURES_PATH) as f:
        feature_names = json.load(f)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": model is not None})


@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(force=True)
    try:
        x = np.array([[float(payload[name]) for name in feature_names]])
    except (KeyError, TypeError, ValueError) as exc:
        return jsonify({"error": f"invalid input: {exc}", "expected": feature_names}), 400

    x_scaled = scaler.transform(x)
    risk_prob = float(model.predict(x_scaled, verbose=0).ravel()[0])

    if payload.get("log", True):
        with open(LOG_PATH, "a") as f:
            f.write(json.dumps({name: float(payload[name]) for name in feature_names}) + "\n")

    return jsonify(
        {
            "risk_probability": round(risk_prob, 4),
            "risk_percent": round(risk_prob * 100, 1),
            "features_used": feature_names,
            "model_version": MODEL_VERSION,
        }
    )


def read_json(path, default=None):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


@app.route("/model/info", methods=["GET"])
def model_info():
    registry = read_json("models/registry.json", [])
    report = read_json("aml_report.json", {})
    return jsonify(
        {
            "serving": {"model": "ANN (Keras)", "version": MODEL_VERSION},
            "ann_metrics": read_json("metrics.json"),
            "comparison": report.get("models", {}),
            "feature_importance": report.get("feature_importance", {}),
            "data_validation": report.get("data_validation"),
            "registry": registry[-5:],
        }
    )


@app.route("/model/drift", methods=["GET"])
def model_drift():
    return jsonify(compute_drift())


if __name__ == "__main__":
    load_artifacts()
    app.run(host="0.0.0.0", port=5001)
