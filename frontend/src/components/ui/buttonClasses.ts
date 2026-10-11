import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-forest text-bg-surface hover:bg-brand-forest-light',
  secondary: 'bg-brand-harvest text-brand-ink hover:brightness-95',
  ghost: 'bg-transparent text-brand-forest hover:bg-brand-forest/10',
  danger: 'bg-state-danger text-bg-surface hover:brightness-95',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

/**
 * The button look on its own: `Button` uses it, and so can a router `Link` that should read as a
 * button. Its own module so Button.tsx exports only components, which fast refresh needs.
 */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    'outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
    variantClasses[variant],
    sizeClasses[size],
    className,
  )
}
