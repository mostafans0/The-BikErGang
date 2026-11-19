// Fitting Room — deterministic fit + look engine.
//
// Given the avatar's measurements and the outfit worn, it decides for each piece
// whether the chosen size is tight / good / loose (vs the size the body actually
// needs), then blends a fit score with a "look" score (completeness + colour
// harmony). Fully reproducible — no model is involved (ADR-004).
import {
  SIZES,
  type AvatarProfile,
  type OutfitAssessment,
  type OutfitPiece,
  type PieceFit,
  type Size,
  type Slot,
  type FitVerdict,
} from './types'

// Core slots that make a "complete" riding outfit.
const CORE_SLOTS: Slot[] = ['helmet', 'jacket', 'gloves', 'pants', 'boots']

const SLOT_LABEL: Record<Slot, string> = {
  helmet: 'Helmet',
  jacket: 'Jacket',
  back: 'Back protector',
  gloves: 'Gloves',
  pants: 'Trousers',
  boots: 'Boots',
}

const idx = (s: Size) => SIZES.indexOf(s)
const bySize = (i: number): Size => SIZES[Math.max(0, Math.min(SIZES.length - 1, i))]

// --- The size the body needs, per garment type ------------------------------
function sizeFromChest(chestCm: number): number {
  if (chestCm < 86) return 0 // XS
  if (chestCm < 94) return 1 // S
  if (chestCm < 102) return 2 // M
  if (chestCm < 110) return 3 // L
  if (chestCm < 119) return 4 // XL
  return 5 // XXL
}
function sizeFromWaist(waistCm: number): number {
  if (waistCm < 74) return 0
  if (waistCm < 82) return 1
  if (waistCm < 90) return 2
  if (waistCm < 99) return 3
  if (waistCm < 108) return 4
  return 5
}
// Helmet/gloves/boots scale with overall frame (height as a cheap proxy).
function sizeFromFrame(heightCm: number): number {
  if (heightCm < 162) return 1
  if (heightCm < 172) return 2
  if (heightCm < 182) return 3
  if (heightCm < 192) return 4
  return 5
}

export function idealSizeFor(slot: Slot, p: AvatarProfile): Size {
  switch (slot) {
    case 'jacket':
    case 'back':
      return bySize(sizeFromChest(p.chestCm))
    case 'pants':
      return bySize(sizeFromWaist(p.waistCm))
    case 'helmet':
    case 'gloves':
    case 'boots':
      return bySize(sizeFromFrame(p.heightCm))
  }
}

function verdictFor(delta: number): FitVerdict {
  if (delta <= -1) return 'tight'
  if (delta >= 1) return 'loose'
  return 'good'
}

function pieceNote(slot: Slot, delta: number): string {
  const label = SLOT_LABEL[slot]
  if (delta === 0) return `${label} sits true to size.`
  if (delta === -1) return `${label} will feel snug — consider one size up.`
  if (delta <= -2) return `${label} is too small — size up.`
  if (delta === 1) return `${label} is a touch roomy — fine for layering.`
  return `${label} is oversized — size down for a cleaner line.`
}

// Fit quality per piece: perfect at delta 0, falling off with each step.
function fitQuality(delta: number): number {
  const d = Math.abs(delta)
  if (d === 0) return 100
  if (d === 1) return 72
  if (d === 2) return 42
  return 18
}

// --- Colour harmony ---------------------------------------------------------
function hexToHue(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

// 0..1 — how coherent the worn colours are.
function paletteHarmony(colors: string[]): { score: number; note: string } {
  if (colors.length <= 1) return { score: 1, note: 'A clean, single-tone look.' }
  const hsl = colors.map(hexToHue)
  const accents = hsl.filter((c) => c.s > 0.22 && c.l > 0.1 && c.l < 0.92)
  if (accents.length <= 1) return { score: 0.96, note: 'Mostly neutrals with one accent — effortless and safe.' }

  // Spread of accent hues.
  const hues = accents.map((c) => c.h).sort((a, b) => a - b)
  let maxGap = 0
  for (let i = 1; i < hues.length; i++) maxGap = Math.max(maxGap, hues[i] - hues[i - 1])
  const spread = 360 - maxGap // smallest arc containing all accent hues
  if (spread <= 45) return { score: 0.92, note: 'Tight analogous palette — the colours sit next to each other and agree.' }
  if (spread >= 150 && spread <= 210) return { score: 0.86, note: 'Complementary contrast — bold but balanced.' }
  if (accents.length >= 3 && spread > 120) return { score: 0.55, note: 'Three or more competing colours — busy; pull one back to a neutral.' }
  return { score: 0.72, note: 'Colours mostly work; a little contrast-heavy.' }
}

export function assessOutfit(profile: AvatarProfile, outfit: OutfitPiece[]): OutfitAssessment {
  const pieces: PieceFit[] = outfit.map((item) => {
    const ideal = idealSizeFor(item.slot, profile)
    const delta = idx(item.size) - idx(ideal)
    return {
      slot: item.slot,
      name: item.name,
      verdict: verdictFor(delta),
      idealSize: ideal,
      chosenSize: item.size,
      delta,
      note: pieceNote(item.slot, delta),
    }
  })

  // Fit score — average quality of worn pieces.
  const fitScore = pieces.length
    ? Math.round(pieces.reduce((s, p) => s + fitQuality(p.delta), 0) / pieces.length)
    : 0

  // Completeness — fraction of core slots covered (0..1).
  const wornSlots = new Set(outfit.map((o) => o.slot))
  const missing = CORE_SLOTS.filter((s) => !wornSlots.has(s))
  const completeness = (CORE_SLOTS.length - missing.length) / CORE_SLOTS.length

  // Look — completeness 60% + colour harmony 40%.
  const palette = paletteHarmony(outfit.map((o) => o.color))
  const lookScore = Math.round((completeness * 0.6 + palette.score * 0.4) * 100)

  const overall = Math.round(fitScore * 0.6 + lookScore * 0.4)
  const grade: OutfitAssessment['grade'] =
    overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 35 ? 'D' : 'F'

  const verdictLine = buildVerdictLine(overall, pieces, missing)

  return {
    fitScore,
    lookScore,
    overall,
    grade,
    pieces,
    missing,
    paletteNote: palette.note,
    verdictLine,
  }
}

function buildVerdictLine(overall: number, pieces: PieceFit[], missing: Slot[]): string {
  const offSize = pieces.filter((p) => p.verdict !== 'good')
  if (overall >= 85 && missing.length === 0) return 'Dialled in — this outfit fits you and reads as one coherent look.'
  if (missing.length >= 3) return 'Looking good, but it is barely an outfit yet — add a few more pieces.'
  if (offSize.length === 0 && missing.length > 0)
    return `Everything you are wearing fits well; you are missing ${missing.map((s) => SLOT_LABEL[s].toLowerCase()).join(', ')}.`
  if (offSize.length >= 2) return 'The look works, but the sizing is off on a couple of pieces — see the notes.'
  if (overall >= 70) return 'Solid fit overall with one piece to tweak.'
  return 'This needs work — the fit and the pairing can both be tightened up.'
}

export { SLOT_LABEL, CORE_SLOTS }
