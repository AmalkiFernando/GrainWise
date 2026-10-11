import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl bg-gradient-to-r from-brand-forest/5 via-brand-forest/10 to-brand-forest/5',
        className,
      )}
    />
  )
}
