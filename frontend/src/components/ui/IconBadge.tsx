import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'forest' | 'harvest' | 'terracotta' | 'info'

const toneClasses: Record<Tone, string> = {
  forest: 'bg-brand-forest/10 text-brand-forest',
  harvest: 'bg-brand-harvest/15 text-brand-harvest',
  terracotta: 'bg-brand-terracotta/15 text-brand-terracotta',
  info: 'bg-state-info/10 text-state-info',
}

export function IconBadge({
  children,
  tone = 'forest',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
