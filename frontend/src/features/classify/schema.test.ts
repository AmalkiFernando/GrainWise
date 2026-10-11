import { measurementSchema, EMPTY_FORM, toFormValues } from './schema'
import { eccentricityFromAxes } from './fields'

const valid = {
  ...EMPTY_FORM,
  Area: '15231',
  Perimeter: '525.579',
  Major_Axis_Length: '229.7499',
  Minor_Axis_Length: '85.0932',
  Convex_Area: '15617',
  Extent: '0.5729',
}

function errorsFor(values: typeof valid) {
  const result = measurementSchema.safeParse(values)
  if (result.success) {
    return {}
  }
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]))
}

describe('measurementSchema', () => {
  it('turns the form text into numbers and leaves eccentricity to the API when automatic', () => {
    const result = measurementSchema.parse(valid)
    expect(result).toEqual({
      Area: 15231,
      Perimeter: 525.579,
      Major_Axis_Length: 229.7499,
      Minor_Axis_Length: 85.0932,
      Convex_Area: 15617,
      Extent: 0.5729,
    })
    expect('Eccentricity' in result).toBe(false)
  })

  it('sends a typed eccentricity when automatic is off', () => {
    const result = measurementSchema.parse({
      ...valid,
      eccentricityAuto: false,
      Eccentricity: '0.93',
    })
    expect(result.Eccentricity).toBe(0.93)
  })

  it.each([
    ['Area', '', 'Required'],
    ['Area', 'abc', 'Enter a number'],
    ['Perimeter', '-4', 'Must be more than 0'],
    ['Extent', '1.4', 'Extent is a fraction: at most 1'],
    ['Extent', '0', 'Must be more than 0'],
  ] as const)('rejects %s = %j', (field, value, message) => {
    expect(errorsFor({ ...valid, [field]: value })[field]).toBe(message)
  })

  it('rejects a minor axis longer than the major axis', () => {
    expect(errorsFor({ ...valid, Minor_Axis_Length: '300' }).Minor_Axis_Length).toMatch(
      /longer than the major axis/,
    )
  })

  it('rejects a convex area smaller than the area', () => {
    expect(errorsFor({ ...valid, Convex_Area: '100' }).Convex_Area).toMatch(/smaller than the area/)
  })

  it('requires eccentricity only when it is typed by hand', () => {
    expect(errorsFor({ ...valid, eccentricityAuto: false }).Eccentricity).toBe('Required')
    expect(
      errorsFor({ ...valid, eccentricityAuto: false, Eccentricity: '1' }).Eccentricity,
    ).toMatch(/up to \(not including\) 1/)
    expect(errorsFor(valid).Eccentricity).toBeUndefined()
  })
})

describe('toFormValues', () => {
  it('rounds to each field’s precision', () => {
    const values = toFormValues(
      { Area: 15231, Perimeter: 525.5789794921875, Extent: 0.5728955268859863 },
      {
        Area: 0,
        Perimeter: 3,
        Major_Axis_Length: 3,
        Minor_Axis_Length: 3,
        Eccentricity: 4,
        Convex_Area: 0,
        Extent: 4,
      },
    )
    expect(values.Perimeter).toBe('525.579')
    expect(values.Extent).toBe('0.5729')
    expect(values.eccentricityAuto).toBe(true)
  })
})

describe('eccentricityFromAxes', () => {
  it('matches the dataset definition', () => {
    // Row 0 of the dataset: eccentricity 0.9288820028305054.
    expect(eccentricityFromAxes(229.7498779296875, 85.09378814697266)).toBeCloseTo(0.928882, 6)
  })

  it('is undefined for impossible axes', () => {
    expect(eccentricityFromAxes(80, 90)).toBeNull()
    expect(eccentricityFromAxes(0, 0)).toBeNull()
  })
})
