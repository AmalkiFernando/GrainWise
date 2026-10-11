import { motion } from 'motion/react'
import type { Variety } from '@/lib/api'
import { cn, formatNumber } from '@/lib/utils'

interface GrainPreviewProps {
  major: number | null
  minor: number | null
  /** The longest major axis in the training data; the drawing's scale is fixed against it. */
  scaleMax: number
  /** The class means, drawn as faint outlines so the typed grain can be compared at a glance. */
  reference?: Record<Variety, { major: number; minor: number }>
  variety?: Variety | null
  className?: string
}

const WIDTH = 280
const HEIGHT = 120
const PAD = 12

/**
 * The grain as an ellipse with the typed axes, lying on its side, drawn to the same scale every
 * time, so a bigger or longer grain visibly is one. The mean Cammeo and Osmancik grains are
 * outlined behind it.
 */
export function GrainPreview({
  major,
  minor,
  scaleMax,
  reference,
  variety,
  className,
}: GrainPreviewProps) {
  const scale = (WIDTH - PAD * 2) / scaleMax
  const cx = WIDTH / 2
  const cy = HEIGHT / 2
  const valid = major !== null && minor !== null && major > 0 && minor > 0 && minor <= major
  // Clamp to the frame, so an absurd value doesn't draw off the card.
  const rx = valid ? Math.min((major * scale) / 2, cx - 2) : 0
  const ry = valid ? Math.min((minor * scale) / 2, cy - 2) : 0

  const fillClass =
    variety === 'Cammeo'
      ? 'fill-brand-harvest/25 stroke-brand-harvest'
      : variety === 'Osmancik'
        ? 'fill-brand-forest/20 stroke-brand-forest'
        : 'fill-brand-forest/10 stroke-brand-forest/70'

  return (
    <figure className={cn('m-0', className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={
          valid
            ? `Grain outline, ${formatNumber(major)} by ${formatNumber(minor)} pixels`
            : 'Grain outline appears once both axis lengths are entered'
        }
      >
        {reference && (
          <g fill="none" strokeWidth={1} strokeDasharray="3 4">
            <ellipse
              cx={cx}
              cy={cy}
              rx={(reference.Cammeo.major * scale) / 2}
              ry={(reference.Cammeo.minor * scale) / 2}
              className="stroke-brand-harvest/60"
            />
            <ellipse
              cx={cx}
              cy={cy}
              rx={(reference.Osmancik.major * scale) / 2}
              ry={(reference.Osmancik.minor * scale) / 2}
              className="stroke-brand-forest/50"
            />
          </g>
        )}
        {valid && (
          <>
            <motion.ellipse
              cx={cx}
              cy={cy}
              initial={false}
              animate={{ rx, ry }}
              transition={{ type: 'spring', stiffness: 220, damping: 26 }}
              strokeWidth={1.5}
              className={cn('transition-colors duration-300', fillClass)}
            />
            <g className="stroke-text-secondary/60" strokeWidth={1}>
              <line x1={cx - rx} y1={cy} x2={cx + rx} y2={cy} />
              <line x1={cx} y1={cy - ry} x2={cx} y2={cy + ry} />
            </g>
          </>
        )}
      </svg>
      {reference && (
        <figcaption className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t border-dashed border-brand-harvest" />
            Average Cammeo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t border-dashed border-brand-forest" />
            Average Osmancik
          </span>
        </figcaption>
      )}
    </figure>
  )
}
