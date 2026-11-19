import { Link, Outlet, ScrollRestoration } from 'react-router-dom'
import { Navbar } from './Navbar'

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-[var(--color-primary)] focus:px-3 focus:py-2 focus:text-[var(--color-primary-foreground)]"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 md:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <div className="font-heading text-2xl font-black">
              The BikEr<span className="text-[var(--color-primary)]">Gang</span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--color-muted-foreground)]">
              Gear intelligence built around your bike, roads, and riding style.
            </p>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm text-[var(--color-muted-foreground)]" aria-label="Footer">
            <Link to="/shop">Shop</Link>
            <Link to="/garage">Garage</Link>
            <Link to="/wishlist">Wishlist</Link>
            <Link to="/contact">Contact</Link>
            <span>© 2026</span>
          </nav>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  )
}
