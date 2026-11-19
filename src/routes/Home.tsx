import { Link } from 'react-router-dom'
import { products } from '@/data/catalog'
import { ProductCard } from '@/components/ProductCard'

const featured = products.filter((p) => p.featured).slice(0, 4)
const fallback = featured.length >= 4 ? featured : products.slice(0, 4)

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <img
          src="/images/hero-rider.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[62%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-background)] via-[var(--color-background)]/80 to-transparent" />
        <div className="technical-grid relative mx-auto flex min-h-[70vh] max-w-7xl items-end px-5 py-16 lg:px-8">
          <div className="max-w-2xl">
            <p className="eyebrow">Context-aware motorcycle gear</p>
            <h1 className="mt-5 font-heading text-5xl font-black leading-[0.92] tracking-tighter sm:text-7xl">
              Gear that knows your ride.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-7 text-[var(--color-muted-foreground)]">
              Stop guessing. We match protection, fit, climate, and bike compatibility to the rider you actually are.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop" className="btn-primary">
                Shop all gear →
              </Link>
              <Link to="/garage" className="btn-secondary">
                Build your garage
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Featured</p>
            <h2 className="section-title mt-3">Top of the range.</h2>
          </div>
          <Link to="/shop" className="text-sm font-bold text-[var(--color-primary)]">
            View the full catalog →
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {fallback.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </>
  )
}
