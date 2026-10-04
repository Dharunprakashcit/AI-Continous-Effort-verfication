"""
Closes the MLOps loop: pulls faculty-reviewed predictions from the backend,
turns them into labelled rows, appends them to the dataset, then retrains
the ANN and reruns the AML comparison pipeline.

  python retrain.py --token <faculty JWT> [--api http://localhost:5000]
  python retrain.py --feedback-file feedback.json     # offline alternative
"""
import argparse
import json
import urllib.request

import pandas as pd

import aml_pipeline
import train_model

FEATURES = train_model.FEATURE_NAMES


def fetch_feedback(api, token):
    req = urllib.request.Request(
        f"{api}/api/faculty/feedback-export", headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.load(resp)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:5000")
    parser.add_argument("--token")
    parser.add_argument("--feedback-file")
    args = parser.parse_args()

    if args.feedback_file:
        rows = json.load(open(args.feedback_file))
    elif args.token:
        rows = fetch_feedback(args.api, args.token)
    else:
        raise SystemExit("Provide --token or --feedback-file")

    if not rows:
        raise SystemExit("No faculty feedback available yet; nothing to retrain on.")

    new = pd.DataFrame(rows)[FEATURES + ["risk_label"]]
    base = pd.read_csv("dataset.csv")
    merged = pd.concat([base, new], ignore_index=True)
    merged.to_csv("dataset.csv", index=False)
    print(f"Added {len(new)} feedback rows -> dataset now {len(merged)} rows")

    train_model.main()
    aml_pipeline.main()
    print("Retrained. Restart predict_service.py to serve the new model.")


if __name__ == "__main__":
    main()
