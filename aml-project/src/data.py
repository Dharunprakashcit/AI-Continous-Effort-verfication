"""Data loading, validation and feature engineering for the UCI Student Performance data."""
import os

import numpy as np
import pandas as pd
import yaml
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BINARY = ["school", "sex", "address", "famsize", "Pstatus", "schoolsup", "famsup",
          "paid", "activities", "nursery", "higher", "internet", "romantic"]
NOMINAL = ["Mjob", "Fjob", "reason", "guardian", "course"]
GRADES = {"A": ["G1", "G2"], "B": ["G1"], "C": []}


def load_config():
    with open(os.path.join(ROOT, "config.yaml")) as f:
        return yaml.safe_load(f)


def load_raw(cfg):
    frames = []
    for name in cfg["data"]["files"]:
        df = pd.read_csv(os.path.join(ROOT, cfg["data"]["raw_dir"], name), sep=";")
        df["course"] = "mat" if "mat" in name else "por"
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    for g in ["G1", "G2", "G3"]:
        df[g] = pd.to_numeric(df[g], errors="coerce")
    return df


def validate(df):
    """Schema and range checks; returns a report dict."""
    issues = []
    if df.isna().any().any():
        issues.append({"missing": df.isna().sum()[lambda s: s > 0].to_dict()})
    for col, lo, hi in [("age", 15, 22), ("absences", 0, 93), ("G1", 0, 20), ("G2", 0, 20), ("G3", 0, 20)]:
        bad = int(((df[col] < lo) | (df[col] > hi)).sum())
        if bad:
            issues.append({"out_of_range": col, "rows": bad})
    return {"rows": len(df), "columns": df.shape[1], "issues": issues,
            "duplicates": int(df.duplicated().sum()), "passed": not issues}


def engineer(df, pass_mark=10):
    """Domain features on top of the raw columns."""
    df = df.copy()
    df["pass"] = (df["G3"] >= pass_mark).astype(int)
    df["parent_edu"] = df["Medu"] + df["Fedu"]
    df["alcohol"] = (5 * df["Dalc"] + 2 * df["Walc"]) / 7          # weekly-weighted consumption
    df["support"] = (df["schoolsup"] == "yes").astype(int) + (df["famsup"] == "yes").astype(int) + (df["paid"] == "yes").astype(int)
    df["social"] = df["goout"] + df["freetime"] - df["studytime"]
    df["log_absences"] = np.log1p(df["absences"])
    df["has_failed"] = (df["failures"] > 0).astype(int)
    return df


def feature_columns(df, setup):
    drop = {"G1", "G2", "G3", "pass"} - set(GRADES[setup])
    cols = [c for c in df.columns if c not in drop]
    cat = [c for c in cols if c in BINARY + NOMINAL]
    num = [c for c in cols if c not in cat]
    return num, cat


def preprocessor(num, cat):
    return ColumnTransformer([
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num),
        ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")),
                          ("oh", OneHotEncoder(handle_unknown="ignore", drop="if_binary", sparse_output=False))]), cat),
    ])


def dataset(cfg, setup=None, course=None):
    setup = setup or cfg["data"]["primary_setup"]
    df = engineer(load_raw(cfg), cfg["data"]["pass_mark"])
    if course:
        df = df[df["course"] == course].reset_index(drop=True)
    num, cat = feature_columns(df, setup)
    return df[num + cat], df["pass"].values, num, cat
