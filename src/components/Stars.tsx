// Accessible star rating display.
export function Stars({ rating, count }: { rating: number; count?: number }) {
  const rounded = Math.round(rating)
  return (
    <span className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
      <span className="flex" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} style={{ color: i < rounded ? 'var(--color-primary)' : 'var(--color-border)' }}>
            ★
          </span>
        ))}
      </span>
      <span className="sr-only">{rating} out of 5 stars</span>
      <span>
        {rating.toFixed(1)}
        {count !== undefined ? ` · ${count} reviews` : ''}
      </span>
    </span>
  )
}
