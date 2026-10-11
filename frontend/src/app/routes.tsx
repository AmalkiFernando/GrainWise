import { createBrowserRouter } from 'react-router-dom'
import { ClassifyPage } from '@/features/classify/ClassifyPage'
import { AppLayout } from './AppLayout'
import { NotFoundPage } from './NotFoundPage'

// features/model/ModelPage.tsx (the model card: test results, model comparison, coefficients) is
// kept but not routed. To bring it back, add `{ path: '/model', element: <ModelPage /> }` here and
// a nav tab in AppLayout.
export const routes = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <ClassifyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
