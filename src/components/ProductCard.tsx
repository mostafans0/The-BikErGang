import { Link } from 'react-router-dom'
import type { Product } from '@/data/catalog'
import { formatPrice } from '@/lib/money'
import { useStore } from '@/store'

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, isWishlisted } = useStore()
  const saved = isWishlisted(product.slug)
  return (
    <article className="group flex flex-col border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="relative aspect-square overflow-hidden bg-[var(--color-secondary)]">
        <Link to={`/product/${product.slug}`} aria-label={product.name}>
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
        <button
          type="button"
          onClick={() => toggleWishlist(product.slug)}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="absolute right-3 top-3 grid size-9 place-items-center bg-[var(--color-background)]/85 text-lg"
          style={{ color: saved ? 'var(--color-primary)' : 'var(--color-foreground)' }}
        >
          {saved ? '♥' : '♡'}
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)]">{product.category}</p>
            <Link
              to={`/product/${product.slug}`}
              className="mt-1 block font-heading text-lg font-bold hover:text-[var(--color-primary)]"
            >
              {product.name}
            </Link>
          </div>
          <span className="shrink-0 font-mono text-sm">{formatPrice(product.price)}</span>
        </div>
        <p className="line-clamp-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
          {product.shortDescription || product.description}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <span className="text-xs text-[var(--color-muted-foreground)]">★ {product.rating.toFixed(1)}</span>
          <button
            type="button"
            onClick={() => addToCart(product.slug)}
            className="btn-primary h-9 px-4"
            aria-label={`Add ${product.name} to cart`}
          >
            Add
          </button>
        </div>
      </div>
    </article>
  )
}
