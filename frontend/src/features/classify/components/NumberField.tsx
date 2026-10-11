import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Info } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  unit?: string
  description: string
  /** A line under the input, e.g. the training range. Replaced by `error` when there is one. */
  hint?: ReactNode
  error?: string
  /** Something to show at the right of the label row (the eccentricity auto switch). */
  labelAction?: ReactNode
}

/**
 * A text input that takes a decimal number. Not `type="number"`: browsers disagree on what
 * those accept and what they report back, and the spinner arrows are useless at this scale.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ label, unit, description, hint, error, labelAction, className, readOnly, ...props }, ref) => {
    const id = useId()
    const messageId = `${id}-message`
    const descriptionId = `${id}-description`

    return (
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <label htmlFor={id} className="font-medium text-text-primary">
              {label}
            </label>
            <span title={description} className="cursor-help text-text-secondary/70">
              <Info size={14} aria-hidden="true" />
            </span>
            <span id={descriptionId} className="sr-only">
              {description}
            </span>
          </span>
          {labelAction}
        </div>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            readOnly={readOnly}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${descriptionId} ${messageId}`}
            className={cn(
              'w-full rounded-xl border bg-bg-canvas px-3 py-2 font-mono text-text-primary outline-none transition-colors',
              'placeholder:text-text-secondary/50 focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/15',
              error ? 'border-state-danger' : 'border-text-secondary/25',
              unit && 'pr-10',
              readOnly && 'cursor-default bg-brand-forest/[0.04] text-text-secondary',
              className,
            )}
            {...props}
          />
          {unit && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-text-secondary">
              {unit}
            </span>
          )}
        </div>
        <p
          id={messageId}
          className={cn('min-h-4 text-xs', error ? 'text-state-danger' : 'text-text-secondary')}
        >
          {error ?? hint}
        </p>
      </div>
    )
  },
)
NumberField.displayName = 'NumberField'
