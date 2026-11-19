// Fitting Room — map the REAL shop catalog onto wearable gear slots, so the
// studio dresses the avatar in actual products (real names, colourways, sizes),
// each rendered as its category's 3D model recoloured to the chosen variant.
import { products, type Product } from '@/data/catalog'
import type { Slot } from './types'

export type ColorOption = { name: string; hex: string }
export type WardrobeItem = {
  slug: string
  name: string
  brand: string
  slot: Slot
  colors: ColorOption[]
  sizes: string[]
  image: string
  glb: string // generated 3D model derived from the product image
}

// /products/<cat>/<name>.webp  ->  /models/products/<cat>/<name>.glb
export function glbForImage(image: string): string {
  return image.replace('/products/', '/models/products/').replace(/\.(webp|jpg|jpeg|png)$/i, '.glb')
}

// Colour-name → hex. Multi-tone names resolve to their dominant/able-to-read tone.
const COLOR_HEX: Record<string, string> = {
  Black: '#17191d',
  Navy: '#1f2a44',
  Grey: '#474c54',
  Gray: '#474c54',
  Sand: '#c3a06a',
  Olive: '#565a39',
  White: '#e8e9eb',
  Red: '#c0392b',
  Blue: '#2f4a7a',
  Brown: '#6b4a32',
  'Black/Red': '#9b2f27',
  'Black/White': '#cfd2d8',
  'Hi-Viz': '#cdd94a',
}
function hexFor(name: string): string {
  return COLOR_HEX[name] ?? '#3a3f47'
}

const PANT_RE = /\b(pant|trouser|jean|legging|denim|kevlar|cargo)\b/i

/** Which wearable slot a product occupies, or null if it isn't worn on the body. */
export function slotForProduct(p: Pick<Product, 'category' | 'name'>): Slot | null {
  const c = p.category.toLowerCase()
  if (c.includes('helmet')) return 'helmet'
  if (c.includes('glove')) return 'gloves'
  if (c.includes('foot') || c.includes('boot') || c.includes('shoe')) return 'boots'
  if (c.includes('protection') || c.includes('armor') || c.includes('armour')) return 'back'
  if (c.includes('apparel') || c.includes('jacket') || c.includes('suit')) {
    return PANT_RE.test(p.name) ? 'pants' : 'jacket'
  }
  return null // luggage, electronics, accessories — not worn on the body
}

function toItem(p: Product): WardrobeItem {
  const slot = slotForProduct(p)!
  const names = p.colors && p.colors.length ? p.colors : ['Black']
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    slot,
    colors: names.map((name) => ({ name, hex: hexFor(name) })),
    sizes: p.sizes && p.sizes.length ? p.sizes : ['S', 'M', 'L', 'XL'],
    image: p.image,
    glb: glbForImage(p.image),
  }
}

export type Wardrobe = Record<Slot, WardrobeItem[]>

export function buildWardrobe(list: Product[] = products): Wardrobe {
  const out: Wardrobe = { helmet: [], jacket: [], back: [], gloves: [], pants: [], boots: [] }
  for (const p of list) {
    const slot = slotForProduct(p)
    if (slot) out[slot].push(toItem(p))
  }
  for (const s of Object.keys(out) as Slot[]) out[s].sort((a, b) => a.name.localeCompare(b.name))
  return out
}
