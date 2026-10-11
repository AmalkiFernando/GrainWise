import { api, ApiError } from './api'

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api client', () => {
  it('posts the measurements and threshold', async () => {
    const fetchSpy = mockFetch(200, { variety: 'Cammeo' })
    await api.predict(
      {
        Area: 1,
        Perimeter: 1,
        Major_Axis_Length: 2,
        Minor_Axis_Length: 1,
        Convex_Area: 1,
        Extent: 0.5,
      },
      0.805,
    )
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/predict')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toMatchObject({
      threshold: 0.805,
      measurements: { Area: 1 },
    })
  })

  it('maps FastAPI validation errors to fields', async () => {
    mockFetch(422, {
      detail: [
        {
          loc: ['body', 'measurements', 'Minor_Axis_Length'],
          msg: "Value error, can't be longer than the major axis length",
        },
        { loc: ['body', 'threshold'], msg: 'Input should be less than 1' },
      ],
    })
    const error = await api.model().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldErrors).toEqual({
      Minor_Axis_Length: "can't be longer than the major axis length",
    })
    expect((error as ApiError).message).toBe('Input should be less than 1')
  })

  it('explains a server that is not running', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api.model()).rejects.toThrow(/Can't reach the GrainWise API/)
  })
})
