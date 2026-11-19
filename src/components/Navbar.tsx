import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useStore } from '@/store'

const links = [
  { to: '/shop', label: 'Shop' },
  { to: '/fitting-room', label: 'Fitting Room' },
  { to: '/garage', label: 'Garage' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/contact', label: 'Contact' },
]

export function Navbar() {
  const { cartCount } = useStore()
  const [open, setOpen] = useState(false)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors hover:text-[var(--color-foreground)] ${
      isActive ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" className="font-heading text-xl font-black tracking-tighter">
          The BikEr<span className="text-[var(--color-primary)]">Gang</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/cart"
            className="relative grid size-10 place-items-center text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            aria-label={`Cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}
          >
            <span aria-hidden="true" className="text-lg">🛒</span>
            {cartCount > 0 && (
              <span className="absolute right-0 top-0 grid min-w-4 place-items-center bg-[var(--color-primary)] px-1 font-mono text-[10px] text-[var(--color-primary-foreground)]">
                {cartCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            className="grid size-10 place-items-center text-xl lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" className="grid grid-cols-2 border-t border-[var(--color-border)] px-5 py-3 lg:hidden" aria-label="Mobile">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="border-b border-[var(--color-border)] py-3 text-sm font-medium"
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
