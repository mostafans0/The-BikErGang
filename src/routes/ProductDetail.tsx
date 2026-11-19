import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProduct } from '@/data/catalog'
import { formatPrice } from '@/lib/money'
import { Stars } from '@/components/Stars'
import { EmptyState } from '@/components/EmptyState'
import { useStore } from '@/store'

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()
  const product = slug ? getProduct(slug) : undefined
  const { addToCart, toggleWishlist, isWishlisted } = useStore()
  const [size, setSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          title="Product not found"
          description="That product doesn't exist or may have been removed."
          actionLabel="Back to shop"
          actionHref="/shop"
          tone="error"
        />
      </div>
    )
  }

  const sizes = product.sizes.length ? product.sizes : ['One size']
  const add = () => {
    addToCart(product.slug, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <Link to="/shop" className="text-sm font-bold text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
        ← Back to shop
      </Link>
      <div className="mt-7 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative aspect-square bg-[var(--color-card)]">
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-col">
          <p className="eyebrow">
            {product.brand} · {product.category}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-black tracking-tight sm:text-5xl">{product.name}</h1>
          <div className="mt-3">
            <Stars rating={product.rating} count={product.reviewCount} />
          </div>
          <p className="mt-4 font-mono text-xl">{formatPrice(product.price)}</p>
          <p className="mt-6 leading-7 text-[var(--color-muted-foreground)]">{product.description || product.shortDescription}</p>

          <fieldset className="mt-7">
            <legend className="text-sm font-bold">Select size</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  className="grid min-h-11 min-w-11 place-items-center border px-3 text-sm"
                  style={
                    size === s
                      ? { borderColor: 'var(--color-primary)', background: 'var(--color-primary)', color: '#fff' }
                      : { borderColor: 'var(--color-border)' }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-7 flex items-center gap-3">
            <div className="flex items-center border border-[var(--color-border)]">
              <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-12 place-items-center">
                −
              </button>
              <span className="w-8 text-center font-mono">{qty}</span>
              <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(5, q + 1))} className="grid size-12 place-items-center">
                +
              </button>
            </div>
            <button type="button" onClick={add} className="btn-primary flex-1">
              {added ? '✓ Added to cart' : 'Add to cart'}
            </button>
            <button
              type="button"
              onClick={() => toggleWishlist(product.slug)}
              aria-pressed={isWishlisted(product.slug)}
              aria-label="Toggle wishlist"
              className="btn-secondary px-4"
              style={isWishlisted(product.slug) ? { color: 'var(--color-primary)' } : undefined}
            >
              {isWishlisted(product.slug) ? '♥' : '♡'}
            </button>
          </div>
          {added && (
            <p role="status" className="mt-3 text-sm text-[var(--color-success)]">
              Added {qty} × {product.name}
              {size ? ` (size ${size})` : ''} to your cart.
            </p>
          )}
        </div>
      </div>

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        <div className="border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="font-heading text-xl font-bold">Specifications</h2>
          <dl className="mt-5 flex flex-col gap-3 text-sm">
            {[
              ['Material', product.material],
              ['Protection', product.protection],
              ['Weight', product.weight],
              ['Warranty', product.warranty],
              ['Fit', product.fit],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-3">
                <dt className="text-[var(--color-muted-foreground)]">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="font-heading text-xl font-bold">Compatibility</h2>
          <p className="mt-4 text-[var(--color-primary)]">{product.compatibility}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted-foreground)]">
            Always confirm manufacturer specifications before purchase.
          </p>
        </div>
        <div className="border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="font-heading text-xl font-bold">Suited for</h2>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {[...product.ridingStyles, ...product.weather].map((t) => (
              <li key={t} className="border border-[var(--color-border)] px-2.5 py-1 text-[var(--color-muted-foreground)]">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
