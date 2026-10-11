"""
GrainWise prediction API.

Serves the final model chosen in NoteBooks/comparison_evaluation.ipynb (a scaled Logistic
Regression on the "all" feature set) to the web UI in frontend/. The user types the seven
measurements the imaging rig produces for one grain; the three ratio features are derived here
with rice_shared.add_ratio_features, the same code the model was trained through, so the UI can
never drift from the notebook's feature pipeline.

Run from the repository root:
    .venv/Scripts/python -m uvicorn api:app --app-dir app --port 8000

If frontend/dist exists (after `npm run build`), the built UI is served from the same port.
"""
from __future__ import annotations

import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator
from sklearn.metrics import confusion_matrix, roc_auc_score
from sklearn.tree import DecisionTreeClassifier

import rice_shared as rs

APP_DIR = Path(__file__).resolve().parent
REPO_DIR = APP_DIR.parent
MODEL_PATH = APP_DIR / "grainwise_model.pkl"
DATA_PATH = REPO_DIR / "Original_Dataset" / "Rice_Cammeo_Osmancik.arff"
RESULTS_DIR = REPO_DIR / "Results"
FRONTEND_DIST = REPO_DIR / "frontend" / "dist"

POSITIVE_CLASS = rs.POSITIVE_CLASS      # "Cammeo", the premium variety = class 1
NEGATIVE_CLASS = "Osmancik"

# Cost-minimising thresholds from comparison_evaluation.ipynb section 3, cross-validated on the
# training partition. cost_ratio is how many times worse it is to sell an Osmancik grain as
# Cammeo (a false positive: overpaying, adulterating a premium batch) than the reverse.
THRESHOLD_PRESETS = [
    {"cost_ratio": 1, "threshold": 0.485},
    {"cost_ratio": 2, "threshold": 0.615},
    {"cost_ratio": 5, "threshold": 0.805},
    {"cost_ratio": 10, "threshold": 0.900},
    {"cost_ratio": 20, "threshold": 0.935},
]
DEFAULT_THRESHOLD = 0.805               # the 5:1 operating point the notebook evaluated

# Eccentricity in this dataset is exactly sqrt(1 - (minor/major)^2) (residuals < 1e-7), so a typed
# value further than this from the one the axes imply means the inputs don't describe one grain.
ECCENTRICITY_TOLERANCE = 0.005

SAMPLES_PER_CLASS = 12

MODEL_NAMES = {
    "LogisticRegression": "Logistic Regression",
    "SVC": "Support Vector Machine",
    "KNeighborsClassifier": "k-Nearest Neighbours",
    "RandomForestClassifier": "Random Forest",
}


def implied_eccentricity(major: float, minor: float) -> float:
    return math.sqrt(max(0.0, 1.0 - (minor / major) ** 2))


# --------------------------------------------------------------------------- startup

def _load_model():
    if not MODEL_PATH.exists():
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")
    model = joblib.load(MODEL_PATH)
    features = list(getattr(model, "feature_names_in_", []))
    known = set(rs.RAW_FEATURES + rs.RATIO_FEATURES)
    if not features or not set(features) <= known:
        raise RuntimeError(f"{MODEL_PATH.name} expects features {features}; "
                           f"the API can only build {sorted(known)}.")
    return model, features


def _feature_stats(X: pd.DataFrame, y: pd.Series) -> dict:
    """Training-partition ranges, used for input hints and out-of-range warnings."""
    stats = {}
    for col in X.columns:
        s = X[col]
        stats[col] = {
            "min": float(s.min()), "max": float(s.max()), "mean": float(s.mean()),
            "class_means": {POSITIVE_CLASS: float(s[y == 1].mean()),
                            NEGATIVE_CLASS: float(s[y == 0].mean())},
        }
    return stats


def _confusion_row(y_true, y_pred) -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    n = tn + fp + fn + tp
    return {
        "accuracy": (tp + tn) / n,
        "precision": tp / (tp + fp) if tp + fp else 0.0,
        "recall": tp / (tp + fn) if tp + fn else 0.0,
        "tp": int(tp), "tn": int(tn), "fp": int(fp), "fn": int(fn),
    }


def _test_evaluation(model, features, X_tr, X_te, y_tr, y_te) -> dict:
    """The sealed-test numbers from the notebook's final evaluation, recomputed from the loaded
    model so the UI always reports what this exact file does."""
    p = model.predict_proba(X_te[features])[:, 1]
    at = {}
    for t in (0.5, DEFAULT_THRESHOLD):
        row = _confusion_row(y_te, (p >= t).astype(int))
        row["threshold"] = t
        row["cost_5_to_1"] = row["fp"] * 5 + row["fn"]
        at[f"{t:.3f}"] = row

    stump = DecisionTreeClassifier(max_depth=1, random_state=rs.RANDOM_STATE)
    stump.fit(X_tr[features], y_tr)
    base = _confusion_row(y_te, stump.predict(X_te[features]))
    base["feature"] = features[int(stump.tree_.feature[0])]
    base["cost_5_to_1"] = base["fp"] * 5 + base["fn"]

    return {"n_test": int(len(y_te)), "roc_auc": float(roc_auc_score(y_te, p)),
            "thresholds": at, "one_feature_baseline": base}


