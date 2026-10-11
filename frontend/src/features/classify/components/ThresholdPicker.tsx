import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { ThresholdPreset } from '@/lib/api'
import { cn, formatPercent } from '@/lib/utils'

interface ThresholdPickerProps {
  presets: ThresholdPreset[]
  value: number
  defaultThreshold: number
  onChange: (threshold: number) => void
  disabled?: boolean
}

/**
 * Picks the decision threshold by the business question behind it: how much worse is it to sell
 * an Osmancik grain as premium Cammeo than to miss a Cammeo? Each ratio's threshold is the one
 * that minimised that cost in the notebook's cross-validation.
 */
export function ThresholdPicker({
  presets,
  value,
  defaultThreshold,
  onChange,
  disabled,
}: ThresholdPickerProps) {
  const pillId = useId()
  const labelId = useId()
  const reduceMotion = useReducedMotion()
  const defaultPreset = presets.find((p) => Math.abs(p.threshold - defaultThreshold) < 1e-9)

  return (
    <div>
      <p id={labelId} className="text-sm font-medium text-text-primary">
        Cost of a false “Cammeo” call
      </p>
      <p className="mt-0.5 text-xs text-text-secondary">
        How many times worse is selling Osmancik as Cammeo than missing a Cammeo?
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="mt-3 grid grid-cols-5 gap-1 rounded-xl border border-brand-forest/15 bg-bg-canvas p-1"
      >
        {presets.map((preset) => {
          const active = Math.abs(preset.threshold - value) < 1e-9
          const isDefault = Math.abs(preset.threshold - defaultThreshold) < 1e-9
          return (
            <button
              key={preset.cost_ratio}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(preset.threshold)}
              title={`Call Cammeo when P(Cammeo) ≥ ${formatPercent(preset.threshold)}`}
              className={cn(
                'relative flex flex-col items-center rounded-lg px-1 py-1.5 transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/60 disabled:opacity-50',
                active
                  ? 'text-bg-surface'
                  : 'text-text-secondary hover:bg-brand-forest/10 hover:text-brand-forest',
              )}
            >
              {active && (
                <motion.span
                  layoutId={pillId}
                  className="absolute inset-0 rounded-lg bg-brand-forest"
                  transition={
                    reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
                  }
                />
              )}
              <span className="relative font-mono text-sm font-medium">{preset.cost_ratio}:1</span>
              <span className="relative text-[11px] opacity-80">
                {formatPercent(preset.threshold, 1)}
              </span>
              {isDefault && (
                <span className="absolute -top-1 right-0.5 size-2 rounded-full bg-brand-harvest ring-2 ring-bg-canvas">
                  <span className="sr-only">(recommended)</span>
                </span>
              )}
            </button>
          )
        })}
      </div>
      {defaultPreset && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
          <span className="size-2 shrink-0 rounded-full bg-brand-harvest" aria-hidden="true" />
          {defaultPreset.cost_ratio}:1 is the operating point the project evaluated on the test set.
        </p>
      )}
    </div>
  )
}
