import { useEffect, useMemo, useState } from 'react'
import {
  products,
  categories,
  brands,
  ridingStyles,
  defaultFilters,
  filterProducts,
  maxPrice,
  type CatalogFilters,
  type SortKey,
} from '@/data/catalog'
import { ProductCard } from '@/components/ProductCard'
import { EmptyState } from '@/components/EmptyState'
import { Spinner } from '@/components/Spinner'
import { formatPrice } from '@/lib/money'

const priceCeiling = Math.ceil(maxPrice / 1000) * 1000
const sorts: { value: SortKey; label: string }[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name' },
]

export default function Shop() {
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters)
  const [loading, setLoading] = useState(true)

  // Visible loading state while the (local) catalog "settles" on each change.
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 350)
    return () => clearTimeout(t)
  }, [filters])

  const results = useMemo(() => filterProducts(products, filters), [filters])
  const set = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }))
  const active =
    filters.q !== '' ||
    filters.category !== 'All' ||
    filters.brand !== 'All' ||
    filters.style !== 'All' ||
    filters.minRating > 0 ||
    filters.maxPrice < priceCeiling

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <p className="eyebrow">Catalog</p>
      <h1 className="section-title mt-3">Find your next layer.</h1>

      {/* Search + sort */}
      <div className="mt-8 grid gap-3 border-y border-[var(--color-border)] py-5 lg:grid-cols-[1fr_auto]">
        <label className="flex min-h-12 items-center gap-3 bg-[var(--color-card)] px-4">
          <span aria-hidden="true">🔍</span>
          <span className="sr-only">Search products</span>
          <input
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Search gear, materials, and riding styles"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        <label className="flex min-h-12 items-center gap-2 bg-[var(--color-card)] px-3 text-sm">
          <span className="sr-only">Sort by</span>
          <select
            value={filters.sort}
            onChange={(e) => set('sort', e.target.value as SortKey)}
            className="bg-transparent outline-none"
          >
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Filters */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Category
          <select value={filters.category} onChange={(e) => set('category', e.target.value)} className="field mt-2">
            {['All', ...categories].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Brand
          <select value={filters.brand} onChange={(e) => set('brand', e.target.value)} className="field mt-2">
            {['All', ...brands].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Riding style
          <select value={filters.style} onChange={(e) => set('style', e.target.value)} className="field mt-2">
            {['All', ...ridingStyles].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Minimum rating
          <select
            value={String(filters.minRating)}
            onChange={(e) => set('minRating', Number(e.target.value))}
            className="field mt-2"
          >
            <option value="0">Any rating</option>
            <option value="4">4+ stars</option>
            <option value="4.5">4.5+ stars</option>
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] sm:col-span-2">
          Max price · {formatPrice(filters.maxPrice)}
          <input
            type="range"
            min={1000}
            max={priceCeiling}
            step={1000}
            value={filters.maxPrice}
            onChange={(e) => set('maxPrice', Number(e.target.value))}
            className="mt-4 w-full accent-[var(--color-primary)]"
          />
        </label>
        {active && (
          <button
            type="button"
            onClick={() => setFilters(defaultFilters())}
            className="btn-secondary self-end"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <p className="font-mono text-sm text-[var(--color-muted-foreground)]">
          {loading ? 'Loading…' : `${results.length} products`}
        </p>
      </div>

      {/* Loading / empty / results states */}
      {loading ? (
        <Spinner label="Loading catalog…" />
      ) : results.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No gear matches these filters"
            description="Try widening your search or clearing a filter to see more of the catalog."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
