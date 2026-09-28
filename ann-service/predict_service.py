"""
Small inference API in front of the trained ANN. The Node.js backend's
Risk Agent calls POST /predict with a student's activity features and
gets back a risk probability. Kept separate from the Node backend so
the ANN can be retrained/redeployed independently.

Run: python predict_service.py  (listens on :5001)
"""
import json
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib
import numpy as np
from tensorflow import keras

app = Flask(__name__)
CORS(app)

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

    return jsonify(
        {
            "risk_probability": round(risk_prob, 4),
            "risk_percent": round(risk_prob * 100, 1),
            "features_used": feature_names,
        }
    )


if __name__ == "__main__":
    load_artifacts()
    app.run(host="0.0.0.0", port=5001)
