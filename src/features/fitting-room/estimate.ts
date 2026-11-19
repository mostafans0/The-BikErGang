// Fitting Room — pose → body-measurement estimator (pure, self-contained copy of
// the platform's Rider-Twin estimator). Uses MediaPipe Pose *world* landmarks
// (metres, origin at the hip midpoint), so skeletal breadths/lengths are
// real-scale. Circumferences are derived from breadths with documented
// anthropometric ratios — ESTIMATES surfaced with a confidence score, never
// claimed exact. No imagery leaves the device; only these numbers are produced.

export type Vec3 = { x: number; y: number; z: number }
export type Landmark2D = { x: number; y: number; z: number; visibility?: number }

export type ScanMeasurements = {
  heightCm: number | null
  chestCm: number
  waistCm: number
  hipCm: number
  sleeveCm: number
  shoulderCm: number
  inseamCm: number
  torsoCm: number
}

export type ScanEstimate = {
  measurements: ScanMeasurements
  confidence: number
  notes: string[]
}

// MediaPipe Pose landmark indices.
const L = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const

const CHEST_FROM_SHOULDER = 2.35
const WAIST_FROM_HIP_BREADTH = 2.55
const HIP_FROM_HIP_BREADTH = 2.9

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const mid = (a: Vec3, b: Vec3): Vec3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 })
const round1 = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round3 = (n: number) => Math.round(n * 1000) / 1000

function bestArm(vis: (i: number) => number): 'left' | 'right' {
  const left = vis(L.leftShoulder) + vis(L.leftElbow) + vis(L.leftWrist)
  const right = vis(L.rightShoulder) + vis(L.rightElbow) + vis(L.rightWrist)
  return left >= right ? 'left' : 'right'
}

export function estimateMeasurements(world: Vec3[], image: Landmark2D[], heightCm: number | null): ScanEstimate {
  const vis = (i: number) => image[i]?.visibility ?? 0
  const notes: string[] = []

  const shoulderCm = clamp(dist(world[L.leftShoulder], world[L.rightShoulder]) * 100, 25, 80)
  const hipBreadthCm = clamp(dist(world[L.leftHip], world[L.rightHip]) * 100, 20, 60)

  const arm = bestArm(vis)
  const s = arm === 'left' ? L.leftShoulder : L.rightShoulder
  const e = arm === 'left' ? L.leftElbow : L.rightElbow
  const w = arm === 'left' ? L.leftWrist : L.rightWrist
  const sleeveCm = clamp((dist(world[s], world[e]) + dist(world[e], world[w])) * 100, 30, 120)

  const shoulderCenter = mid(world[L.leftShoulder], world[L.rightShoulder])
  const hipCenter = mid(world[L.leftHip], world[L.rightHip])
  const torsoCm = clamp(dist(shoulderCenter, hipCenter) * 100, 30, 100)

  const hipSide = arm === 'left' ? L.leftHip : L.rightHip
  const knee = arm === 'left' ? L.leftKnee : L.rightKnee
  const ankle = arm === 'left' ? L.leftAnkle : L.rightAnkle
  const inseamCm = clamp((dist(world[hipSide], world[knee]) + dist(world[knee], world[ankle])) * 100, 40, 120)

  const chestCm = clamp(shoulderCm * CHEST_FROM_SHOULDER, 60, 160)
  const waistCm = clamp(hipBreadthCm * WAIST_FROM_HIP_BREADTH, 55, 160)
  const hipCm = clamp(hipBreadthCm * HIP_FROM_HIP_BREADTH, 60, 170)

  const used = [L.leftShoulder, L.rightShoulder, L.leftHip, L.rightHip, s, e, w, knee, ankle]
  const meanVis = used.reduce((sum, i) => sum + vis(i), 0) / used.length

  let scalePenalty = 0
  if (heightCm && heightCm > 100) {
    const ankleCenter = mid(world[L.leftAnkle], world[L.rightAnkle])
    const spanCm = dist(world[L.nose], ankleCenter) * 100
    const expected = heightCm * 0.82
    const ratio = spanCm / expected
    if (ratio < 0.7 || ratio > 1.3) {
      scalePenalty = 0.25
      notes.push('Measured scale differs from your height — stand fully in frame for a better match.')
    }
  } else {
    notes.push('Add your height to improve calibration.')
  }

  const confidence = round3(clamp(meanVis * 0.9 - scalePenalty, 0, 1))
  if (meanVis < 0.6) notes.push('Some body points were hard to see — ensure your whole body is lit and in frame.')

  const measurements: ScanMeasurements = {
    heightCm: heightCm ?? null,
    chestCm: round1(chestCm),
    waistCm: round1(waistCm),
    hipCm: round1(hipCm),
    sleeveCm: round1(sleeveCm),
    shoulderCm: round1(shoulderCm),
    inseamCm: round1(inseamCm),
    torsoCm: round1(torsoCm),
  }
  return { measurements, confidence, notes }
}
