import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type Motorcycle = {
  id: string
  year: string
  make: string
  model: string
  category: string
  engine: string
}

type StoreState = {
  cart: Record<string, number>
  wishlist: string[]
  motorcycles: Motorcycle[]
  activeMotorcycleId: string | null
  cartCount: number
  addToCart: (slug: string, qty?: number) => void
  setQuantity: (slug: string, qty: number) => void
  removeFromCart: (slug: string) => void
  clearCart: () => void
  toggleWishlist: (slug: string) => void
  isWishlisted: (slug: string) => boolean
  addMotorcycle: (m: Omit<Motorcycle, 'id'>) => void
  removeMotorcycle: (id: string) => void
  setActiveMotorcycle: (id: string) => void
}

const StoreContext = createContext<StoreState | null>(null)

function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [key, value])
  return [value, setValue]
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = usePersistentState<Record<string, number>>('bg.cart', {})
  const [wishlist, setWishlist] = usePersistentState<string[]>('bg.wishlist', [])
  const [motorcycles, setMotorcycles] = usePersistentState<Motorcycle[]>('bg.garage', [])
  const [activeMotorcycleId, setActiveMotorcycleId] = usePersistentState<string | null>('bg.activeMoto', null)

  const addToCart = useCallback(
    (slug: string, qty = 1) => setCart((c) => ({ ...c, [slug]: (c[slug] ?? 0) + qty })),
    [setCart],
  )
  const setQuantity = useCallback(
    (slug: string, qty: number) =>
      setCart((c) => {
        const next = { ...c }
        if (qty <= 0) delete next[slug]
        else next[slug] = qty
        return next
      }),
    [setCart],
  )
  const removeFromCart = useCallback(
    (slug: string) =>
      setCart((c) => {
        const next = { ...c }
        delete next[slug]
        return next
      }),
    [setCart],
  )
  const clearCart = useCallback(() => setCart({}), [setCart])
  const toggleWishlist = useCallback(
    (slug: string) => setWishlist((w) => (w.includes(slug) ? w.filter((s) => s !== slug) : [...w, slug])),
    [setWishlist],
  )
  const addMotorcycle = useCallback(
    (m: Omit<Motorcycle, 'id'>) => {
      const id = `moto-${Date.now()}`
      setMotorcycles((list) => [...list, { ...m, id }])
      setActiveMotorcycleId(id)
    },
    [setMotorcycles, setActiveMotorcycleId],
  )
  const removeMotorcycle = useCallback(
    (id: string) => {
      setMotorcycles((list) => list.filter((m) => m.id !== id))
      setActiveMotorcycleId((current) => (current === id ? null : current))
    },
    [setMotorcycles, setActiveMotorcycleId],
  )

  const value = useMemo<StoreState>(
    () => ({
      cart,
      wishlist,
      motorcycles,
      activeMotorcycleId,
      cartCount: Object.values(cart).reduce((sum, n) => sum + n, 0),
      addToCart,
      setQuantity,
      removeFromCart,
      clearCart,
      toggleWishlist,
      isWishlisted: (slug: string) => wishlist.includes(slug),
      addMotorcycle,
      removeMotorcycle,
      setActiveMotorcycle: setActiveMotorcycleId,
    }),
    [
      cart,
      wishlist,
      motorcycles,
      activeMotorcycleId,
      addToCart,
      setQuantity,
      removeFromCart,
      clearCart,
      toggleWishlist,
      addMotorcycle,
      removeMotorcycle,
      setActiveMotorcycleId,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
