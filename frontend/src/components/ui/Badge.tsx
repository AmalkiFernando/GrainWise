import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'forest'

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-state-success/10 text-state-success',
  warning: 'bg-brand-harvest/15 text-brand-harvest',
  danger: 'bg-state-danger/10 text-state-danger',
  info: 'bg-state-info/10 text-state-info',
  neutral: 'bg-text-secondary/10 text-text-secondary',
  forest: 'bg-brand-forest/10 text-brand-forest',
}

export function Badge({
  variant,
  children,
  className,
}: {
  variant: BadgeVariant
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
