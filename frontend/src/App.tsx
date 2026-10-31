import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppProviders } from './app/providers'
import { routes } from './routes/router'

const router = createBrowserRouter(routes)

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
