import { AnimatePresence, motion } from 'motion/react'
import {
  ChartBar,
  CheckCircle,
  Lightbulb,
  Ruler,
  Scales,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { IconBadge } from '@/components/ui/IconBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import type { DerivedFeature, ModelInfo, Prediction, Variety } from '@/lib/api'
import { cn, formatNumber, formatPercent } from '@/lib/utils'
import { DERIVED_FIELDS, VARIETY_COPY } from '../fields'
import { ExplanationChart } from './ExplanationChart'
import { GrainPreview } from './GrainPreview'
import { ProbabilityMeter } from './ProbabilityMeter'

export interface ClassifyResult {
  prediction: Prediction
  /** The recorded variety, when the grain came unchanged from the held-out samples. */
  recorded: Variety | null
}

interface ResultPanelProps {
  result: ClassifyResult | null
  isPending: boolean
  info: ModelInfo
}

export function ResultPanel({ result, isPending, info }: ResultPanelProps) {
  if (!result) {
    return isPending ? <ResultSkeleton /> : <EmptyResult />
  }
  return <ResultView result={result} isPending={isPending} info={info} />
}

function EmptyResult() {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <IconBadge tone="harvest" className="size-14 rounded-2xl">
        <Scales size={30} weight="duotone" />
      </IconBadge>
      <h2 className="font-display text-xl text-text-primary">Awaiting a grain</h2>
      <p className="max-w-xs text-sm text-text-secondary">
        Enter the measurements on the left, or load a sample grain, then press{' '}
        <strong className="font-semibold text-text-primary">Classify grain</strong>. The verdict and
        the reasons behind it appear here.
      </p>
    </Card>
  )
}

function ResultSkeleton() {
  return (
    <Card className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-24" />
      <Skeleton className="h-6" />
      <Skeleton className="h-40" />
    </Card>
  )
}

