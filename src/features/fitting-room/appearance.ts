// Fitting Room — appearance extraction helpers (pure; pixel sampling happens in
// the component and is passed in as plain RGB samples, so nothing here touches
// the DOM or the network).
import type { Appearance, Build } from './types'

export type RGB = { r: number; g: number; b: number }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Average a set of RGB samples, discarding obvious outliers (shadows/highlights). */
export function averageSkinTone(samples: RGB[]): RGB {
  const usable = samples.filter((s) => {
    const max = Math.max(s.r, s.g, s.b)
    const min = Math.min(s.r, s.g, s.b)
    if (max < 40 || min > 235) return false
    return s.r >= s.b
  })
  const pool = usable.length >= 3 ? usable : samples
  const sum = pool.reduce((a, s) => ({ r: a.r + s.r, g: a.g + s.g, b: a.b + s.b }), { r: 0, g: 0, b: 0 })
  const n = pool.length || 1
  return { r: Math.round(sum.r / n), g: Math.round(sum.g / n), b: Math.round(sum.b / n) }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** A believable fallback skin tone when sampling fails. */
export const DEFAULT_SKIN = '#c58c6a'

/** Classify build from shoulder breadth vs waist circumference. */
export function classifyBuild(shoulderCm: number, waistCm: number): Build {
  const ratio = shoulderCm / Math.max(waistCm, 1)
  if (waistCm >= 100) return 'broad'
  if (ratio >= 0.52) return 'athletic'
  if (ratio <= 0.42) return 'slim'
  return 'regular'
}

const BUILD_WIDTH: Record<Build, number> = {
  slim: 0.9,
  regular: 1.0,
  athletic: 1.07,
  broad: 1.16,
}

export function buildWidthFactor(appearance: Appearance): number {
  return BUILD_WIDTH[appearance.build]
}

export const BUILD_LABEL: Record<Build, string> = {
  slim: 'Slim',
  regular: 'Regular',
  athletic: 'Athletic',
  broad: 'Broad',
}
