// Fitting Room — avatar body scaling + the demo wardrobe used by the studio.
import { buildWidthFactor } from './appearance'
import type { AvatarProfile, OutfitPiece, Size, Slot, SlotOption } from './types'

// The GLB is normalised to ~1.70 m with a ~45 cm shoulder breadth.
const BASE_HEIGHT_CM = 170
const BASE_SHOULDER_CM = 45

export type AvatarScale = { x: number; y: number; z: number }

/** Non-uniform scale that stretches the base mesh toward the measured body. */
export function avatarScale(p: AvatarProfile): AvatarScale {
  const y = clamp(p.heightCm / BASE_HEIGHT_CM, 0.82, 1.22)
  const shoulderNudge = clamp(p.shoulderCm / BASE_SHOULDER_CM, 0.85, 1.2)
  const width = clamp(buildWidthFactor(p.appearance) * shoulderNudge, 0.82, 1.3)
  const z = 1 + (width - 1) * 0.6 // depth follows width, gentler
  return { x: width, y, z }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// --- Demo wardrobe (names + real garment colours) ---------------------------
export const WARDROBE: Record<Slot, SlotOption[]> = {
  helmet: [
    { slot: 'helmet', name: 'Apex Carbon', color: '#1c1f24' },
    { slot: 'helmet', name: 'Ghost White', color: '#e8e9eb' },
    { slot: 'helmet', name: 'Race Red', color: '#d23b2c' },
  ],
  jacket: [
    { slot: 'jacket', name: 'Storm Pro Black', color: '#262b33' },
    { slot: 'jacket', name: 'Sand Adventure', color: '#c6a57a' },
    { slot: 'jacket', name: 'Hi-Viz Yellow', color: '#cdd94a' },
  ],
  back: [{ slot: 'back', name: 'Guardian Insert', color: '#2b2f36' }],
  gloves: [
    { slot: 'gloves', name: 'Vector Black', color: '#20242b' },
    { slot: 'gloves', name: 'Tan Leather', color: '#b4844f' },
  ],
  pants: [
    { slot: 'pants', name: 'Trail Grey', color: '#3a3f47' },
    { slot: 'pants', name: 'Indigo Denim', color: '#324259' },
  ],
  boots: [
    { slot: 'boots', name: 'Monsoon Black', color: '#1b1e24' },
    { slot: 'boots', name: 'Touring Brown', color: '#6b4a32' },
  ],
}

export const SLOT_ORDER: Slot[] = ['helmet', 'jacket', 'back', 'gloves', 'pants', 'boots']

/** A sensible starting outfit (one core piece per slot, at the ideal size). */
export function defaultOutfit(sizeFor: (slot: Slot) => Size): OutfitPiece[] {
  const slots: Slot[] = ['helmet', 'jacket', 'gloves', 'pants', 'boots']
  return slots.map((slot) => {
    const opt = WARDROBE[slot][0]
    return { slot, name: opt.name, color: opt.color, size: sizeFor(slot) }
  })
}