def _cv_comparison() -> list[dict]:
    """Each member's cross-validated result, read from Results/<member> - <model>/results_*.csv."""
    rows, seen = [], set()
    for path in sorted(RESULTS_DIR.glob("*/results_*.csv")):
        try:
            df = pd.read_csv(path)
        except Exception:
            continue
        for rec in df.to_dict("records"):
            name = str(rec.get("model", "")).strip()
            if not name or name in seen:
                continue
            seen.add(name)
            rows.append({
                "model": name,
                "member": path.parent.name.split(" - ")[0].strip(),
                **{k: float(rec[k]) for k in (
                    "accuracy_mean", "accuracy_std", "precision_mean", "recall_mean",
                    "f1_mean", "roc_auc_mean", "fit_time_s") if k in rec},
            })
    return sorted(rows, key=lambda r: -r.get("accuracy_mean", 0))


def _samples(X_te: pd.DataFrame, y_te: pd.Series) -> list[dict]:
    """Real grains from the held-out test partition, which the model never trained on."""
    out = []
    for label, name in ((1, POSITIVE_CLASS), (0, NEGATIVE_CLASS)):
        idx = y_te[y_te == label].sample(SAMPLES_PER_CLASS, random_state=rs.RANDOM_STATE).index
        for i in idx:
            out.append({"id": int(i), "variety": name,
                        "measurements": {c: float(X_te.at[i, c]) for c in rs.RAW_FEATURES}})
    return out


def _build_state() -> dict:
    model, features = _load_model()
    rs.DATA_PATH = str(DATA_PATH)
    X_tr, X_te, y_tr, y_te = rs.get_split("all")
    estimator = model.steps[-1][1] if hasattr(model, "steps") else model
    scaler = getattr(model, "named_steps", {}).get("scaler")
    return {
        "model": model,
        "features": features,
        "estimator": estimator,
        "scaler": scaler,
        "stats": _feature_stats(X_tr, y_tr),
        "n_train": int(len(y_tr)),
        "evaluation": _test_evaluation(model, features, X_tr, X_te, y_tr, y_te),
        "cv": _cv_comparison(),
        "samples": _samples(X_te, y_te),
    }


STATE = _build_state()


# --------------------------------------------------------------------------- schemas

def _positive(description: str):
    return Field(gt=0, allow_inf_nan=False, description=description)


class GrainMeasurements(BaseModel):
    """The seven measurements the imaging rig produces for one grain (pixels where sized)."""
    model_config = ConfigDict(extra="forbid")

    Area: float = _positive("Pixels inside the grain's boundary")
    Perimeter: float = _positive("Length of the grain's boundary, in pixels")
    Major_Axis_Length: float = _positive("Longest axis of the fitted ellipse, in pixels")
    Minor_Axis_Length: float = _positive("Shortest axis of the fitted ellipse, in pixels")
    Eccentricity: float | None = Field(
        default=None, ge=0, lt=1, allow_inf_nan=False,
        description="0 = circle, towards 1 = a line. Calculated from the axes when omitted.")
    Convex_Area: float = _positive("Pixels inside the smallest convex shape around the grain")
    Extent: float = Field(gt=0, le=1, allow_inf_nan=False,
                          description="Grain area / bounding-box area")

    @field_validator("Minor_Axis_Length")
    @classmethod
    def _minor_within_major(cls, v: float, info: ValidationInfo) -> float:
        major = info.data.get("Major_Axis_Length")
        if major is not None and v > major:
            raise ValueError("can't be longer than the major axis length")
        return v

    @field_validator("Convex_Area")
    @classmethod
    def _convex_covers_area(cls, v: float, info: ValidationInfo) -> float:
        area = info.data.get("Area")
        if area is not None and v < area:
            raise ValueError("can't be smaller than the area; the convex hull encloses the grain")
        return v


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    measurements: GrainMeasurements
    threshold: float | None = Field(
        default=None, gt=0, lt=1, allow_inf_nan=False,
        description="Decision threshold on P(Cammeo). Defaults to the 5:1 cost-tuned 0.805.")


# --------------------------------------------------------------------------- prediction

def _range_warning(feature: str, value: float) -> dict | None:
    s = STATE["stats"].get(feature)
    if s is None or s["min"] <= value <= s["max"]:
        return None
    side = "below" if value < s["min"] else "above"
    return {"feature": feature, "kind": "out_of_range", "value": value,
            "min": s["min"], "max": s["max"],
            "message": f"{feature.replace('_', ' ')} is {side} every grain the model was "
                       f"trained on ({s['min']:,.4g} to {s['max']:,.4g}), so the prediction "
                       f"is an extrapolation."}


