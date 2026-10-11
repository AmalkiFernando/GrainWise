# GrainWise

Classifying rice grains as **Cammeo** (premium) or **Osmancik** (standard) from seven shape
measurements, using the Cammeo/Osmancik dataset (Cinar & Koklu, 2019; 3,810 grains,
DOI [10.24432/C5MW4Z](https://doi.org/10.24432/C5MW4Z)).

| Folder | What's in it |
| --- | --- |
| `NoteBooks/` | EDA, the shared pipeline, one notebook per model, and `comparison_evaluation.ipynb` (model comparison, cost-tuned threshold, final test) |
| `Shared_Dataset/rice_shared.py` | The shared split, feature engineering and scoring code every notebook uses |
| `Results/` | Each member's cross-validation results |
| `FinalModel/`, `app/grainwise_model.pkl` | The final model: standardised Logistic Regression on 10 features |
| `app/` | The prediction API (FastAPI) |
| `frontend/` | The web UI (React + Vite + Tailwind) |

## The app

Type one grain's measurements (or load a real grain from the held-out test set) and the app shows
the predicted variety, P(Cammeo) against the decision threshold, the derived shape ratios, and
which measurements pushed the call each way. The threshold is chosen by cost ratio (how much worse
a false "Cammeo" is than a missed one), using the cost-minimising thresholds from the notebook;
5:1 → 0.805 is the default.

`frontend/src/features/model/ModelPage.tsx` is a model-card page (test-set results, the comparison
of all four models, coefficients). It is kept in the code but not shown in the app; see
`frontend/src/app/routes.tsx` to turn it back on.

Eccentricity is filled in automatically from the two axis lengths
(√(1 − (minor ÷ major)²), which is exactly how the dataset defines it), and the three ratio
features are derived on the server with `rice_shared.add_ratio_features`, the same code the model
was trained through.

### Requirements

- Python 3.12
- Node.js 20 or newer

### First-time setup

From the repository root:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r app/requirements.txt
cd frontend
npm install
```

On macOS/Linux use `.venv/bin/python` instead of `.venv/Scripts/python`.

`app/requirements.txt` pins scikit-learn 1.6.1, the version `app/grainwise_model.pkl` was saved
with, so the model loads without a version warning.

### Run the app

**One server (built UI).** Build the UI once, then start the API, which serves it:

```bash
cd frontend
npm run build
cd ..
.venv/Scripts/python -m uvicorn api:app --app-dir app --port 8000
```

Open http://127.0.0.1:8000.

**Development (live reload).** Run the API and the Vite dev server side by side:

```bash
.venv/Scripts/python -m uvicorn api:app --app-dir app --port 8000 --reload
```

```bash
cd frontend
npm run dev
```

Open http://127.0.0.1:5173. Vite forwards `/api` requests to port 8000.

### API

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | `/api/health` | `{"status": "ok"}` |
| `GET` | `/api/model` | Model parameters, feature ranges, threshold presets, test-set and CV results |
| `GET` | `/api/samples` | 24 held-out test grains (12 per variety) |
| `POST` | `/api/predict` | Variety, probabilities, derived ratios, per-feature explanation, warnings |

```json
POST /api/predict
{
  "measurements": {
    "Area": 15231, "Perimeter": 525.579, "Major_Axis_Length": 229.7499,
    "Minor_Axis_Length": 85.0932, "Convex_Area": 15617, "Extent": 0.5729
  },
  "threshold": 0.805
}
```

`Eccentricity` and `threshold` are optional. Impossible values (negative sizes, a minor axis
longer than the major, a convex area smaller than the area) are rejected with a 422. Values
outside the training range are still predicted, with a warning. Interactive docs are at
http://127.0.0.1:8000/docs.

### Tests

```bash
.venv/Scripts/python -m pytest app -q
cd frontend
npm test -- --run
npm run lint
```
