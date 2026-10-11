import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowClockwise, PlugsConnected } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { IconBadge } from '@/components/ui/IconBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  api,
  ApiError,
  RAW_FEATURES,
  type MeasurementInput,
  type ModelInfo,
  type Sample,
  type Variety,
} from '@/lib/api'
import { useUiStore } from '@/lib/useUiStore'
import { HistoryCard } from './components/HistoryCard'
import { MeasurementForm } from './components/MeasurementForm'
import { ResultPanel, type ClassifyResult } from './components/ResultPanel'
import { ThresholdPicker } from './components/ThresholdPicker'
import { RAW_FIELDS } from './fields'
import { useModelInfo, useSamples } from './queries'
import { EMPTY_FORM, measurementSchema, toFormValues, type MeasurementFormValues } from './schema'
import { useClassifyStore, type HistoryEntry } from './useClassifyStore'

const DECIMALS = Object.fromEntries(
  RAW_FEATURES.map((feature) => [feature, RAW_FIELDS[feature].decimals]),
) as Record<(typeof RAW_FEATURES)[number], number>

export function ClassifyPage() {
  const modelQuery = useModelInfo()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium tracking-wide text-brand-terracotta uppercase">
          Rice variety classifier
        </p>
        <h1 className="font-display text-3xl leading-tight text-brand-forest sm:text-4xl">
          Cammeo or Osmancik?
        </h1>
        <p className="mt-2 max-w-2xl text-text-secondary">
          Enter one grain’s shape measurements and the project’s final model tells you which variety
          it is, how sure it is, and why.
        </p>
      </div>

      {modelQuery.isPending ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-[36rem] lg:col-span-7" />
          <Skeleton className="h-80 lg:col-span-5" />
        </div>
      ) : modelQuery.isError ? (
        <ApiUnavailable error={modelQuery.error} onRetry={() => modelQuery.refetch()} />
      ) : (
        <Classifier info={modelQuery.data} />
      )}
    </div>
  )
}

function ApiUnavailable({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <IconBadge tone="terracotta" className="size-14 rounded-2xl">
        <PlugsConnected size={30} weight="duotone" />
      </IconBadge>
      <h2 className="font-display text-xl text-text-primary">The model isn’t reachable</h2>
      <p className="max-w-md text-sm text-text-secondary">{error.message}</p>
      <code className="rounded-lg bg-brand-forest/5 px-3 py-1.5 font-mono text-xs text-text-secondary">
        .venv\Scripts\python -m uvicorn api:app --app-dir app --port 8000
      </code>
      <Button variant="ghost" onClick={onRetry}>
        <ArrowClockwise size={16} weight="bold" />
        Try again
      </Button>
    </Card>
  )
}

function sameValues(a: MeasurementFormValues, b: MeasurementFormValues): boolean {
  return (Object.keys(a) as (keyof MeasurementFormValues)[]).every(
    (key) => String(a[key]).trim() === String(b[key]).trim(),
  )
}

