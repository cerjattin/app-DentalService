import { useRoutes } from 'react-router'
import { AppProviders } from './app/providers'
import { routes } from './routes/router'

function AppRoutes() {
  return useRoutes(routes)
}

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  )
}
