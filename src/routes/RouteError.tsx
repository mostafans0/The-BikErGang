import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { EmptyState } from '@/components/EmptyState'

// Router-level error boundary: shown when a route throws or 404s outside the tree.
export default function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Something went wrong.'
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-20">
        <EmptyState title="Something went wrong" description={message} actionLabel="Go home" actionHref="/" tone="error" />
      </main>
    </div>
  )
}
