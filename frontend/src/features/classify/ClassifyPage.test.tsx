import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import fixtures from '@/test/fixtures.json'
import { ClassifyPage } from './ClassifyPage'
import { useClassifyStore } from './useClassifyStore'

type Handler = (init?: RequestInit) => { status: number; body: unknown }

function mockApi(overrides: Record<string, Handler> = {}) {
  const handlers: Record<string, Handler> = {
    '/api/model': () => ({ status: 200, body: fixtures.modelInfo }),
    '/api/samples': () => ({ status: 200, body: fixtures.samples }),
    '/api/predict': () => ({ status: 200, body: fixtures.prediction }),
    ...overrides,
  }
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const handler = handlers[String(input)]
    if (!handler) {
      throw new TypeError('Failed to fetch')
    }
    const { status, body } = handler(init)
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ClassifyPage />
    </QueryClientProvider>,
  )
}

function predictCalls(fetchSpy: ReturnType<typeof mockApi>) {
  return fetchSpy.mock.calls.filter(([url]) => url === '/api/predict')
}

beforeEach(() => {
  localStorage.clear()
  useClassifyStore.setState({ threshold: null, history: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ClassifyPage', () => {
  it('classifies typed measurements and explains the result', async () => {
    const fetchSpy = mockApi()
    const user = userEvent.setup()
    renderPage()

    const g = fixtures.grain
    await user.type(await screen.findByLabelText('Area'), String(g.Area))
    await user.type(screen.getByLabelText('Convex area'), String(g.Convex_Area))
    await user.type(screen.getByLabelText('Perimeter'), String(g.Perimeter))
    await user.type(screen.getByLabelText('Major axis length'), String(g.Major_Axis_Length))
    await user.type(screen.getByLabelText('Minor axis length'), String(g.Minor_Axis_Length))
    await user.type(screen.getByLabelText('Extent'), String(g.Extent))

    // Eccentricity fills itself in from the axes.
    expect(screen.getByLabelText('Eccentricity')).toHaveValue('0.9289')

    await user.click(screen.getByRole('button', { name: /classify grain/i }))

    expect(await screen.findByRole('heading', { name: 'Cammeo', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('What drove this call')).toBeInTheDocument()

    const [, init] = predictCalls(fetchSpy)[0]
    const sent = JSON.parse(init?.body as string)
    expect(sent.threshold).toBe(fixtures.modelInfo.default_threshold)
    expect(sent.measurements).toEqual(g)

    expect(screen.getByText('Recent grains')).toBeInTheDocument()
    expect(useClassifyStore.getState().history).toHaveLength(1)
  })

  it('flags missing measurements without calling the model', async () => {
    const fetchSpy = mockApi()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /classify grain/i }))

    expect(await screen.findAllByText('Required')).toHaveLength(6)
    expect(screen.getByText('Fix the highlighted measurements first.')).toBeInTheDocument()
    expect(predictCalls(fetchSpy)).toHaveLength(0)
  })

  it('shows a server validation error on its field', async () => {
    mockApi({
      '/api/predict': () => ({
        status: 422,
        body: {
          detail: [
            {
              loc: ['body', 'measurements', 'Extent'],
              msg: 'Input should be less than or equal to 1',
            },
          ],
        },
      }),
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /osmancik sample/i }))
    await user.click(screen.getByRole('button', { name: /classify grain/i }))

    expect(await screen.findByText('Input should be less than or equal to 1')).toBeInTheDocument()
  })

  it('loads a held-out sample grain and scores the prediction against its label', async () => {
    mockApi()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /cammeo sample/i }))
    expect(screen.getByLabelText('Area')).not.toHaveValue('')
    expect(screen.getByText(/Test-set grain, recorded as/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /classify grain/i }))
    expect(
      await screen.findByText(/Correct: this test-set grain is recorded as Cammeo/),
    ).toBeInTheDocument()
  })

  it('re-asks the model when the cost ratio changes', async () => {
    const fetchSpy = mockApi()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /cammeo sample/i }))
    await user.click(screen.getByRole('button', { name: /classify grain/i }))
    await screen.findByRole('heading', { name: 'Cammeo', level: 2 })

    const ratios = screen.getByRole('radiogroup', { name: /cost of a false/i })
    await user.click(within(ratios).getByRole('radio', { name: /1:1/ }))

    await waitFor(() => expect(predictCalls(fetchSpy)).toHaveLength(2))
    const [, init] = predictCalls(fetchSpy)[1]
    expect(JSON.parse(init?.body as string).threshold).toBe(0.485)
    // The same grain, so no second history entry.
    expect(useClassifyStore.getState().history).toHaveLength(1)
  })

  it('says how to start the API when it is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()

    expect(await screen.findByText('The model isn’t reachable')).toBeInTheDocument()
    expect(screen.getByText(/uvicorn api:app/)).toBeInTheDocument()
  })
})
