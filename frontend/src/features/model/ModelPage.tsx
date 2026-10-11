import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowClockwise,
  Books,
  ChartBar,
  Crosshair,
  Gauge,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  Table,
  Target,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { IconBadge, type Tone } from '@/components/ui/IconBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import { StaggerItem, StaggerList } from '@/components/ui/motion/StaggerList'
import type { ConfusionSummary, DerivedFeature, Feature, ModelInfo, RawFeature } from '@/lib/api'
import { cn, formatNumber, formatPercent, formatPoints } from '@/lib/utils'
import { DERIVED_FIELDS, featureLabel, RAW_FIELDS } from '@/features/classify/fields'
import { useModelInfo } from '@/features/classify/queries'

export function ModelPage() {
  const { data: info, isPending, isError, error, refetch } = useModelInfo()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium tracking-wide text-brand-terracotta uppercase">
          Model card
        </p>
        <h1 className="font-display text-3xl leading-tight text-brand-forest sm:text-4xl">
          How the classifier was chosen, and how well it does
        </h1>
        <p className="mt-2 max-w-3xl text-text-secondary">
          Every number below is computed by the API from the saved model and the sealed test set, or
          read from each member’s cross-validation results, so it always describes the model you’re
          using.
        </p>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
          <Skeleton className="h-72 sm:col-span-2 lg:col-span-4" />
        </div>
      ) : isError ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-text-secondary">{error.message}</p>
          <Button variant="ghost" onClick={() => refetch()}>
            <ArrowClockwise size={16} weight="bold" />
            Try again
          </Button>
        </Card>
      ) : (
        <ModelDetails info={info} />
      )}
    </div>
  )
}

function StatTile({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string
  value: string
  detail: string
  icon: ReactNode
  tone: Tone
}) {
  return (
    <Card className="flex h-full flex-col gap-3">
      <IconBadge tone={tone}>{icon}</IconBadge>
      <div>
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="font-mono text-2xl text-text-primary">{value}</p>
        <p className="mt-1 text-xs text-text-secondary">{detail}</p>
      </div>
    </Card>
  )
}

