import { EmptyState } from '@/components/EmptyState'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-20">
      <EmptyState
        title="404 — Page not found"
        description="The page you're looking for doesn't exist or has moved."
        actionLabel="Go home"
        actionHref="/"
        tone="error"
      />
    </div>
  )
}
