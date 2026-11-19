// Catalog data for the SPA.
// NOTE: `products.json` is a LOCAL snapshot of the live catalog (318 products),
// bundled so the frontend runs without a backend (Milestone 1 allows clearly
// labelled local data). Server integration is a Milestone 2 concern.
import raw from './products.json'

export type Product = {
  slug: string
  name: string
  brand: string
  category: string
  price: number
  originalPrice: number | null
  currency: string
  rating: number
  reviewCount: number
  image: string
  shortDescription: string
  description: string
  material: string
  weather: string[]
  ridingStyles: string[]
  sizes: string[]
  colors: string[]
  fit: string
  compatibility: string
  protection: string
  weight: string
  warranty: string
  featured: boolean
  popular: boolean
  newArrival: boolean
}

export const products: Product[] = raw as Product[]

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug)
}

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))

export const categories = uniqueSorted(products.map((p) => p.category))
export const brands = uniqueSorted(products.map((p) => p.brand))
export const ridingStyles = uniqueSorted(products.flatMap((p) => p.ridingStyles))
export const maxPrice = Math.max(...products.map((p) => p.price))

export type SortKey = 'popular' | 'price-asc' | 'price-desc' | 'rating' | 'name'

export type CatalogFilters = {
  q: string
  category: string
  brand: string
  style: string
  maxPrice: number
  minRating: number
  sort: SortKey
}

export const defaultFilters = (): CatalogFilters => ({
  q: '',
  category: 'All',
  brand: 'All',
  style: 'All',
  maxPrice: Math.ceil(maxPrice / 1000) * 1000,
  minRating: 0,
  sort: 'popular',
})

export function filterProducts(list: Product[], f: CatalogFilters): Product[] {
  const q = f.q.trim().toLowerCase()
  const result = list.filter((p) => {
    const haystack = `${p.name} ${p.brand} ${p.category} ${p.material} ${p.ridingStyles.join(' ')}`.toLowerCase()
    return (
      (f.category === 'All' || p.category === f.category) &&
      (f.brand === 'All' || p.brand === f.brand) &&
      (f.style === 'All' || p.ridingStyles.includes(f.style)) &&
      p.price <= f.maxPrice &&
      p.rating >= f.minRating &&
      (q === '' || haystack.includes(q))
    )
  })
  return result.sort((a, b) => {
    switch (f.sort) {
      case 'price-asc':
        return a.price - b.price
      case 'price-desc':
        return b.price - a.price
      case 'rating':
        return b.rating - a.rating
      case 'name':
        return a.name.localeCompare(b.name)
      default:
        return Number(b.popular) - Number(a.popular) || b.rating - a.rating
    }
  })
}
