import { Component, Suspense, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { ErrorState } from '../components/feedback/error-state'
import { LoadingState } from '../components/feedback/loading-state'

class RouteChunkErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // The safe UI below replaces browser/runtime error output for failed chunks.
  }

  render() {
    if (this.state.failed) {
      return (
        <ErrorState
          title="Unable to load this page"
          description="The application update could not be loaded. Reload the page and try again."
          onRetry={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}

export function RouteLoadBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <RouteChunkErrorBoundary key={location.pathname}>
      <Suspense fallback={<LoadingState label="Loading page" />}>{children}</Suspense>
    </RouteChunkErrorBoundary>
  )
}
