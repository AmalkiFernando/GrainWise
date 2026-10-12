# GrainWise — Rice Variety Classification for Quality-Control Decision Support

**IT3091 Machine Learning · Group Assignment · Guided Data Track (Code 4: Agriculture)**

Can a rice mill verify a supplier's declared grain variety — Cammeo or Osmancik — from
cheap, image-derived shape measurements, and is a trained model worth deploying to do it?

We found that **no tuned model beats a single threshold on grain length at a statistically
detectable level**, and we recommend a model anyway — not for accuracy, but because it
outputs a probability that can be tuned to the mill's real cost asymmetry without
retraining. A working demo (API + web UI) is included so the model can actually be used,
not just reported on.

---

## Business framing

| | |
| --- | --- |
| **Stakeholder** | Quality-control manager at a rice processing mill |
| **Decision** | Does an incoming lot's claimed variety match its measured morphology, before payment? |
| **Primary lens** | Quality-control decision support — classification alone has no stakeholder or cost structure; framing it as a QC decision creates the cost asymmetry that justifies threshold tuning and a real recommendation |
| **Secondary lens** | Feature-importance analysis — which measurements an imaging rig must capture reliably |
| **Unit of analysis** | One rice grain (one image-derived row) |
| **Output** | P(Cammeo) per grain, thresholded against the mill's cost asymmetry |
| **Cost asymmetry** | Selling Osmancik as premium Cammeo is assumed worse than the reverse (5:1), swept 1:1 → 20:1 since we have no real stakeholder cost data |

We moved to the Guided Data Track after our original Industry Explorer attempt (AgriYield)
was undermined by dataset-quality problems. A curated dataset removed that risk inside a
short timeline — see `Decision_Logs/decision_log_FULL.csv`, D01–D02.

---

## Dataset