function Classifier({ info }: { info: ModelInfo }) {
  const samplesQuery = useSamples()
  const addToast = useUiStore((state) => state.addToast)
  const storedThreshold = useClassifyStore((state) => state.threshold)
  const setThreshold = useClassifyStore((state) => state.setThreshold)
  const history = useClassifyStore((state) => state.history)
  const addHistory = useClassifyStore((state) => state.addHistory)
  const clearHistory = useClassifyStore((state) => state.clearHistory)

  // A stored threshold only counts while it's still one of the model's presets.
  const threshold = info.threshold_presets.some((p) => p.threshold === storedThreshold)
    ? (storedThreshold as number)
    : info.default_threshold

  const form = useForm<MeasurementFormValues, unknown, MeasurementInput>({
    resolver: zodResolver(measurementSchema),
    defaultValues: EMPTY_FORM,
    mode: 'onTouched',
  })

  const [result, setResult] = useState<ClassifyResult | null>(null)
  const [lastInput, setLastInput] = useState<MeasurementInput | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const resultRef = useRef<HTMLDivElement>(null)
  // The sample the form was filled from, and the exact text it was filled with: once the user
  // edits a value it's no longer that recorded grain, and isn't scored against its label.
  const [loadedSample, setLoadedSample] = useState<{
    sample: Sample
    values: MeasurementFormValues
  } | null>(null)
  const formValues = useWatch({ control: form.control }) as MeasurementFormValues
  const sampleVariety =
    loadedSample && sameValues(formValues, loadedSample.values) ? loadedSample.sample.variety : null

  const predictMutation = useMutation({
    mutationFn: ({ input, threshold }: { input: MeasurementInput; threshold: number }) =>
      api.predict(input, threshold),
  })

  function currentRecordedVariety(): Variety | null {
    return loadedSample && sameValues(form.getValues(), loadedSample.values)
      ? loadedSample.sample.variety
      : null
  }

  async function classify(input: MeasurementInput, atThreshold: number, recordInHistory: boolean) {
    const recorded = recordInHistory ? currentRecordedVariety() : (result?.recorded ?? null)
    try {
      const prediction = await predictMutation.mutateAsync({ input, threshold: atThreshold })
      setResult({ prediction, recorded })
      setLastInput(input)
      if (recordInHistory) {
        addHistory({
          input,
          variety: prediction.variety,
          probabilityCammeo: prediction.probability.Cammeo,
          threshold: prediction.threshold,
          recorded,
        })
        // Below `lg` the result sits under the form, out of sight: bring it into view.
        if (!window.matchMedia('(min-width: 1024px)').matches) {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          form.setError(field as keyof MeasurementFormValues, { type: 'server', message })
        }
        setShakeKey((key) => key + 1)
      } else {
        addToast({
          type: 'error',
          message: error instanceof Error ? error.message : 'The prediction failed.',
        })
      }
    }
  }

  function changeThreshold(next: number) {
    setThreshold(next)
    if (lastInput) {
      // Same grain, new decision rule: re-ask the model rather than leave a stale verdict.
      void classify(lastInput, next, false)
    }
  }

  function loadSample(variety: Variety) {
    const pool = (samplesQuery.data ?? []).filter((s) => s.variety === variety)
    // A different grain from the one already in the form, when there's a choice.
    const candidates = pool.length > 1 ? pool.filter((s) => s.id !== loadedSample?.sample.id) : pool
    if (candidates.length === 0) {
      return
    }
    const sample = candidates[Math.floor(Math.random() * candidates.length)]
    const values = toFormValues(sample.measurements, DECIMALS)
    form.reset(values)
    setLoadedSample({ sample, values })
  }

  function loadHistory(entry: HistoryEntry) {
    const hasManualEccentricity = entry.input.Eccentricity !== undefined
    form.reset(toFormValues(entry.input, DECIMALS, !hasManualEccentricity))
    setLoadedSample(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function clearForm() {
    form.reset(EMPTY_FORM)
    setLoadedSample(null)
  }

  return (
    <>
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <MeasurementForm
            form={form}
            info={info}
            onSubmit={(input) => classify(input, threshold, true)}
            onInvalid={() => setShakeKey((key) => key + 1)}
            onLoadSample={loadSample}
            onClear={clearForm}
            samplesReady={samplesQuery.isSuccess}
            isSubmitting={predictMutation.isPending}
            shakeKey={shakeKey}
            sampleVariety={sampleVariety}
            decisionRule={
              <ThresholdPicker
                presets={info.threshold_presets}
                value={threshold}
                defaultThreshold={info.default_threshold}
                onChange={changeThreshold}
                disabled={predictMutation.isPending}
              />
            }
          />
        </div>
        <div ref={resultRef} className="scroll-mt-20 lg:sticky lg:top-24 lg:col-span-5">
          <ResultPanel result={result} isPending={predictMutation.isPending} info={info} />
        </div>
      </div>

      <HistoryCard entries={history} onLoad={loadHistory} onClear={clearHistory} />
    </>
  )
}
