// Loading indicator with an accessible status role.
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-72 flex-col items-center justify-center gap-4">
      <span
        className="size-8 animate-spin rounded-full border-2 border-[var(--color-border)]"
        style={{ borderTopColor: 'var(--color-primary)' }}
        aria-hidden="true"
      />
      <span className="text-sm text-[var(--color-muted-foreground)]">{label}</span>
    </div>
  )
}