function ModelDetails({ info }: { info: ModelInfo }) {
  const ev = info.evaluation
  const atDefault = ev.thresholds['0.500']
  const tunedKey = info.default_threshold.toFixed(3)
  const atTuned = ev.thresholds[tunedKey]
  const baseline = ev.one_feature_baseline
  const osmancikTotal = atTuned.tn + atTuned.fp

  return (
    <>
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <IconBadge className="size-12 rounded-2xl">
            <Target size={26} weight="duotone" />
          </IconBadge>
          <div>
            <p className="text-xs text-text-secondary">Final model</p>
            <p className="font-display text-2xl text-text-primary">{info.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {info.scaled && <Badge variant="forest">Standardised inputs</Badge>}
          {Object.entries(info.params).map(([key, value]) => (
            <Badge key={key} variant="neutral">
              <span className="font-mono">
                {key}={typeof value === 'number' ? formatNumber(value, 3) : String(value)}
              </span>
            </Badge>
          ))}
          <Badge variant="info">{info.features.length} features</Badge>
          <Badge variant="neutral">trained on {formatNumber(info.n_train, 0)} grains</Badge>
        </div>
      </Card>

      <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem className="h-full">
          <StatTile
            label="ROC-AUC (test set)"
            value={ev.roc_auc.toFixed(3)}
            detail="How well P(Cammeo) ranks the two varieties, whatever the threshold."
            icon={<Gauge size={20} weight="duotone" />}
            tone="forest"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatTile
            label="Accuracy at 0.5"
            value={formatPercent(atDefault.accuracy, 2)}
            detail={`${atDefault.fp + atDefault.fn} of ${ev.n_test} held-out grains wrong.`}
            icon={<ListChecks size={20} weight="duotone" />}
            tone="info"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatTile
            label={`Cammeo precision at ${formatPercent(info.default_threshold)}`}
            value={formatPercent(atTuned.precision, 1)}
            detail="When it says Cammeo, how often it really is."
            icon={<Crosshair size={20} weight="duotone" />}
            tone="harvest"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatTile
            label="False “Cammeo” calls"
            value={`${atTuned.fp} / ${osmancikTotal}`}
            detail={`Osmancik grains sold as premium at the ${formatPercent(info.default_threshold)} threshold (${atDefault.fp} at 0.5).`}
            icon={<ShieldCheck size={20} weight="duotone" />}
            tone="terracotta"
          />
        </StaggerItem>
      </StaggerList>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={
              <IconBadge>
                <Table size={20} weight="duotone" />
              </IconBadge>
            }
            title="Test-set results"
            subtitle={`${ev.n_test} grains the model never saw, evaluated once.`}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ConfusionMatrix title="Threshold 0.500" summary={atDefault} />
            <ConfusionMatrix
              title={`Threshold ${tunedKey} (cost-tuned)`}
              summary={atTuned}
              highlight
            />
          </div>
          <p className="mt-4 text-sm text-text-secondary">
            Raising the threshold to {tunedKey} gives up{' '}
            {formatPoints(atDefault.accuracy - atTuned.accuracy)} of accuracy for{' '}
            {atDefault.fp - atTuned.fp} fewer Osmancik grains sold as Cammeo. Under the 5:1 cost
            assumption that cuts the expected cost from {atDefault.cost_5_to_1} to{' '}
            {atTuned.cost_5_to_1}.
          </p>
        </Card>

        <Card>
          <CardHeader
            icon={
              <IconBadge tone="harvest">
                <Lightbulb size={20} weight="duotone" />
              </IconBadge>
            }
            title="An honest comparison"
            subtitle="Does the full model earn its complexity?"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-brand-forest/10 bg-bg-canvas p-3">
              <p className="text-xs text-text-secondary">
                One threshold on {featureLabel(baseline.feature).toLowerCase()}
              </p>
              <p className="font-mono text-xl text-text-primary">
                {formatPercent(baseline.accuracy, 2)}
              </p>
              <p className="text-xs text-text-secondary">
                cost {baseline.cost_5_to_1} · {baseline.fp} false Cammeo
              </p>
            </div>
            <div className="rounded-xl border border-brand-forest/20 bg-brand-forest/5 p-3">
              <p className="text-xs text-text-secondary">{info.name}, at 0.5</p>
              <p className="font-mono text-xl text-text-primary">
                {formatPercent(atDefault.accuracy, 2)}
              </p>
              <p className="text-xs text-text-secondary">
                cost {atDefault.cost_5_to_1} · {atDefault.fp} false Cammeo
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-text-secondary">
            On accuracy alone, a single cut-off on one measurement comes within{' '}
            {formatPoints(atDefault.accuracy - baseline.accuracy)} of the full model, and in
            cross-validation the gap wasn’t statistically significant (McNemar p ≈ 0.89). The
            model’s real value is its <strong className="text-text-primary">probability</strong>:
            that is what lets the threshold be tuned to the cost of each mistake, which one fixed
            cut-off can’t do.
          </p>
        </Card>
      </div>

      <CvTable info={info} />

      <div className="grid gap-6 lg:grid-cols-2">
        {info.coefficients && <CoefficientChart coefficients={info.coefficients} />}
        <ThresholdTable info={info} />
      </div>

      <FeatureGlossary info={info} />
    </>
  )
}

function ConfusionMatrix({
  title,
  summary,
  highlight,
}: {
  title: string
  summary: ConfusionSummary
  highlight?: boolean
}) {
  const cell = 'rounded-lg p-2 text-center'
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        highlight ? 'border-brand-harvest/40 bg-brand-harvest/5' : 'border-brand-forest/10',
      )}
    >
      <p className="mb-2 text-sm font-medium text-text-primary">{title}</p>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-xs">
        <span />
        <span className="text-center text-text-secondary">Called Osmancik</span>
        <span className="text-center text-text-secondary">Called Cammeo</span>
        <span className="self-center pr-1 text-right text-text-secondary">Osmancik</span>
        <span className={cn(cell, 'bg-state-success/10 font-mono text-state-success')}>
          {summary.tn}
        </span>
        <span className={cn(cell, 'bg-state-danger/10 font-mono text-state-danger')}>
          {summary.fp}
        </span>
        <span className="self-center pr-1 text-right text-text-secondary">Cammeo</span>
        <span className={cn(cell, 'bg-brand-harvest/15 font-mono text-brand-harvest')}>
          {summary.fn}
        </span>
        <span className={cn(cell, 'bg-state-success/10 font-mono text-state-success')}>
          {summary.tp}
        </span>
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        Accuracy {formatPercent(summary.accuracy, 2)} · precision{' '}
        {formatPercent(summary.precision, 1)} · recall {formatPercent(summary.recall, 1)}
      </p>
    </div>
  )
}

