export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** A feature name as people read it: `Major_Axis_Length` → `Major axis length`. */
export function humanize(feature: string): string {
  const words = feature.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString('en-US', { maximumFractionDigits })
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${(value * 100).toFixed(fractionDigits)}%`
}

/** A difference between two rates, which is in percentage points, not percent. */
export function formatPoints(difference: number, fractionDigits = 1): string {
  const points = Math.abs(difference * 100).toFixed(fractionDigits)
  return `${points} percentage ${points === '1.0' || points === '1' ? 'point' : 'points'}`
}

export function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
