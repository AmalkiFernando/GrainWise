import { motion, useReducedMotion } from 'motion/react'
import type { Prediction } from '@/lib/api'
import { cn, formatNumber } from '@/lib/utils'
import { featureLabel } from '../fields'

/**
 * Why the model leaned the way it did. For logistic regression the log-odds of Cammeo are the
 * intercept plus one term per feature (coefficient × standardised value), so each bar is exactly
 * how far that measurement pushed this grain towards Cammeo (right) or Osmancik (left).
 */
export function ExplanationChart({
  explanation,
}: {
  explanation: NonNullable<Prediction['explanation']>
}) {
  const reduceMotion = useReducedMotion()
  const maxAbs = Math.max(...explanation.terms.map((t) => Math.abs(t.contribution)), 0.01)

  return (
    <div>
      <div className="mb-2 grid grid-cols-[7.5rem_1fr] items-center gap-3 text-[11px] text-text-secondary">
        <span />
        <div className="flex justify-between">
          <span>← Osmancik</span>
          <span>Cammeo →</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {explanation.terms.map((term, index) => {
          const width = (Math.abs(term.contribution) / maxAbs) * 50
          const positive = term.contribution >= 0
          return (
            <li
              key={term.feature}
              className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-xs"
              title={`${featureLabel(term.feature)} = ${formatNumber(term.value, 4)} (${formatNumber(term.z, 2)} SD from the training mean). Adds ${term.contribution >= 0 ? '+' : ''}${term.contribution.toFixed(3)} to the log-odds.`}
            >
              <span className="truncate text-text-secondary">{featureLabel(term.feature)}</span>
              <div className="relative h-4">
                <span className="absolute inset-y-0 left-1/2 w-px bg-text-secondary/30" />
                <motion.span
                  className={cn(
                    'absolute inset-y-0.5 rounded-sm',
                    positive ? 'left-1/2 bg-brand-harvest' : 'right-1/2 bg-brand-forest',
                  )}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.45, delay: reduceMotion ? 0 : index * 0.03 }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-text-secondary">
        Log-odds = intercept {explanation.intercept.toFixed(2)} + the bars ={' '}
        <span className="font-mono text-text-primary">{explanation.log_odds.toFixed(2)}</span>.
        Hover a bar for the numbers.
      </p>
    </div>
  )
}
