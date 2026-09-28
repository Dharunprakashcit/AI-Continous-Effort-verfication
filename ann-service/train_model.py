"""
Trains an ANN to predict free-riding / contribution risk from student
activity features.

Ground truth: there is no public dataset for team free-riding behaviour,
so we synthesize one using a rule-based simulator that mirrors patterns
described in the project brief (low task completion, low edit volume,
low discussion participation, missed deadlines => higher risk), plus
Gaussian noise so the ANN has to learn a non-trivial boundary rather
than memorize the rule.

Run: python train_model.py
Outputs: model.h5 (Keras ANN), scaler.pkl (StandardScaler), metrics.json
"""
import json

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import tensorflow as tf
from tensorflow import keras

RNG = np.random.default_rng(42)
N_SAMPLES = 4000

FEATURE_NAMES = [
    "tasks_completed_pct",
    "doc_edits",
    "messages_sent",
    "commits",
    "deadline_adherence_pct",
    "active_days_last7",
]


def simulate_dataset(n=N_SAMPLES):
    tasks_completed_pct = np.clip(RNG.normal(65, 25, n), 0, 100)
    doc_edits = np.clip(RNG.gamma(shape=2.0, scale=8.0, size=n), 0, None)
    messages_sent = np.clip(RNG.gamma(shape=2.0, scale=5.0, size=n), 0, None)
    commits = np.clip(RNG.gamma(shape=1.8, scale=4.0, size=n), 0, None)
    deadline_adherence_pct = np.clip(RNG.normal(70, 22, n), 0, 100)
    active_days_last7 = np.clip(RNG.normal(4.5, 2.2, n), 0, 7)

    # Composite latent "true effort" score used to derive the label.
    latent = (
        0.30 * (tasks_completed_pct / 100)
        + 0.20 * (np.tanh(doc_edits / 20))
        + 0.15 * (np.tanh(messages_sent / 15))
        + 0.15 * (np.tanh(commits / 10))
        + 0.15 * (deadline_adherence_pct / 100)
        + 0.05 * (active_days_last7 / 7)
    )
    noise = RNG.normal(0, 0.07, n)
    risk_prob = 1 - np.clip(latent + noise, 0, 1)
    label = (risk_prob > 0.45).astype(int)  # 1 = at-risk / likely free-riding

    df = pd.DataFrame(
        {
            "tasks_completed_pct": tasks_completed_pct,
            "doc_edits": doc_edits,
            "messages_sent": messages_sent,
            "commits": commits,
            "deadline_adherence_pct": deadline_adherence_pct,
            "active_days_last7": active_days_last7,
            "risk_label": label,
        }
    )
    return df


def build_model(input_dim):
    model = keras.Sequential(
        [
            keras.layers.Input(shape=(input_dim,)),
            keras.layers.Dense(16, activation="relu"),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(8, activation="relu"),
            keras.layers.Dense(1, activation="sigmoid"),
        ]
    )
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def main():
    df = simulate_dataset()
    df.to_csv("dataset.csv", index=False)

    X = df[FEATURE_NAMES].values
    y = df["risk_label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = build_model(X_train_s.shape[1])
    early_stop = keras.callbacks.EarlyStopping(
        monitor="val_loss", patience=8, restore_best_weights=True
    )
    history = model.fit(
        X_train_s,
        y_train,
        validation_split=0.15,
        epochs=100,
        batch_size=32,
        callbacks=[early_stop],
        verbose=0,
    )

    y_prob = model.predict(X_test_s, verbose=0).ravel()
    y_pred = (y_prob > 0.5).astype(int)

    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred),
        "recall": recall_score(y_test, y_pred),
        "f1_score": f1_score(y_test, y_pred),
        "roc_auc": roc_auc_score(y_test, y_prob),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "epochs_trained": len(history.history["loss"]),
        "n_train": len(X_train),
        "n_test": len(X_test),
    }

    print(json.dumps(metrics, indent=2))

    model.save("model.h5")
    joblib.dump(scaler, "scaler.pkl")
    with open("metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open("feature_names.json", "w") as f:
        json.dump(FEATURE_NAMES, f)

    print("\nSaved model.h5, scaler.pkl, metrics.json, feature_names.json, dataset.csv")


if __name__ == "__main__":
    main()
