import { z } from 'zod'
import type { MeasurementInput, RawFeature } from '@/lib/api'

/**
 * The form's rules. They mirror GrainMeasurements in app/api.py, so a bad value is caught as
 * it's typed rather than after a round trip; the API checks everything again regardless.
 */
const numberText = z
  .string()
  .trim()
  .min(1, 'Required')
  .transform(Number)
  .pipe(z.number({ error: 'Enter a number' }))

const positive = numberText.pipe(z.number().positive('Must be more than 0'))

const optionalFraction = z
  .string()
  .trim()
  .refine((value) => value === '' || Number.isFinite(Number(value)), 'Enter a number')
  .refine(
    (value) => value === '' || (Number(value) >= 0 && Number(value) < 1),
    'Must be from 0 up to (not including) 1',
  )

export const measurementSchema = z
  .object({
    Area: positive,
    Perimeter: positive,
    Major_Axis_Length: positive,
    Minor_Axis_Length: positive,
    Convex_Area: positive,
    Extent: numberText.pipe(
      z.number().gt(0, 'Must be more than 0').lte(1, 'Extent is a fraction: at most 1'),
    ),
    /** When on, eccentricity is calculated from the axes and the field is read-only. */
    eccentricityAuto: z.boolean(),
    Eccentricity: optionalFraction,
  })
  .superRefine((values, ctx) => {
    if (values.Minor_Axis_Length > values.Major_Axis_Length) {
      ctx.addIssue({
        code: 'custom',
        path: ['Minor_Axis_Length'],
        message: 'Can’t be longer than the major axis',
      })
    }
    if (values.Convex_Area < values.Area) {
      ctx.addIssue({
        code: 'custom',
        path: ['Convex_Area'],
        message: 'Can’t be smaller than the area: the convex outline encloses the grain',
      })
    }
    if (!values.eccentricityAuto && values.Eccentricity === '') {
      ctx.addIssue({ code: 'custom', path: ['Eccentricity'], message: 'Required' })
    }
  })
  .transform(({ eccentricityAuto, Eccentricity, ...rest }): MeasurementInput => {
    // Left out when automatic, so the API derives it from the axes with full precision.
    return eccentricityAuto ? rest : { ...rest, Eccentricity: Number(Eccentricity) }
  })

export type MeasurementFormValues = z.input<typeof measurementSchema>

export const EMPTY_FORM: MeasurementFormValues = {
  Area: '',
  Perimeter: '',
  Major_Axis_Length: '',
  Minor_Axis_Length: '',
  Convex_Area: '',
  Extent: '',
  eccentricityAuto: true,
  Eccentricity: '',
}

/** The form's text values for a set of measurements (a sample grain, or a history entry). */
export function toFormValues(
  measurements: Partial<Record<RawFeature, number>>,
  decimals: Record<RawFeature, number>,
  eccentricityAuto = true,
): MeasurementFormValues {
  const text = (feature: RawFeature) => {
    const value = measurements[feature]
    return value === undefined ? '' : String(Number(value.toFixed(decimals[feature])))
  }
  return {
    Area: text('Area'),
    Perimeter: text('Perimeter'),
    Major_Axis_Length: text('Major_Axis_Length'),
    Minor_Axis_Length: text('Minor_Axis_Length'),
    Convex_Area: text('Convex_Area'),
    Extent: text('Extent'),
    eccentricityAuto,
    Eccentricity: eccentricityAuto ? '' : text('Eccentricity'),
  }
}
