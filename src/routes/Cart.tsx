import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getProduct } from '@/data/catalog'
import { formatPrice } from '@/lib/money'
import { EmptyState } from '@/components/EmptyState'
import { useStore } from '@/store'

export default function Cart() {
  const { cart, setQuantity, removeFromCart, clearCart } = useStore()
  const [placed, setPlaced] = useState(false)

  const lines = Object.entries(cart)
    .map(([slug, quantity]) => {
      const product = getProduct(slug)
      return product ? { product, quantity } : null
    })
    .filter((l): l is { product: NonNullable<ReturnType<typeof getProduct>>; quantity: number } => l !== null)

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0)

  if (placed) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20">
        <div role="status" className="technical-grid border border-[var(--color-primary)] bg-[var(--color-card)] p-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--color-primary)] text-2xl text-white">✓</div>
          <h1 className="section-title mt-5">Order confirmed.</h1>
          <p className="mt-3 text-[var(--color-muted-foreground)]">
            Thanks for shopping with The BikErGang. This is a demo checkout — no payment was taken.
          </p>
          <Link to="/shop" className="btn-primary mt-7">
            Keep shopping
          </Link>
        </div>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <h1 className="section-title">Your cart.</h1>
        <div className="mt-8">
          <EmptyState
            title="Your cart is empty"
            description="Add gear to start building your next ride."
            actionLabel="Browse products"
            actionHref="/shop"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <h1 className="section-title">Your cart.</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <ul className="flex flex-col gap-4">
          {lines.map(({ product, quantity }) => (
            <li
              key={product.slug}
              className="grid grid-cols-[88px_1fr_auto] gap-4 border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <img src={product.image} alt="" className="aspect-square w-full object-cover" />
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)]">{product.category}</p>
                <Link to={`/product/${product.slug}`} className="mt-1 block font-heading text-lg font-bold">
                  {product.name}
                </Link>
                <p className="mt-2 font-mono text-sm">{formatPrice(product.price)}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Decrease quantity of ${product.name}`}
                    onClick={() => setQuantity(product.slug, quantity - 1)}
                    className="grid size-9 place-items-center border border-[var(--color-border)]"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-mono">{quantity}</span>
                  <button
                    type="button"
                    aria-label={`Increase quantity of ${product.name}`}
                    onClick={() => setQuantity(product.slug, quantity + 1)}
                    className="grid size-9 place-items-center border border-[var(--color-border)]"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${product.name}`}
                onClick={() => removeFromCart(product.slug)}
                className="self-start text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <aside className="h-fit border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <p className="eyebrow">Order summary</p>
          <div className="mt-6 flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="font-mono">{formatPrice(subtotal)}</span>
          </div>
          <div className="mt-3 flex justify-between text-sm text-[var(--color-muted-foreground)]">
            <span>Delivery</span>
            <span>Free</span>
          </div>
          <div className="mt-6 flex justify-between border-t border-[var(--color-border)] pt-5 font-bold">
            <span>Total</span>
            <span className="font-mono">{formatPrice(subtotal)}</span>
          </div>
          <button type="button" onClick={() => setPlaced(true)} className="btn-primary mt-6 w-full">
            Place order
          </button>
          <button type="button" onClick={clearCart} className="btn-secondary mt-3 w-full">
            Clear cart
          </button>
        </aside>
      </div>
    </div>
  )
}