| | |
| --- | --- |
| Source | [UCI Rice (Cammeo and Osmancik)](https://archive.ics.uci.edu/dataset/545/rice-cammeo-and-osmancik) |
| DOI | `10.24432/C5MW4Z` |
| Licence | CC BY 4.0 |
| Instances | 3,810 grains |
| Features | 7 morphological, derived from grain images, plus 3 engineered ratio features |
| Target | Binary — Cammeo (1,630, 42.78%) / Osmancik (2,180, 57.22%) |
| Missing values / duplicates | None |
| SHA-256 (`Original_Dataset/Rice_Cammeo_Osmancik.arff`) | `1af97883100c89de2ea2972f7a28d428f4f1c14711a61defc0b0569e9eb65665` |
| Split | Stratified 80/20, seed 42 — train (3048, 10), test (762, 10), class balance 0.4278 in both |

**Raw features:** `Area`, `Perimeter`, `Major_Axis_Length`, `Minor_Axis_Length`,
`Eccentricity`, `Convex_Area`, `Extent`.
**Engineered features** (`rice_shared.add_ratio_features`): `Aspect_Ratio` (Major/Minor —
proved to be a deterministic transform of `Eccentricity`, reconstruction error 5.5×10⁻⁸),
`Roundness` (4π·Area/Perimeter²), `Solidity` (Area/Convex_Area).

---

## Headline results

Repeated stratified cross-validation, 10 splits × 3 repeats, on the training partition
(`Results/*/results_*.csv`):

| System | Accuracy | ROC-AUC | Fit time |
| --- | --- | --- | --- |
| Logistic Regression | 0.9307 ± 0.0117 | 0.9799 | 0.017 s |
| SVM (RBF, tuned, C=10, γ=0.01) | 0.9281 ± 0.0110 | 0.9799 | 0.970 s |
| **One threshold: `Major_Axis_Length ≤ 191.82`** | **0.9290 ± 0.0137** | 0.9272 | 0.013 s |
| k-Nearest Neighbours (k=25, distance-weighted) | 0.9280 ± 0.0117 | 0.9759 | 0.022 s |
| Random Forest (400 trees, depth 6) | 0.9274 ± 0.0113 | 0.9782 | 3.225 s |
| Majority-class baseline | 0.5722 ± 0.0015 | 0.5000 | — |

The entire spread across four independently-tuned models and the single-threshold baseline
is **0.33 percentage points** — smaller than the fold-to-fold standard deviation of any one
of them. Nadeau–Bengio corrected paired t-tests return p > 0.29 for every model-vs-model
pair, and McNemar's test against the single-threshold baseline (χ² = 0.0192, p = 0.8897)
finds no statistically detectable difference either.

### Final evaluation — sealed test set (762 grains), evaluated once

Final model: standardised **Logistic Regression**, C = 3.1623, L2, all 10 features,
recomputed live by the API from `app/grainwise_model.pkl` against the same held-out split:

| System | Threshold | Accuracy | FP | FN | Expected cost (5:1) |
| --- | --- | --- | --- | --- | --- |
| 1-threshold baseline | n/a | 0.9160 | 35 | 29 | 204 |
| Full model (default) | 0.500 | 0.9265 | 32 | 24 | 184 |
| **Full model (cost-tuned)** | **0.805** | 0.9055 | **11** | 61 | **116** |

ROC-AUC on the sealed test set: **0.978** (cross-validated estimate: 0.9799 — the 0.002 gap
is the project's main evidence against overfitting and leakage). Cammeo precision **0.9601**,
recall **0.8129** at the tuned threshold.

Two distinct, both-real findings from this table:
- Moving the *same* model's own threshold from 0.5 → 0.805 cuts its own expected cost from
  184 to 116 — a **37% reduction**, with no retraining.
- At that operating point the full model also beats the simple one-threshold baseline's cost
  (204) by **43%**, even though the two are statistically tied on raw accuracy.

**Cost-ratio sensitivity** (the 5:1 assumption is ours, not a real stakeholder figure — these
are the live presets served by `/api/model`):

| Cost ratio (FP:FN) | 1:1 | 2:1 | 5:1 | 10:1 | 20:1 |
| --- | --- | --- | --- | --- | --- |
| Optimal threshold | 0.485 | 0.615 | 0.805 | 0.900 | 0.935 |

---

## Key findings

1. **No model beats one threshold**, statistically (above).
2. **A feature we engineered already existed in the dataset.** `Aspect_Ratio` is a
   deterministic transform of `Eccentricity` (`e = sqrt(1 - 1/AR²)`), reconstruction error
   5.5×10⁻⁸ across all 3,810 grains.
3. **The full model's coefficients are not interpretable on their own.** VIF reaches
   ~32,500 for `Convex_Area` (`Area`~`Convex_Area` r = 0.9989). `Major_Axis_Length` and
   `Perimeter` — the two strongest single predictors — rank 6th and 10th by raw coefficient
   magnitude in the 10-feature model.
4. **The varieties differ mainly by size, not shape.** Restricting to scale-invariant
   features drops accuracy to ~0.79. Four of the seven raw features are pixel measurements,
   so the model is calibrated to one imaging rig and will not transfer without
   recalibration.
5. **Scaling matters, and we measured how much.** The identical tuned k-NN model scores
   0.9280 scaled vs 0.8887 unscaled on the training partition — a 3.94-point gap.
6. **Feature importance only agrees on the top feature.** Random Forest impurity
   importance, permutation importance, and SVM permutation importance all rank
   `Major_Axis_Length` first, but disagree below that — e.g. `Perimeter` ranks 2nd by RF
   impurity importance and 8th by SVM permutation importance. An earlier draft of this
   report claimed four methods converged on one ranking; that was wrong, and we corrected
   it once the SVM's permutation importance came in and contradicted it.

---

## The web app

Type one grain's measurements (or load a real grain from the held-out test set) and the
app shows the predicted variety, P(Cammeo) against the decision threshold, the derived
shape ratios, and which measurements pushed the call each way. The threshold is chosen by
cost ratio, using the cost-minimising thresholds from `comparison_evaluation.ipynb`; 5:1 →
0.805 is the default.

`frontend/src/features/model/ModelPage.tsx` is a model-card page (test-set results, the
comparison of all four models, coefficients). It is kept in the code but not shown in the
app; see `frontend/src/app/routes.tsx` to turn it back on.

`Eccentricity` is filled in automatically from the two axis lengths
(`√(1 − (minor ÷ major)²)`, exactly how the dataset defines it), and the three ratio
features are derived on the server with `rice_shared.add_ratio_features` — the same code
the model was trained through, so the UI can never drift from the notebooks' pipeline.

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

`app/requirements.txt` pins scikit-learn 1.6.1, the version `app/grainwise_model.pkl` was
saved with, so the model loads without a version warning.

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

`Eccentricity` and `threshold` are optional. Impossible values (negative sizes, a minor
axis longer than the major, a convex area smaller than the area) are rejected with a 422.
Values outside the training range are still predicted, with a warning. Interactive docs
are at http://127.0.0.1:8000/docs.

### Tests

```bash
.venv/Scripts/python -m pytest app -q
cd frontend
npm test -- --run
npm run lint
```

---

## Repository layout

```
GrainWise/
├── Original_Dataset/        Rice_Cammeo_Osmancik.arff, as downloaded from UCI
├── Shared_Dataset/
│   └── rice_shared.py       The shared split, feature engineering and scoring harness every notebook imports
├── NoteBooks/
│   ├── Data_Notebook.ipynb          Integrity checks, ratio features, split, EDA
│   ├── Pipeline_Baselines.ipynb     Harness, VIF selection, baselines
│   ├── Logistic_Regression.ipynb    Kishakya
│   ├── Random_Forest.ipynb          Amalki
│   ├── SVM.ipynb                    Razni
│   ├── KNN.ipynb                    Jinathi
│   └── comparison_evaluation.ipynb  Significance tests, cost threshold, final sealed-test evaluation
├── Results/                  results_<model>.csv + *_folds.npy, one subfolder per member
├── FinalModel/
│   └── grainwise_model.pkl   The selected, fitted model (duplicated at app/grainwise_model.pkl for the API)
├── Decision_Logs/
│   └── decision_log_FULL.csv  48 decisions, Owner column uses M1=Kishakya, M2=Amalki, M3=Razni, M4=Jinathi
├── Final_Report/             Consolidated written report (PDF)
├── Individual_Journeys/      One Personal Learning Journey per member, each member's own unaided work
├── app/                      Prediction API (FastAPI) serving the final model
└── frontend/                 Web UI (React + Vite + Tailwind)
```

---

## Team

| Member | Core responsibility | Model owned |
| --- | --- | --- |
| **Kishakya** (M1) | Data loading & fingerprinting, EDA, feature engineering, the shared harness (`rice_shared.py`) every other notebook builds on | Logistic Regression — the final selected model |
| **Amalki** (M2) | Problem/business framing, workflow diagram, decision log coordination | Random Forest |
| **Razni** (M3) | Evaluation design — significance testing, cost-sensitive threshold tuning; built the prediction API and web UI (`app/`, `frontend/`) | SVM |
| **Jinathi** (M4) | Final recommendation, limitations analysis, report assembly, reproducibility checks | k-Nearest Neighbours |

Every member also logged their own decisions in `Decision_Logs/decision_log_FULL.csv` and
wrote their own Personal Learning Journey, independently, in `Individual_Journeys/`.

---

## Reproducing the results

All four members ran their model through one shared harness, `rice_shared.py`, instead of
exchanging preprocessed data files — a deliberate decision (decision log D21-equivalent): a
pre-scaled CSV would leak (the scaler fitted outside the folds) and would force identical
preprocessing on every model regardless of whether it needs scaling.

```python
import rice_shared as rs
rs.DATA_PATH = "<path to>/Rice_Cammeo_Osmancik.arff"

X_train, X_test, y_train, y_test = rs.get_split("all")
row, res = rs.score(YourModel(), X_train, y_train, name="...", scale=True)
```

The harness guarantees:

- Identical stratified 80/20 split, seed 42
- Identical `RepeatedStratifiedKFold(10, 3, random_state=42)` folds, so paired statistical
  tests across members are valid
- Scaling fitted **inside** each CV fold via `sklearn.Pipeline`, never on the full training
  set — `scale=True` for SVM / k-NN / Logistic Regression, `scale=False` for Random Forest
- Identical metric schema from `score()`, so the comparison table assembles itself

Requirements: `scikit-learn`, `pandas`, `numpy`, `matplotlib`, `seaborn`, `statsmodels`,
`scipy`. Notebooks were run in Google Colab.

**Run order:** `Data_Notebook` → `Pipeline_Baselines` → (`Logistic_Regression` /
`Random_Forest` / `SVM` / `KNN`, in parallel) → `comparison_evaluation`.

Conclusions were confirmed under partition seeds 42, 7 and 2024 (seed-stability checks in
each model notebook).

---

## Limitations

- **Will not transfer to another imaging rig** without recalibration — the signal is mainly
  absolute size, in pixel units (finding 4)
- **Two varieties only.** A binary classifier will confidently assign one of these two
  labels to a grain of any third variety
- **Grain-level model, lot-level decision.** Aggregating grain predictions into a lot-level
  judgement, and determining the required sample size, was scoped out under the project
  timeline
- **VIF selection is target-agnostic** — it drops `Major_Axis_Length`, the strongest single
  predictor, from the `decorrelated` feature set. Accuracy survives only because
  `Eccentricity` and `Minor_Axis_Length` jointly recover it through the identity in finding 2
- **No stakeholder cost data.** The 5:1 ratio is our assumption; the sensitivity sweep is
  what makes the recommendation usable despite that
- **One growing region.** The grains were grown and photographed in Turkey; nothing here is
  validated against Sri Lankan varieties or grading practice

---

## AI use declaration

Anthropic's Claude was used throughout this project for scaffolding the notebooks and the
shared harness, suggesting analyses (the corrected paired t-test, McNemar, the cost-sensitive
threshold sweep), and drafting sections of the report and this README. Every result reported
here was produced by code the team ran and verified against the notebook outputs committed to
this repository. We flag one instance where AI assistance was wrong and corrected: an early
draft claimed four feature-importance methods converged on a single ranking; adding the SVM's
permutation importance showed they did not (finding 6). Each member's Personal Learning
Journey is their own unaided work.

---

## Citation

```
Cinar, I. & Koklu, M. (2019). Classification of Rice Varieties Using Artificial
Intelligence Methods. International Journal of Intelligent Systems and Applications
in Engineering.

Rice (Cammeo and Osmancik) [Dataset]. (2019). UCI Machine Learning Repository.
https://doi.org/10.24432/C5MW4Z
```