import type { DerivedFeature, Feature, RawFeature, Variety } from '@/lib/api'

export interface FieldMeta {
  label: string
  /** Shown inside the input, after the value. */
  unit?: string
  description: string
  /** Digits to keep when a sample grain fills the form. */
  decimals: number
}

/**
 * The seven measurements the imaging rig takes of each grain, in the order a person would read
 * them off: size first, then shape. Lengths and areas are in pixels of the original photos.
 */
export const RAW_FIELDS: Record<RawFeature, FieldMeta> = {
  Area: {
    label: 'Area',
    unit: 'px',
    description: 'Pixels inside the grain’s outline.',
    decimals: 0,
  },
  Perimeter: {
    label: 'Perimeter',
    unit: 'px',
    description: 'Length of the grain’s outline.',
    decimals: 3,
  },
  Major_Axis_Length: {
    label: 'Major axis length',
    unit: 'px',
    description: 'Longest line through the grain (its length).',
    decimals: 3,
  },
  Minor_Axis_Length: {
    label: 'Minor axis length',
    unit: 'px',
    description: 'Widest line across the grain, at right angles to the major axis.',
    decimals: 3,
  },
  Eccentricity: {
    label: 'Eccentricity',
    description: 'How stretched the grain’s ellipse is: 0 is a circle, near 1 a needle.',
    decimals: 4,
  },
  Convex_Area: {
    label: 'Convex area',
    unit: 'px',
    description: 'Pixels inside the tightest convex outline around the grain.',
    decimals: 0,
  },
  Extent: {
    label: 'Extent',
    description: 'Grain area divided by the area of its bounding box.',
    decimals: 4,
  },
}

export const DERIVED_FIELDS: Record<DerivedFeature, FieldMeta & { formula: string }> = {
  Aspect_Ratio: {
    label: 'Aspect ratio',
    description: 'How many times longer than wide the grain is.',
    formula: 'major ÷ minor axis',
    decimals: 3,
  },
  Roundness: {
    label: 'Roundness',
    description: '1 for a perfect circle, lower for longer or more ragged grains.',
    formula: '4π · area ÷ perimeter²',
    decimals: 3,
  },
  Solidity: {
    label: 'Solidity',
    description: 'How completely the grain fills its convex outline; dents lower it.',
    formula: 'area ÷ convex area',
    decimals: 4,
  },
}

export const FIELD_GROUPS: { title: string; hint: string; fields: RawFeature[] }[] = [
  {
    title: 'Size',
    hint: 'Areas and lengths, in pixels',
    fields: ['Area', 'Convex_Area', 'Perimeter'],
  },
  {
    title: 'Shape',
    hint: 'The grain’s fitted ellipse and bounding box',
    fields: ['Major_Axis_Length', 'Minor_Axis_Length', 'Eccentricity', 'Extent'],
  },
]

export function featureLabel(feature: Feature): string {
  return feature in RAW_FIELDS
    ? RAW_FIELDS[feature as RawFeature].label
    : DERIVED_FIELDS[feature as DerivedFeature].label
}

export const VARIETY_COPY: Record<Variety, { tagline: string; detail: string }> = {
  Cammeo: {
    tagline: 'Premium variety',
    detail: 'Longer, larger grains. Sold at a premium, so a false “Cammeo” call is the costly one.',
  },
  Osmancik: {
    tagline: 'Standard variety',
    detail: 'Shorter, rounder grains. The more common of the two in the dataset.',
  },
}

/** sqrt(1 − (minor / major)²): exactly how the dataset's eccentricity relates to the axes. */
export function eccentricityFromAxes(major: number, minor: number): number | null {
  if (!(major > 0) || !(minor > 0) || minor > major) {
    return null
  }
  return Math.sqrt(1 - (minor / major) ** 2)
}
