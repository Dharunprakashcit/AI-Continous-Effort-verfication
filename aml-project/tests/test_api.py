"""Smoke tests for the inference API: python -m pytest tests"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api import app  # noqa: E402

client = app.test_client()


def test_health():
    assert client.get("/health").json["status"] == "ok"


def test_predict_defaults():
    r = client.post("/predict", json={})
    assert r.status_code == 200 and 0 <= r.json["p_pass"] <= 1


def test_risk_direction():
    good = client.post("/predict", json={"failures": 0, "higher": "yes", "studytime": 4, "absences": 0}).json["p_pass"]
    bad = client.post("/predict", json={"failures": 3, "higher": "no", "studytime": 1, "absences": 30}).json["p_pass"]
    assert good > bad


def test_validation():
    assert client.post("/predict", json={"age": 99}).status_code == 422
    assert client.post("/predict", json={"sex": "X"}).status_code == 422
    assert client.post("/predict", data="nope").status_code == 400
