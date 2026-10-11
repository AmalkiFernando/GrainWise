import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-brand-forest/10 bg-bg-surface p-5 shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

/** A card's heading row: an icon tile, a title, and an optional line under it. */
export function CardHeader({
  icon,
  title,
  subtitle,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-start gap-3', className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-xl leading-tight text-text-primary">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
