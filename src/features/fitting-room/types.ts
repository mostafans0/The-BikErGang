// Fitting Room — build a photo-matched avatar, then judge whether an outfit fits
// and looks good. All on-device & deterministic (no imagery leaves the browser;
// no model picks the verdict).

export type Build = 'slim' | 'regular' | 'athletic' | 'broad'

export type Appearance = {
  skinTone: string // hex, sampled from the uploaded photo (face region)
  build: Build
}

// The parametric avatar derived from a photo (or manual entry).
export type AvatarProfile = {
  heightCm: number
  shoulderCm: number
  chestCm: number
  waistCm: number
  hipCm: number
  inseamCm: number
  torsoCm: number
  sleeveCm: number
  appearance: Appearance
  confidence: number // 0..1
  notes: string[]
  source: 'photo' | 'manual'
}

// A clothing slot on the body.
export type Slot = 'helmet' | 'jacket' | 'back' | 'gloves' | 'pants' | 'boots'

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
export type Size = (typeof SIZES)[number]

// A choosable garment in the wardrobe (before a size is picked).
export type SlotOption = {
  slot: Slot
  name: string
  color: string // hex
}

// One wearable item placed on the avatar.
export type OutfitPiece = {
  slot: Slot
  name: string
  color: string // hex — the garment's real colour, painted on the 3D piece
  size: Size
}

export type FitVerdict = 'tight' | 'good' | 'loose'

export type PieceFit = {
  slot: Slot
  name: string
  verdict: FitVerdict
  idealSize: Size
  chosenSize: Size
  delta: number // chosen − ideal, in size steps
  note: string
}

export type OutfitAssessment = {
  fitScore: number // 0..100 — does it fit the body
  lookScore: number // 0..100 — completeness + colour harmony
  overall: number // 0..100 — blended
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  pieces: PieceFit[]
  missing: Slot[] // core slots not worn
  paletteNote: string
  verdictLine: string // one-line human summary
}
