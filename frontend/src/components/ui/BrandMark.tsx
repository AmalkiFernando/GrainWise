import { cn } from '@/lib/utils'

/**
 * The GrainWise logo: two grains on a soft green tile, then the name. Drawn from theme tokens, so
 * it brightens in dark mode with the rest of the brand. The long grain is forest (Osmancik's
 * colour across the app), the short one harvest gold (Cammeo's).
 */
export function BrandMark({
  className,
  nameClassName,
}: {
  className?: string
  nameClassName?: string
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-forest/12"
      >
        <svg viewBox="0 0 24 24" className="size-6">
          <ellipse
            cx="9.2"
            cy="12"
            rx="3.1"
            ry="7"
            transform="rotate(-24 9.2 12)"
            className="fill-brand-forest"
          />
          <ellipse
            cx="15.2"
            cy="12.4"
            rx="2.6"
            ry="6"
            transform="rotate(18 15.2 12.4)"
            className="fill-brand-harvest"
          />
        </svg>
      </span>
      <span className={cn('font-display text-2xl leading-none text-brand-forest', nameClassName)}>
        GrainWise
      </span>
    </span>
  )
}
