"""
Tests for the GrainWise API. Run from the repository root:
    .venv/Scripts/python -m pytest app -q
"""
import math

import numpy as np
import pytest
from fastapi.testclient import TestClient

import api
import rice_shared as rs

client = TestClient(api.app)

# A real Cammeo grain (row 0 of the dataset).
CAMMEO = {"Area": 15231, "Perimeter": 525.579, "Major_Axis_Length": 229.7499,
          "Minor_Axis_Length": 85.0932, "Eccentricity": 0.9289, "Convex_Area": 15617,
          "Extent": 0.5729}


def predict(measurements, **extra):
    return client.post("/api/predict", json={"measurements": measurements, **extra})


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_model_info_reports_the_notebook_results():
    info = client.get("/api/model").json()
    assert info["name"] == "Logistic Regression"
    assert info["inputs"] == rs.RAW_FEATURES
    assert info["default_threshold"] == 0.805
    assert info["n_train"] == 3048
    ev = info["evaluation"]
    assert ev["n_test"] == 762
    # comparison_evaluation.ipynb, final test evaluation
    assert round(ev["roc_auc"], 3) == 0.978
    assert ev["thresholds"]["0.500"]["fp"] == 32 and ev["thresholds"]["0.500"]["fn"] == 24
    assert ev["thresholds"]["0.805"]["fp"] == 11 and ev["thresholds"]["0.805"]["fn"] == 61
    assert round(ev["one_feature_baseline"]["accuracy"], 4) == 0.9160
    assert {r["model"] for r in info["cv_comparison"]} >= {
        "Logistic Regression", "Random Forest", "Support Vector Machine", "k-Nearest Neighbours"}


def test_prediction_matches_the_pipeline_directly():
    """The API's path (raw inputs -> add_ratio_features -> model) must give the same probability
    as running the saved pipeline on the notebook's own feature frame."""
    import pandas as pd
    body = predict(CAMMEO).json()
    frame = rs.add_ratio_features(pd.DataFrame([CAMMEO]))[api.STATE["features"]]
    expected = api.STATE["model"].predict_proba(frame)[0, 1]
    assert body["probability"]["Cammeo"] == pytest.approx(expected, abs=1e-12)
    assert body["variety"] == "Cammeo"
    assert body["threshold"] == 0.805


def test_explanation_adds_up_to_the_probability():
    body = predict(CAMMEO).json()
    exp = body["explanation"]
    total = exp["intercept"] + sum(t["contribution"] for t in exp["terms"])
    assert total == pytest.approx(exp["log_odds"])
    assert 1 / (1 + math.exp(-exp["log_odds"])) == pytest.approx(body["probability"]["Cammeo"])
    assert len(exp["terms"]) == 10


def test_eccentricity_is_derived_when_omitted():
    no_ecc = {k: v for k, v in CAMMEO.items() if k != "Eccentricity"}
    body = predict(no_ecc).json()
    expected = math.sqrt(1 - (85.0932 / 229.7499) ** 2)
    assert body["measurements"]["Eccentricity"] == pytest.approx(expected)
    assert not [w for w in body["warnings"] if w["kind"] == "inconsistent"]


def test_inconsistent_eccentricity_warns():
    body = predict({**CAMMEO, "Eccentricity": 0.80}).json()
    assert any(w["kind"] == "inconsistent" and w["feature"] == "Eccentricity"
               for w in body["warnings"])


def test_out_of_range_input_warns_but_still_predicts():
    r = predict({**CAMMEO, "Area": 30000, "Convex_Area": 30500})
    assert r.status_code == 200
    assert any(w["feature"] == "Area" and w["kind"] == "out_of_range"
               for w in r.json()["warnings"])


def test_threshold_changes_the_decision():
    # A real borderline Cammeo grain, P(Cammeo) ~ 0.59: Cammeo at 1:1 costs, Osmancik at 5:1.
    borderline = {"Area": 13176, "Perimeter": 458.343, "Major_Axis_Length": 193.3374,
                  "Minor_Axis_Length": 87.4484, "Convex_Area": 13368, "Extent": 0.6407}
    body = predict(borderline).json()
    assert 0.5 < body["probability"]["Cammeo"] < 0.7
    assert body["variety"] == "Osmancik"
    assert predict(borderline, threshold=0.485).json()["variety"] == "Cammeo"


@pytest.mark.parametrize("patch, field", [
    ({"Area": -5}, "Area"),
    ({"Area": 0}, "Area"),
    ({"Eccentricity": 1.2}, "Eccentricity"),
    ({"Extent": 1.5}, "Extent"),
    ({"Minor_Axis_Length": 300}, "Minor_Axis_Length"),
    ({"Convex_Area": 100}, "Convex_Area"),
    ({"Perimeter": "abc"}, "Perimeter"),
])
def test_invalid_measurements_are_rejected_with_the_field(patch, field):
    r = predict({**CAMMEO, **patch})
    assert r.status_code == 422
    assert any(field in err["loc"] for err in r.json()["detail"])


def test_missing_field_and_unknown_field_are_rejected():
    assert predict({k: v for k, v in CAMMEO.items() if k != "Perimeter"}).status_code == 422
    assert predict({**CAMMEO, "Colour": 3}).status_code == 422


@pytest.mark.parametrize("threshold", [0, 1, -0.2, 1.5])
def test_threshold_out_of_bounds_is_rejected(threshold):
    assert predict(CAMMEO, threshold=threshold).status_code == 422


def test_samples_are_held_out_test_grains_and_mostly_classified_right():
    samples = client.get("/api/samples").json()
    assert len(samples) == 2 * api.SAMPLES_PER_CLASS
    rs.DATA_PATH = str(api.DATA_PATH)
    _, X_te, _, _ = rs.get_split("all")
    assert {s["id"] for s in samples} <= set(X_te.index)
    hits = [predict(s["measurements"], threshold=0.5).json()["variety"] == s["variety"]
            for s in samples]
    assert np.mean(hits) >= 0.8


def test_unknown_api_route_is_404_json():
    r = client.get("/api/nope")
    assert r.status_code == 404
    assert "detail" in r.json()