function CvTable({ info }: { info: ModelInfo }) {
  const rows = info.cv_comparison
  if (rows.length === 0) {
    return null
  }
  const best = Math.max(...rows.map((r) => r.accuracy_mean))
  return (
    <Card>
      <CardHeader
        icon={
          <IconBadge tone="info">
            <ChartBar size={20} weight="duotone" />
          </IconBadge>
        }
        title="Model comparison"
        subtitle="10-fold cross-validation repeated 3 times on the training set. Every model sits within about a point of the others."
      />
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-brand-forest/10 text-left text-xs text-text-secondary">
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 font-medium">Member</th>
              <th className="py-2 pr-3 text-right font-medium">Accuracy</th>
              <th className="py-2 pr-3 text-right font-medium">Precision</th>
              <th className="py-2 pr-3 text-right font-medium">Recall</th>
              <th className="py-2 pr-3 text-right font-medium">F1</th>
              <th className="py-2 pr-3 text-right font-medium">ROC-AUC</th>
              <th className="py-2 text-right font-medium">Fit time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const chosen = row.model === info.name
              return (
                <tr
                  key={row.model}
                  className={cn(
                    'border-b border-brand-forest/5 last:border-0',
                    chosen && 'bg-brand-forest/[0.05]',
                  )}
                >
                  <td className="py-2.5 pr-3 font-medium text-text-primary">
                    <span className="flex items-center gap-2">
                      {row.model}
                      {chosen && <Badge variant="forest">chosen</Badge>}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-text-secondary">{row.member}</td>
                  <td className="py-2.5 pr-3 text-right font-mono">
                    <AccuracyBar value={row.accuracy_mean} best={best} />
                    <span className="text-[11px] text-text-secondary">
                      ±{formatPercent(row.accuracy_std, 1)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono">
                    {formatPercent(row.precision_mean, 1)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono">
                    {formatPercent(row.recall_mean, 1)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono">
                    {formatPercent(row.f1_mean, 1)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono">
                    {row.roc_auc_mean.toFixed(3)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-text-secondary">
                    {row.fit_time_s < 1
                      ? `${Math.round(row.fit_time_s * 1000)} ms`
                      : `${row.fit_time_s.toFixed(1)} s`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-text-secondary">
        Corrected paired t-tests found no significant difference between any two models (all p &gt;
        0.05). Logistic Regression was chosen as the simplest, fastest model with well-calibrated
        probabilities.
      </p>
    </Card>
  )
}

function AccuracyBar({ value, best }: { value: number; best: number }) {
  return (
    <span className="mr-1.5 inline-flex items-center gap-2">
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-brand-forest/10 sm:inline-block">
        {/* Scaled over the last two points, where all the models live. */}
        <span
          className="block h-full rounded-full bg-brand-forest"
          style={{ width: `${Math.max(5, 100 - ((best - value) / 0.02) * 100)}%` }}
        />
      </span>
      {formatPercent(value, 2)}
    </span>
  )
}

function CoefficientChart({
  coefficients,
}: {
  coefficients: NonNullable<ModelInfo['coefficients']>
}) {
  const reduceMotion = useReducedMotion()
  const maxAbs = Math.max(...coefficients.map((c) => Math.abs(c.coefficient)))
  return (
    <Card>
      <CardHeader
        icon={
          <IconBadge>
            <ChartBar size={20} weight="duotone" />
          </IconBadge>
        }
        title="What the model weighs"
        subtitle="Coefficients on standardised features: a one-SD increase moves the log-odds by this much."
      />
      <ul className="flex flex-col gap-2">
        {coefficients.map((c, index) => {
          const positive = c.coefficient >= 0
          return (
            <li key={c.feature} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-3">
              <span className="truncate text-sm text-text-secondary">
                {featureLabel(c.feature)}
              </span>
              <div className="relative h-4">
                <span className="absolute inset-y-0 left-1/2 w-px bg-text-secondary/30" />
                <motion.span
                  className={cn(
                    'absolute inset-y-0.5 rounded-sm',
                    positive ? 'left-1/2 bg-brand-harvest' : 'right-1/2 bg-brand-forest',
                  )}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${(Math.abs(c.coefficient) / maxAbs) * 50}%` }}
                  transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.04 }}
                />
              </div>
              <span className="text-right font-mono text-xs text-text-primary">
                {c.coefficient >= 0 ? '+' : ''}
                {c.coefficient.toFixed(2)}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-text-secondary">
        Gold bars push towards Cammeo, green towards Osmancik. Area, convex area and perimeter are
        almost perfectly correlated (r ≈ 0.99), so their individual weights aren’t meaningful on
        their own.
      </p>
    </Card>
  )
}

function ThresholdTable({ info }: { info: ModelInfo }) {
  return (
    <Card>
      <CardHeader
        icon={
          <IconBadge tone="terracotta">
            <Target size={20} weight="duotone" />
          </IconBadge>
        }
        title="Cost-tuned thresholds"
        subtitle="The threshold that minimised expected cost in cross-validation, for each cost ratio."
      />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-forest/10 text-left text-xs text-text-secondary">
            <th className="py-2 font-medium">False Cammeo : missed Cammeo</th>
            <th className="py-2 text-right font-medium">Call Cammeo when P ≥</th>
          </tr>
        </thead>
        <tbody>
          {info.threshold_presets.map((preset) => {
            const isDefault = preset.threshold === info.default_threshold
            return (
              <tr
                key={preset.cost_ratio}
                className={cn(
                  'border-b border-brand-forest/5 last:border-0',
                  isDefault && 'bg-brand-harvest/10',
                )}
              >
                <td className="py-2.5 font-mono">
                  {preset.cost_ratio} : 1
                  {isDefault && (
                    <Badge variant="warning" className="ml-2 font-sans">
                      project default
                    </Badge>
                  )}
                </td>
                <td className="py-2.5 text-right font-mono">{formatPercent(preset.threshold)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-secondary">
        The cost ratio is an assumption, not a stakeholder figure: selling Osmancik as premium
        Cammeo is a pricing and authenticity failure, while missing a Cammeo is only lost margin.
        Pick the ratio that matches your situation on the Classify page.
      </p>
    </Card>
  )
}

function FeatureGlossary({ info }: { info: ModelInfo }) {
  const rows: { feature: Feature; description: string; derived?: string }[] = [
    ...info.inputs.map((feature: RawFeature) => ({
      feature,
      description: RAW_FIELDS[feature].description,
    })),
    ...info.derived.map((feature: DerivedFeature) => ({
      feature,
      description: DERIVED_FIELDS[feature].description,
      derived: DERIVED_FIELDS[feature].formula,
    })),
  ]
  return (
    <Card>
      <CardHeader
        icon={
          <IconBadge tone="info">
            <Books size={20} weight="duotone" />
          </IconBadge>
        }
        title="The features"
        subtitle={
          <>
            Seven measurements per grain from 3,810 photographed grains (Cinar &amp; Koklu, 2019),
            plus three ratios derived from them.{' '}
            <a
              href={`https://doi.org/${info.dataset_doi}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-forest underline underline-offset-2"
            >
              Dataset DOI
            </a>
          </>
        }
      />
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-brand-forest/10 text-left text-xs text-text-secondary">
              <th className="py-2 pr-3 font-medium">Feature</th>
              <th className="py-2 pr-3 font-medium">Meaning</th>
              <th className="py-2 pr-3 text-right font-medium">Training range</th>
              <th className="py-2 pr-3 text-right font-medium text-brand-harvest">Cammeo avg</th>
              <th className="py-2 text-right font-medium text-brand-forest">Osmancik avg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ feature, description, derived }) => {
              const s = info.feature_stats[feature]
              const digits = s.max > 100 ? 0 : 3
              return (
                <tr key={feature} className="border-b border-brand-forest/5 last:border-0">
                  <td className="py-2.5 pr-3 font-medium whitespace-nowrap text-text-primary">
                    {featureLabel(feature)}
                    {derived && (
                      <Badge variant="neutral" className="ml-2">
                        derived
                      </Badge>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-text-secondary">
                    {description}
                    {derived && <span className="block font-mono text-xs">{derived}</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap">
                    {formatNumber(s.min, digits)} – {formatNumber(s.max, digits)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono">
                    {formatNumber(s.class_means.Cammeo, digits)}
                  </td>
                  <td className="py-2.5 text-right font-mono">
                    {formatNumber(s.class_means.Osmancik, digits)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
