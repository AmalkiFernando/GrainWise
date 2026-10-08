
from __future__ import annotations
import numpy as np, pandas as pd
from sklearn.base import clone
from sklearn.model_selection import (train_test_split, StratifiedKFold,
                                     RepeatedStratifiedKFold, cross_validate)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

RANDOM_STATE   = 42
TEST_SIZE      = 0.20
POSITIVE_CLASS = "Cammeo"          # the premium variety = class 1
DATASET_DOI    = "10.24432/C5MW4Z"

# <<< EACH MEMBER: set this to YOUR Drive path, or do rs.DATA_PATH = "..." after import >>>
DATA_PATH = "/content/drive/MyDrive/GrainWise_Project_ML/Rice_Cammeo_Osmancik.arff"

EXPECTED       = ["Area", "Perimeter", "Major_Axis_Length", "Minor_Axis_Length",
                  "Eccentricity", "Convex_Area", "Extent", "Class"]
RAW_FEATURES   = ["Area", "Perimeter", "Major_Axis_Length", "Minor_Axis_Length",
                  "Eccentricity", "Convex_Area", "Extent"]
RATIO_FEATURES = ["Aspect_Ratio", "Roundness", "Solidity"]

# EVIDENCE (Notebook 1, training partition):
#   Area ~ Convex_Area r=0.9989; VIF 30,902 / 32,541. Only Extent has VIF < 10.
#   Aspect_Ratio ~ Eccentricity r=0.9828, IDENTICAL univariate AUC 0.8571 - eccentricity
#   is a deterministic transform of the axis ratio, so Aspect_Ratio is engineered
#   redundancy. Dropped from every set except "all", where it stays visible as a finding.
FEATURE_SETS = {
    "all":          RAW_FEATURES + RATIO_FEATURES,
    "raw":          RAW_FEATURES,
    # scale-invariant: no pixel-unit features, so it transfers to another imaging rig
    "invariant":    ["Eccentricity", "Extent", "Roundness", "Solidity"],
    # resolved at runtime by greedy VIF elimination on the TRAINING partition only
    "decorrelated": None,
}

VIF_THRESHOLD = 10.0


def greedy_vif_select(X: pd.DataFrame, threshold: float = VIF_THRESHOLD) -> list:
    """Drop the highest-VIF feature until all remaining are under threshold.
    Fitted on the training partition only, and deterministic, so every member
    gets the same list without passing files around."""
    from statsmodels.stats.outliers_influence import variance_inflation_factor
    from sklearn.preprocessing import StandardScaler
    cols = list(X.columns)
    while len(cols) > 1:
        Z = StandardScaler().fit_transform(X[cols])
        vifs = []
        for i in range(len(cols)):
            try:
                v = variance_inflation_factor(Z, i)
                vifs.append(np.inf if not np.isfinite(v) else v)
            except Exception:
                vifs.append(np.inf)
        worst = int(np.argmax(vifs))
        if vifs[worst] <= threshold:
            break
        cols.pop(worst)
    return cols

SCORING = {"accuracy": "accuracy", "balanced_accuracy": "balanced_accuracy",
           "precision": "precision", "recall": "recall",
           "f1": "f1", "roc_auc": "roc_auc"}

CV       = RepeatedStratifiedKFold(n_splits=10, n_repeats=3, random_state=RANDOM_STATE)
INNER_CV = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

_cache = {}


def load_raw(path: str | None = None) -> pd.DataFrame:
    """Reads .arff / .csv / .xlsx and normalises columns. Each member sets
    rs.DATA_PATH to their own Drive path after importing."""
    path = path or DATA_PATH
    if _cache.get("path") != path:
        p = str(path).lower()
        if p.endswith(".arff"):
            cols, rows, in_data = [], [], False
            with open(path, "r", errors="ignore") as f:
                for line in f:
                    s = line.strip()
                    if not s or s.startswith("%"):
                        continue
                    low = s.lower()
                    if low.startswith("@attribute"):
                        cols.append(s.split()[1].strip("'\""))
                    elif low.startswith("@data"):
                        in_data = True
                    elif in_data:
                        rows.append([v.strip().strip("'\"") for v in s.split(",")])
            d = pd.DataFrame(rows, columns=cols)
        elif p.endswith((".xlsx", ".xls")):
            d = pd.read_excel(path)
        else:
            d = pd.read_csv(path)

        d.columns = [str(c).strip().replace(" ", "_") for c in d.columns]
        d = d.rename(columns={c: e for c in d.columns for e in EXPECTED
                              if c.lower() == e.lower()})
        missing = [c for c in EXPECTED if c not in d.columns]
        if missing:
            raise ValueError(f"Missing columns {missing}.\nFound: {list(d.columns)}")
        d = d[EXPECTED].copy()
        for c in EXPECTED[:-1]:
            d[c] = pd.to_numeric(d[c], errors="coerce")
        d["Class"] = d["Class"].astype(str).str.strip().str.capitalize()
        _cache["path"], _cache["raw"] = path, d
    return _cache["raw"].copy()


def add_ratio_features(d: pd.DataFrame) -> pd.DataFrame:
    """Row-wise arithmetic only — safe to compute before the split."""
    d = d.copy()
    d["Aspect_Ratio"] = d["Major_Axis_Length"] / d["Minor_Axis_Length"]
    d["Roundness"]    = 4 * np.pi * d["Area"] / (d["Perimeter"] ** 2)
    d["Solidity"]     = d["Area"] / d["Convex_Area"]
    return d


def get_split(feature_set: str = "all", seed: int = RANDOM_STATE):
    """Identical partition for every member. Returns X_train, X_test, y_train, y_test."""
    if feature_set not in FEATURE_SETS:
        raise KeyError(f"feature_set must be one of {list(FEATURE_SETS)}")
    d = add_ratio_features(load_raw())
    y = (d["Class"] == POSITIVE_CLASS).astype(int)
    cols = FEATURE_SETS[feature_set]
    if cols is None:                      # "decorrelated" - derive from TRAIN only
        key = ("decorr", seed)
        if key not in _cache:
            Xtr_full, _, _, _ = train_test_split(
                d[FEATURE_SETS["all"]], y, test_size=TEST_SIZE,
                stratify=y, random_state=seed)
            _cache[key] = greedy_vif_select(Xtr_full)
        cols = _cache[key]
    return train_test_split(d[cols], y, test_size=TEST_SIZE,
                            stratify=y, random_state=seed)


def make_pipeline(model, scale: bool = True) -> Pipeline:
    """scale=True for SVM / kNN / LogReg; scale=False for trees and ensembles."""
    steps = []
    if scale:
        steps.append(("scaler", StandardScaler()))
    steps.append(("model", model))
    return Pipeline(steps)


def score(model, X, y, name=None, scale=True, cv=CV):
    """Returns (summary_row_dict, per_fold_arrays). Same schema for all four members."""
    pipe = make_pipeline(clone(model), scale=scale)
    res = cross_validate(pipe, X, y, cv=cv, scoring=SCORING,
                         n_jobs=-1, return_train_score=False)
    row = {"model": name or model.__class__.__name__, "scaled": scale}
    for m in SCORING:
        row[f"{m}_mean"] = res["test_" + m].mean()
        row[f"{m}_std"]  = res["test_" + m].std()
    row["fit_time_s"] = res["fit_time"].mean()
    return row, res


def save_results(row, res, path):
    """Write one member's result so the comparison table assembles itself."""
    pd.DataFrame([row]).to_csv(path, index=False)
    np.save(path.replace(".csv", "_folds.npy"), res["test_accuracy"])
    print("saved:", path)