function ResultView({ result, isPending, info }: ResultPanelProps & { result: ClassifyResult }) {
  const { prediction, recorded } = result
  const p = prediction.probability.Cammeo
  const isCammeo = prediction.variety === 'Cammeo'
  // The grain is more likely Cammeo but the threshold asks for more certainty than that.
  const heldBack = !isCammeo && p >= 0.5
  const copy = VARIETY_COPY[prediction.variety]
  const stats = info.feature_stats

  return (
    <div className={cn('flex flex-col gap-4 transition-opacity', isPending && 'opacity-60')}>
      <Card
        className={cn(
          'relative overflow-hidden',
          isCammeo ? 'border-brand-harvest/40' : 'border-brand-forest/25',
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-0 bg-gradient-to-br to-transparent',
            isCammeo ? 'from-brand-harvest/15' : 'from-brand-forest/10',
          )}
        />
        <div className="relative" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand-terracotta uppercase">
                Predicted variety
              </p>
              <AnimatePresence mode="wait">
                <motion.h2
                  key={prediction.variety}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'font-display text-4xl leading-tight',
                    isCammeo ? 'text-brand-harvest' : 'text-brand-forest',
                  )}
                >
                  {prediction.variety}
                </motion.h2>
              </AnimatePresence>
              <Badge variant={isCammeo ? 'warning' : 'forest'} className="mt-1">
                {copy.tagline}
              </Badge>
            </div>
            <GrainPreview
              major={prediction.measurements.Major_Axis_Length}
              minor={prediction.measurements.Minor_Axis_Length}
              scaleMax={stats.Major_Axis_Length.max}
              variety={prediction.variety}
              className="w-32 shrink-0"
            />
          </div>

          <div className="mt-5">
            <ProbabilityMeter probability={p} threshold={prediction.threshold} />
          </div>

          <p className="mt-3 text-sm text-text-secondary">
            {isCammeo ? (
              <>
                {formatPercent(p)} clears the {formatPercent(prediction.threshold)} bar, so this
                grain is called <strong className="text-text-primary">Cammeo</strong>.
              </>
            ) : heldBack ? (
              <>
                Cammeo is more likely ({formatPercent(p)}), but that’s short of the{' '}
                {formatPercent(prediction.threshold)} the cost rule asks for before calling a grain
                premium, so it’s called <strong className="text-text-primary">Osmancik</strong>.
              </>
            ) : (
              <>
                {formatPercent(p)} is well short of the {formatPercent(prediction.threshold)} bar,
                so this grain is called <strong className="text-text-primary">Osmancik</strong>.
              </>
            )}
          </p>

          {recorded && (
            <div
              className={cn(
                'mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
                recorded === prediction.variety
                  ? 'bg-state-success/10 text-state-success'
                  : 'bg-state-danger/10 text-state-danger',
              )}
            >
              {recorded === prediction.variety ? (
                <CheckCircle size={18} weight="duotone" />
              ) : (
                <XCircle size={18} weight="duotone" />
              )}
              {recorded === prediction.variety
                ? `Correct: this test-set grain is recorded as ${recorded}.`
                : `Miss: this test-set grain is recorded as ${recorded}.`}
            </div>
          )}
        </div>
      </Card>

      {prediction.warnings.length > 0 && (
        <Card className="border-brand-terracotta/30">
          <CardHeader
            icon={
              <IconBadge tone="terracotta">
                <WarningCircle size={20} weight="duotone" />
              </IconBadge>
            }
            title="Check these inputs"
            subtitle="The model still answered, but treat this prediction with care."
            className="mb-3"
          />
          <ul className="flex flex-col gap-2 text-sm text-text-secondary">
            {prediction.warnings.map((warning) => (
              <li key={`${warning.feature}-${warning.kind}`} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-terracotta" />
                {warning.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          icon={
            <IconBadge tone="info">
              <Ruler size={20} weight="duotone" />
            </IconBadge>
          }
          title="Derived shape ratios"
          subtitle="Calculated from your measurements, as in training."
          className="mb-3"
        />
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(DERIVED_FIELDS) as DerivedFeature[]).map((feature) => {
            const meta = DERIVED_FIELDS[feature]
            const s = stats[feature]
            return (
              <div
                key={feature}
                className="rounded-xl border border-brand-forest/10 bg-bg-canvas p-3"
                title={`${meta.description} (${meta.formula})`}
              >
                <p className="text-xs text-text-secondary">{meta.label}</p>
                <p className="font-mono text-lg text-text-primary">
                  {formatNumber(prediction.derived[feature], meta.decimals)}
                </p>
                <p className="mt-1 flex flex-col text-[11px] leading-snug text-text-secondary">
                  <span>
                    <span className="font-semibold text-brand-harvest">C</span>{' '}
                    {formatNumber(s.class_means.Cammeo, 3)}
                  </span>
                  <span>
                    <span className="font-semibold text-brand-forest">O</span>{' '}
                    {formatNumber(s.class_means.Osmancik, 3)}
                  </span>
                </p>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-text-secondary">
          C / O: the average Cammeo and Osmancik grain in training.
        </p>
      </Card>

      {prediction.explanation && (
        <Card>
          <CardHeader
            icon={
              <IconBadge>
                <ChartBar size={20} weight="duotone" />
              </IconBadge>
            }
            title="What drove this call"
            subtitle="Each measurement’s push towards one variety or the other."
            className="mb-3"
          />
          <ExplanationChart explanation={prediction.explanation} />
          <p className="mt-3 flex gap-2 rounded-xl bg-brand-harvest/10 px-3 py-2 text-xs text-text-secondary">
            <Lightbulb size={16} weight="duotone" className="shrink-0 text-brand-harvest" />
            Size measurements are strongly correlated, so large pushes in opposite directions partly
            cancel out. Read the overall balance rather than any single bar.
          </p>
        </Card>
      )}
    </div>
  )
}