def predict_one(m: GrainMeasurements, threshold: float) -> dict:
    raw = m.model_dump()
    warnings = []
    implied = implied_eccentricity(raw["Major_Axis_Length"], raw["Minor_Axis_Length"])
    if raw["Eccentricity"] is None:
        raw["Eccentricity"] = implied
    elif abs(raw["Eccentricity"] - implied) > ECCENTRICITY_TOLERANCE:
        warnings.append({
            "feature": "Eccentricity", "kind": "inconsistent", "value": raw["Eccentricity"],
            "expected": implied,
            "message": f"The axes imply an eccentricity of {implied:.4f}, but "
                       f"{raw['Eccentricity']:.4f} was entered. In the training data the two "
                       f"always match, so one of the three values is probably mistyped.",
        })

    frame = rs.add_ratio_features(pd.DataFrame([raw])[rs.RAW_FEATURES])
    X = frame[STATE["features"]]
    p = float(STATE["model"].predict_proba(X)[0, 1])

    for col in rs.RAW_FEATURES + rs.RATIO_FEATURES:
        w = _range_warning(col, float(frame.at[0, col]))
        if w:
            warnings.append(w)

    is_cammeo = p >= threshold
    return {
        "variety": POSITIVE_CLASS if is_cammeo else NEGATIVE_CLASS,
        "probability": {POSITIVE_CLASS: p, NEGATIVE_CLASS: 1.0 - p},
        "threshold": threshold,
        "margin": p - threshold,
        "measurements": {c: float(frame.at[0, c]) for c in rs.RAW_FEATURES},
        "derived": {c: float(frame.at[0, c]) for c in rs.RATIO_FEATURES},
        "explanation": _explain(X),
        "warnings": warnings,
    }


def _explain(X: pd.DataFrame) -> dict | None:
    """For a linear model, log-odds = intercept + sum(coef * standardised value), so each term
    is exactly how far that feature pushed this grain towards Cammeo (+) or Osmancik (-)."""
    est, scaler = STATE["estimator"], STATE["scaler"]
    if not hasattr(est, "coef_") or est.coef_.shape[0] != 1:
        return None
    x = X.to_numpy(dtype=float)[0]
    z = scaler.transform(X)[0] if scaler is not None else x
    coef = est.coef_[0]
    terms = [{"feature": f, "value": float(v), "z": float(zi), "contribution": float(c * zi)}
             for f, v, zi, c in zip(STATE["features"], x, z, coef)]
    terms.sort(key=lambda t: -abs(t["contribution"]))
    intercept = float(est.intercept_[0])
    return {"intercept": intercept,
            "log_odds": intercept + float(np.dot(coef, z)),
            "terms": terms}


# --------------------------------------------------------------------------- routes

app = FastAPI(title="GrainWise API", version="1.0.0",
              description="Classifies a rice grain as Cammeo or Osmancik from its shape.")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_PATH.name}


@app.get("/api/model")
def model_info() -> dict:
    est = STATE["estimator"]
    params = {k: v for k, v in est.get_params().items()
              if k in ("C", "penalty", "solver", "max_iter", "n_neighbors", "kernel",
                       "n_estimators", "max_depth")}
    coefficients = None
    if hasattr(est, "coef_") and est.coef_.shape[0] == 1:
        coefficients = sorted(
            ({"feature": f, "coefficient": float(c)}
             for f, c in zip(STATE["features"], est.coef_[0])),
            key=lambda r: -abs(r["coefficient"]))
    return {
        "name": MODEL_NAMES.get(type(est).__name__, type(est).__name__),
        "estimator": type(est).__name__,
        "params": params,
        "scaled": STATE["scaler"] is not None,
        "features": STATE["features"],
        "inputs": rs.RAW_FEATURES,
        "derived": rs.RATIO_FEATURES,
        "classes": {"positive": POSITIVE_CLASS, "negative": NEGATIVE_CLASS},
        "default_threshold": DEFAULT_THRESHOLD,
        "threshold_presets": THRESHOLD_PRESETS,
        "feature_stats": STATE["stats"],
        "n_train": STATE["n_train"],
        "coefficients": coefficients,
        "evaluation": STATE["evaluation"],
        "cv_comparison": STATE["cv"],
        "dataset_doi": rs.DATASET_DOI,
    }


@app.get("/api/samples")
def samples() -> list[dict]:
    return STATE["samples"]


@app.post("/api/predict")
def predict(req: PredictRequest) -> dict:
    threshold = DEFAULT_THRESHOLD if req.threshold is None else req.threshold
    return predict_one(req.measurements, threshold)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def api_not_found(path: str):
    raise HTTPException(status_code=404, detail=f"No API route /api/{path}")


# The built UI, when there is one. Any non-API path that isn't a real file gets index.html, so
# the client-side routes (/model) survive a refresh.
if FRONTEND_DIST.is_dir():
    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        target = (FRONTEND_DIST / path).resolve()
        if path and target.is_file() and FRONTEND_DIST.resolve() in target.parents:
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")
