"""
In-process inference latency of the deployed ANN, measured without HTTP.
Run on an otherwise idle machine. Writes report/ann/ann_latency.json.
"""
import json
import os
import statistics
import time

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import joblib
import numpy as np
import pandas as pd
from tensorflow import keras

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "report", "ann"))
FEATURES = json.load(open(os.path.join(HERE, "feature_names.json")))

model = keras.models.load_model(os.path.join(HERE, "model.h5"), compile=False)
scaler = joblib.load(os.path.join(HERE, "scaler.pkl"))
x = scaler.transform(pd.read_csv(os.path.join(HERE, "dataset.csv"))[FEATURES].values[:1])
batch = scaler.transform(pd.read_csv(os.path.join(HERE, "dataset.csv"))[FEATURES].values[:800])


def timeit(fn, n=300):
    fn()
    s = []
    for _ in range(n):
        t = time.perf_counter()
        fn()
        s.append((time.perf_counter() - t) * 1000)
    s.sort()
    return {"n": n, "median_ms": statistics.median(s), "p95_ms": s[int(0.95 * n) - 1], "max_ms": s[-1]}


res = {
    "model.predict, 1 sample": timeit(lambda: model.predict(x, verbose=0)),
    "model(x, training=False), 1 sample": timeit(lambda: model(x, training=False)),
    "model.predict, 800 samples": timeit(lambda: model.predict(batch, verbose=0), 30),
}
json.dump(res, open(os.path.join(OUT, "ann_latency.json"), "w"), indent=2)
print(json.dumps(res, indent=1))
