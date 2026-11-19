import { products } from '@/data/catalog'
import { ProductCard } from '@/components/ProductCard'
import { EmptyState } from '@/components/EmptyState'
import { useStore } from '@/store'

export default function Wishlist() {
  const { wishlist } = useStore()
  const items = products.filter((p) => wishlist.includes(p.slug))
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <p className="eyebrow">Saved gear</p>
      <h1 className="section-title mt-3">Wishlist.</h1>
      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            description="Use the heart button on any product to build your shortlist."
            actionLabel="Browse products"
            actionHref="/shop"
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
