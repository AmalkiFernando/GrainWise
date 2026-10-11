import { ClockCounterClockwise, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { IconBadge } from '@/components/ui/IconBadge'
import { StaggerItem, StaggerList } from '@/components/ui/motion/StaggerList'
import { cn, formatNumber, formatPercent, formatTime } from '@/lib/utils'
import type { HistoryEntry } from '../useClassifyStore'

interface HistoryCardProps {
  entries: HistoryEntry[]
  onLoad: (entry: HistoryEntry) => void
  onClear: () => void
}

/** The last few grains classified in this browser; any one can be loaded back into the form. */
export function HistoryCard({ entries, onLoad, onClear }: HistoryCardProps) {
  if (entries.length === 0) {
    return null
  }

  const scored = entries.filter((e) => e.recorded !== null)
  const correct = scored.filter((e) => e.recorded === e.variety).length

  return (
    <Card>
      <CardHeader
        icon={
          <IconBadge tone="harvest">
            <ClockCounterClockwise size={20} weight="duotone" />
          </IconBadge>
        }
        title="Recent grains"
        subtitle={
          scored.length > 0
            ? `${correct} of ${scored.length} test-set grains classified correctly`
            : 'Saved in this browser only'
        }
        action={
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Trash size={16} />
            Clear
          </Button>
        }
      />
      <StaggerList className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const isCammeo = entry.variety === 'Cammeo'
          return (
            <StaggerItem key={entry.id}>
              <button
                type="button"
                onClick={() => onLoad(entry)}
                className="flex w-full items-center gap-3 rounded-xl border border-brand-forest/10 bg-bg-canvas p-3 text-left transition-colors outline-none hover:border-brand-forest/30 hover:bg-brand-forest/[0.04] focus-visible:ring-2 focus-visible:ring-brand-forest/60"
                title="Load these measurements into the form"
              >
                <span
                  className={cn(
                    'size-3 shrink-0 rounded-full',
                    isCammeo ? 'bg-brand-harvest' : 'bg-brand-forest',
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-text-primary">{entry.variety}</span>
                    <span className="font-mono text-xs text-text-secondary">
                      {formatPercent(entry.probabilityCammeo)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-text-secondary">
                    {formatNumber(entry.input.Area, 0)} px ·{' '}
                    {formatNumber(entry.input.Major_Axis_Length, 1)} ×{' '}
                    {formatNumber(entry.input.Minor_Axis_Length, 1)} · {formatTime(entry.at)}
                  </span>
                  {entry.recorded && (
                    <span
                      className={cn(
                        'text-xs',
                        entry.recorded === entry.variety
                          ? 'text-state-success'
                          : 'text-state-danger',
                      )}
                    >
                      {entry.recorded === entry.variety ? '✓' : '✗'} recorded {entry.recorded}
                    </span>
                  )}
                </span>
              </button>
            </StaggerItem>
          )
        })}
      </StaggerList>
    </Card>
  )
}
