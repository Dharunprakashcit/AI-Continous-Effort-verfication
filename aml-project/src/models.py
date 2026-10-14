"""Model zoo and Optuna search spaces."""
from catboost import CatBoostClassifier
from lightgbm import LGBMClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from xgboost import XGBClassifier


def build(name, params, seed):
    p = dict(params)
    if name == "LogisticRegression":
        return LogisticRegression(max_iter=2000, class_weight="balanced", **p)
    if name == "RandomForest":
        return RandomForestClassifier(random_state=seed, n_jobs=-1, class_weight="balanced", **p)
    if name == "MLP":
        return MLPClassifier(max_iter=1500, early_stopping=True, random_state=seed, **p)
    if name == "XGBoost":
        return XGBClassifier(random_state=seed, n_jobs=-1, eval_metric="logloss", **p)
    if name == "LightGBM":
        return LGBMClassifier(random_state=seed, n_jobs=-1, verbose=-1, **p)
    if name == "CatBoost":
        return CatBoostClassifier(random_seed=seed, verbose=0, thread_count=-1, **p)
    raise ValueError(name)


def space(name, trial):
    """Optuna search space per model (Bayesian optimisation with TPE)."""
    if name == "LogisticRegression":
        return {"C": trial.suggest_float("C", 1e-3, 10, log=True)}
    if name == "RandomForest":
        return {"n_estimators": trial.suggest_int("n_estimators", 100, 500, step=50),
                "max_depth": trial.suggest_int("max_depth", 3, 20),
                "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 10),
                "max_features": trial.suggest_categorical("max_features", ["sqrt", "log2", 0.5])}
    if name == "MLP":
        return {"hidden_layer_sizes": trial.suggest_categorical("hidden_layer_sizes", [(32,), (64, 32), (32, 16), (128, 64)]),
                "alpha": trial.suggest_float("alpha", 1e-5, 1e-1, log=True),
                "learning_rate_init": trial.suggest_float("learning_rate_init", 1e-4, 1e-2, log=True)}
    if name == "XGBoost":
        return {"n_estimators": trial.suggest_int("n_estimators", 100, 600, step=50),
                "max_depth": trial.suggest_int("max_depth", 2, 8),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
                "subsample": trial.suggest_float("subsample", 0.6, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
                "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10, log=True),
                "min_child_weight": trial.suggest_int("min_child_weight", 1, 10)}
    if name == "LightGBM":
        return {"n_estimators": trial.suggest_int("n_estimators", 100, 600, step=50),
                "num_leaves": trial.suggest_int("num_leaves", 8, 64),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
                "subsample": trial.suggest_float("subsample", 0.6, 1.0),
                "subsample_freq": 1,
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
                "min_child_samples": trial.suggest_int("min_child_samples", 5, 50),
                "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10, log=True)}
    if name == "CatBoost":
        return {"iterations": trial.suggest_int("iterations", 200, 800, step=100),
                "depth": trial.suggest_int("depth", 3, 8),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
                "l2_leaf_reg": trial.suggest_float("l2_leaf_reg", 1, 10, log=True)}
    raise ValueError(name)


MODELS = ["LogisticRegression", "RandomForest", "MLP", "XGBoost", "LightGBM", "CatBoost"]
