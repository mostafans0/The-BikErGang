import { Link } from 'react-router-dom'

// Empty / error state block with an optional call to action.
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  tone = 'empty',
}: {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  tone?: 'empty' | 'error'
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className="technical-grid flex min-h-72 flex-col items-center justify-center border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center"
    >
      <span
        className="grid size-10 place-items-center rounded-full border-2 text-lg font-bold"
        style={{ borderColor: tone === 'error' ? 'var(--color-destructive)' : 'var(--color-primary)' }}
        aria-hidden="true"
      >
        !
      </span>
      <h2 className="mt-4 font-heading text-2xl font-bold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-muted-foreground)]">{description}</p>
      {actionLabel && actionHref && (
        <Link to={actionHref} className="btn-primary mt-6">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
