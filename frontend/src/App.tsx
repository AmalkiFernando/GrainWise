import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { hydrateTheme } from '@/lib/useUiStore'
import { router } from '@/app/routes'

// The model and its metadata don't change while the API runs, so fetch them once per visit.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false },
  },
})

function App() {
  useEffect(() => {
    hydrateTheme()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  )
}

export default App
