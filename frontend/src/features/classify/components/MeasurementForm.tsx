import type { ReactNode } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { motion } from 'motion/react'
import { ArrowCounterClockwise, Scan, Shuffle, WarningCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { IconBadge } from '@/components/ui/IconBadge'
import { Shake } from '@/components/ui/motion/Shake'
import type { MeasurementInput, ModelInfo, RawFeature, Variety } from '@/lib/api'
import { cn, formatNumber } from '@/lib/utils'
import { eccentricityFromAxes, FIELD_GROUPS, RAW_FIELDS } from '../fields'
import type { MeasurementFormValues } from '../schema'
import { GrainPreview } from './GrainPreview'
import { NumberField } from './NumberField'

export type MeasurementFormApi = UseFormReturn<MeasurementFormValues, unknown, MeasurementInput>

type TypedFeature = Exclude<RawFeature, 'Eccentricity'>

interface MeasurementFormProps {
  form: MeasurementFormApi
  info: ModelInfo
  onSubmit: (input: MeasurementInput) => void
  onInvalid: () => void
  onLoadSample: (variety: Variety) => void
  onClear: () => void
  samplesReady: boolean
  isSubmitting: boolean
  /** The threshold picker, drawn under the measurements. */
  decisionRule: ReactNode
  /** Shakes the submit row once per failed attempt. */
  shakeKey: number
  /** Set while the form holds a held-out sample grain, unchanged. */
  sampleVariety: Variety | null
}

function parse(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') {
    return null
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function MeasurementForm({
  form,
  info,
  onSubmit,
  onInvalid,
  onLoadSample,
  onClear,
  samplesReady,
  isSubmitting,
  decisionRule,
  shakeKey,
  sampleVariety,
}: MeasurementFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    control,
    formState: { errors },
  } = form
  const values = useWatch({ control })
  const major = parse(values.Major_Axis_Length)
  const minor = parse(values.Minor_Axis_Length)
  const autoEccentricity = values.eccentricityAuto ?? true
  const derivedEccentricity =
    major !== null && minor !== null ? eccentricityFromAxes(major, minor) : null

  const stats = info.feature_stats
  const reference = {
    Cammeo: {
      major: stats.Major_Axis_Length.class_means.Cammeo,
      minor: stats.Minor_Axis_Length.class_means.Cammeo,
    },
    Osmancik: {
      major: stats.Major_Axis_Length.class_means.Osmancik,
      minor: stats.Minor_Axis_Length.class_means.Osmancik,
    },
  }

  /** The training range under each field, turning amber when the typed value falls outside it. */
  function hintFor(feature: RawFeature): ReactNode {
    const s = stats[feature]
    const digits = RAW_FIELDS[feature].decimals > 0 ? 3 : 0
    const range = `${formatNumber(s.min, digits)} – ${formatNumber(s.max, digits)}`
    const typed =
      feature === 'Eccentricity' && autoEccentricity
        ? derivedEccentricity
        : parse(values[feature] as string | undefined)
    if (typed !== null && (typed < s.min || typed > s.max)) {
      return (
        <span className="flex items-center gap-1 text-brand-terracotta">
          <WarningCircle size={13} weight="fill" aria-hidden="true" />
          Outside the training range ({range})
        </span>
      )
    }
    return <>Training range {range}</>
  }

  function toggleAutoEccentricity() {
    const next = !autoEccentricity
    setValue('eccentricityAuto', next, { shouldDirty: true })
    if (next) {
      clearErrors('Eccentricity')
    } else if (derivedEccentricity !== null) {
      // Start manual entry from the value the axes imply, rather than an empty box.
      setValue('Eccentricity', String(Number(derivedEccentricity.toFixed(4))))
    }
  }

  function renderField(feature: RawFeature) {
    const meta = RAW_FIELDS[feature]
    const placeholder = String(
      Number(stats[feature].mean.toFixed(meta.decimals > 0 ? Math.min(meta.decimals, 3) : 0)),
    )

    if (feature !== 'Eccentricity') {
      return (
        <NumberField
          key={feature}
          label={meta.label}
          unit={meta.unit}
          description={meta.description}
          hint={hintFor(feature)}
          error={errors[feature as TypedFeature]?.message}
          placeholder={placeholder}
          {...register(feature as TypedFeature)}
        />
      )
    }

    const autoSwitch = (
      <button
        type="button"
        role="switch"
        aria-checked={autoEccentricity}
        onClick={toggleAutoEccentricity}
        className="flex items-center gap-1.5 rounded-full text-xs text-text-secondary outline-none hover:text-brand-forest focus-visible:ring-2 focus-visible:ring-brand-forest/60"
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative h-4 w-7 rounded-full transition-colors',
            autoEccentricity ? 'bg-brand-forest' : 'bg-text-secondary/30',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 size-3 rounded-full bg-bg-surface transition-[left] duration-200',
              autoEccentricity ? 'left-3.5' : 'left-0.5',
            )}
          />
        </span>
        From axes
      </button>
    )

    return autoEccentricity ? (
      <NumberField
        key="Eccentricity-auto"
        label={meta.label}
        description={`${meta.description} Calculated from the axes as √(1 − (minor ÷ major)²), which is how the dataset defines it.`}
        hint={
          derivedEccentricity === null ? 'Fills in from the two axis lengths' : hintFor(feature)
        }
        labelAction={autoSwitch}
        readOnly
        value={derivedEccentricity === null ? '' : derivedEccentricity.toFixed(4)}
        placeholder="auto"
      />
    ) : (
      <NumberField
        key="Eccentricity"
        label={meta.label}
        description={meta.description}
        hint={hintFor(feature)}
        error={errors.Eccentricity?.message}
        labelAction={autoSwitch}
        placeholder={placeholder}
        {...register('Eccentricity')}
      />
    )
  }

  return (
    <Card>
      <CardHeader
        icon={
          <IconBadge>
            <Scan size={20} weight="duotone" />
          </IconBadge>
        }
        title="Grain measurements"
        subtitle="Type the shape measurements of one grain, or load a real grain the model has never seen."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onLoadSample('Cammeo')}
          disabled={!samplesReady}
        >
          <Shuffle size={16} weight="bold" />
          Cammeo sample
        </Button>
        <Button size="sm" onClick={() => onLoadSample('Osmancik')} disabled={!samplesReady}>
          <Shuffle size={16} weight="bold" />
          Osmancik sample
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <ArrowCounterClockwise size={16} weight="bold" />
          Clear
        </Button>
        {sampleVariety && (
          <span className="text-xs text-text-secondary sm:ml-auto">
            Test-set grain, recorded as{' '}
            <strong className="font-semibold text-text-primary">{sampleVariety}</strong>
          </span>
        )}
      </div>

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        aria-label="Grain measurements"
        className="flex flex-col gap-6"
      >
        {FIELD_GROUPS.map((group) => (
          <fieldset key={group.title} className="min-w-0">
            <legend className="mb-3 flex items-baseline gap-2">
              <span className="text-xs font-semibold tracking-wide text-brand-terracotta uppercase">
                {group.title}
              </span>
              <span className="text-xs text-text-secondary">{group.hint}</span>
            </legend>
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
              {group.fields.map(renderField)}
            </div>
          </fieldset>
        ))}

        <div className="grid items-center gap-x-5 gap-y-2 rounded-2xl border border-brand-forest/10 bg-brand-forest/[0.03] p-3 sm:grid-cols-[minmax(0,18rem)_1fr]">
          <GrainPreview
            major={major}
            minor={minor}
            scaleMax={stats.Major_Axis_Length.max}
            reference={reference}
          />
          <div>
            <p className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
              Outline preview
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              The grain’s ellipse, drawn to scale from the two axes over the average grain of each
              variety. Cammeo grains run longer.
            </p>
          </div>
        </div>

        <div className="border-t border-brand-forest/10 pt-5">{decisionRule}</div>

        <Shake trigger={shakeKey} className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full sm:w-auto">
            {!isSubmitting && <Scan size={20} weight="duotone" />}
            Classify grain
          </Button>
          {Object.keys(errors).length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-state-danger"
            >
              Fix the highlighted measurements first.
            </motion.p>
          )}
        </Shake>
      </form>
    </Card>
  )
}
