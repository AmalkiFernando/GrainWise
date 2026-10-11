import { motion, useReducedMotion } from 'motion/react'
import { formatPercent } from '@/lib/utils'

/**
 * P(Cammeo) on a 0–100% track, with the decision threshold marked. Left of the mark the call is
 * Osmancik, right of it Cammeo: the bar shows how far the grain cleared, or missed, the bar.
 */
export function ProbabilityMeter({
  probability,
  threshold,
}: {
  probability: number
  threshold: number
}) {
  const reduceMotion = useReducedMotion()
  const isCammeo = probability >= threshold

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-text-secondary">
        <span>Osmancik</span>
        <span>
          P(Cammeo){' '}
          <span className="font-mono text-sm font-medium text-text-primary">
            {formatPercent(probability)}
          </span>
        </span>
        <span>Cammeo</span>
      </div>
      <div
        className="relative h-3 rounded-full bg-brand-forest/10"
        role="meter"
        aria-label="Probability the grain is Cammeo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(probability * 1000) / 10}
        aria-valuetext={`${formatPercent(probability)} Cammeo; threshold ${formatPercent(threshold)}`}
      >
        <motion.div
          className={
            isCammeo
              ? 'absolute inset-y-0 left-0 rounded-full bg-brand-harvest'
              : 'absolute inset-y-0 left-0 rounded-full bg-brand-forest'
          }
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${Math.max(probability * 100, 1.5)}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        <motion.div
          className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-text-primary"
          initial={false}
          animate={{ left: `calc(${threshold * 100}% - 1px)` }}
          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
          aria-hidden="true"
        />
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-text-secondary">
        <motion.span
          className="absolute -translate-x-1/2 whitespace-nowrap"
          initial={false}
          animate={{ left: `${Math.min(Math.max(threshold * 100, 12), 88)}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
        >
          threshold {formatPercent(threshold)}
        </motion.span>
      </div>
    </div>
  )
}
