/**
 * Typed client for the GrainWise API (app/api.py). Every call goes to a relative /api URL: Vite
 * proxies it to FastAPI in development, and FastAPI serves this bundle itself in production.
 */

export const RAW_FEATURES = [
  'Area',
  'Perimeter',
  'Major_Axis_Length',
  'Minor_Axis_Length',
  'Eccentricity',
  'Convex_Area',
  'Extent',
] as const

export type RawFeature = (typeof RAW_FEATURES)[number]
export type DerivedFeature = 'Aspect_Ratio' | 'Roundness' | 'Solidity'
export type Feature = RawFeature | DerivedFeature
export type Variety = 'Cammeo' | 'Osmancik'

export type Measurements = Record<RawFeature, number>
/** What the form sends: eccentricity may be left for the API to derive from the axes. */
export type MeasurementInput = Omit<Measurements, 'Eccentricity'> & { Eccentricity?: number }

export interface FeatureStats {
  min: number
  max: number
  mean: number
  class_means: Record<Variety, number>
}

export interface ThresholdPreset {
  cost_ratio: number
  threshold: number
}

export interface ConfusionSummary {
  accuracy: number
  precision: number
  recall: number
  tp: number
  tn: number
  fp: number
  fn: number
  cost_5_to_1: number
}

export interface CvRow {
  model: string
  member: string
  accuracy_mean: number
  accuracy_std: number
  precision_mean: number
  recall_mean: number
  f1_mean: number
  roc_auc_mean: number
  fit_time_s: number
}

export interface ModelInfo {
  name: string
  estimator: string
  params: Record<string, string | number | null>
  scaled: boolean
  features: Feature[]
  inputs: RawFeature[]
  derived: DerivedFeature[]
  classes: { positive: Variety; negative: Variety }
  default_threshold: number
  threshold_presets: ThresholdPreset[]
  feature_stats: Record<Feature, FeatureStats>
  n_train: number
  coefficients: { feature: Feature; coefficient: number }[] | null
  evaluation: {
    n_test: number
    roc_auc: number
    thresholds: Record<string, ConfusionSummary & { threshold: number }>
    one_feature_baseline: ConfusionSummary & { feature: Feature }
  }
  cv_comparison: CvRow[]
  dataset_doi: string
}

export interface Sample {
  id: number
  variety: Variety
  measurements: Measurements
}

export interface PredictionWarning {
  feature: Feature
  kind: 'out_of_range' | 'inconsistent'
  value: number
  message: string
  min?: number
  max?: number
  expected?: number
}

export interface ExplanationTerm {
  feature: Feature
  value: number
  z: number
  contribution: number
}

export interface Prediction {
  variety: Variety
  probability: Record<Variety, number>
  threshold: number
  margin: number
  measurements: Measurements
  derived: Record<DerivedFeature, number>
  explanation: { intercept: number; log_odds: number; terms: ExplanationTerm[] } | null
  warnings: PredictionWarning[]
}

/** An API failure, with any per-field validation messages pulled out of FastAPI's 422 body. */
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Partial<Record<RawFeature, string>>

  constructor(
    message: string,
    status: number,
    fieldErrors: Partial<Record<RawFeature, string>> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

interface ValidationIssue {
  loc?: (string | number)[]
  msg?: string
}

function parseError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (Array.isArray(detail)) {
    const fieldErrors: Partial<Record<RawFeature, string>> = {}
    const messages: string[] = []
    for (const issue of detail as ValidationIssue[]) {
      // Pydantic prefixes custom validator messages with "Value error, ".
      const msg = (issue.msg ?? 'Invalid value').replace(/^Value error, /, '')
      const field = issue.loc?.find((part): part is RawFeature =>
        RAW_FEATURES.includes(part as RawFeature),
      )
      if (field) {
        fieldErrors[field] ??= msg
      } else {
        messages.push(msg)
      }
    }
    return new ApiError(
      messages[0] ?? 'Some measurements need fixing before the model can run.',
      status,
      fieldErrors,
    )
  }
  if (typeof detail === 'string') {
    return new ApiError(detail, status)
  }
  return new ApiError(`The server answered ${status}.`, status)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(
      "Can't reach the GrainWise API. Is it running on port 8000? (see README → Run the app)",
      0,
    )
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw parseError(response.status, body)
  }
  return body as T
}

export const api = {
  model: () => request<ModelInfo>('/api/model'),
  samples: () => request<Sample[]>('/api/samples'),
  predict: (measurements: MeasurementInput, threshold: number) =>
    request<Prediction>('/api/predict', {
      method: 'POST',
      body: JSON.stringify({ measurements, threshold }),
    }),
}
