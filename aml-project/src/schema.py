"""Input schema + validation shared by the Flask API and the Gradio UI."""
import pandas as pd

from .data import engineer

NUMERIC = {  # name: (min, max, default)
    "age": (15, 22, 17), "Medu": (0, 4, 2), "Fedu": (0, 4, 2), "traveltime": (1, 4, 1),
    "studytime": (1, 4, 2), "failures": (0, 4, 0), "famrel": (1, 5, 4), "freetime": (1, 5, 3),
    "goout": (1, 5, 3), "Dalc": (1, 5, 1), "Walc": (1, 5, 2), "health": (1, 5, 3), "absences": (0, 93, 4),
}
CATEGORICAL = {
    "school": ["GP", "MS"], "sex": ["F", "M"], "address": ["U", "R"], "famsize": ["GT3", "LE3"],
    "Pstatus": ["T", "A"], "Mjob": ["at_home", "health", "other", "services", "teacher"],
    "Fjob": ["at_home", "health", "other", "services", "teacher"],
    "reason": ["course", "home", "reputation", "other"], "guardian": ["mother", "father", "other"],
    "schoolsup": ["no", "yes"], "famsup": ["no", "yes"], "paid": ["no", "yes"], "activities": ["no", "yes"],
    "nursery": ["yes", "no"], "higher": ["yes", "no"], "internet": ["yes", "no"], "romantic": ["no", "yes"],
    "course": ["por", "mat"],
}
FIELDS = list(NUMERIC) + list(CATEGORICAL)


def validate_record(rec):
    """Return (frame, errors). Missing fields fall back to defaults; bad values are errors."""
    errors, row = [], {}
    unknown = set(rec) - set(FIELDS)
    if unknown:
        errors.append(f"unknown fields: {sorted(unknown)}")
    for k, (lo, hi, d) in NUMERIC.items():
        v = rec.get(k, d)
        try:
            v = int(v)
        except (TypeError, ValueError):
            errors.append(f"{k} must be an integer"); continue
        if not lo <= v <= hi:
            errors.append(f"{k} must be in [{lo}, {hi}]")
        row[k] = v
    for k, opts in CATEGORICAL.items():
        v = rec.get(k, opts[0])
        if v not in opts:
            errors.append(f"{k} must be one of {opts}")
        row[k] = v
    if errors:
        return None, errors
    df = pd.DataFrame([row])
    df["G3"] = 0  # placeholder so engineer() can run; pass/G3 are dropped by the model's feature set
    return engineer(df).drop(columns=["G3", "pass"]), []
