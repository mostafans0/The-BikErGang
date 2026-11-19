import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { estimateMeasurements, type Landmark2D, type Vec3 } from '@/features/fitting-room/estimate'
import {
  averageSkinTone,
  BUILD_LABEL,
  classifyBuild,
  DEFAULT_SKIN,
  rgbToHex,
  type RGB,
} from '@/features/fitting-room/appearance'
import { assessOutfit, idealSizeFor, SLOT_LABEL } from '@/features/fitting-room/fit'
import { avatarScale, SLOT_ORDER } from '@/features/fitting-room/avatar'
import type { Wardrobe } from '@/features/fitting-room/catalog'
import { SIZES, type AvatarProfile, type Build, type OutfitPiece, type Size, type Slot } from '@/features/fitting-room/types'
import type { WornMap, PoseName } from '@/components/AvatarModel'

const AvatarModel = lazy(() => import('@/components/AvatarModel').then((m) => ({ default: m.AvatarModel })))

const MP_VERSION = '0.10.14'
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'

const GRADE_COLOR: Record<string, string> = { A: '#34d399', B: '#60a5fa', C: '#fbbf24', D: '#fb923c', F: '#f87171' }
const VERDICT_COLOR: Record<string, string> = { good: '#34d399', loose: '#fbbf24', tight: '#f87171' }
const BUILDS: Build[] = ['slim', 'regular', 'athletic', 'broad']

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const isSize = (s: string): s is Size => (SIZES as readonly string[]).includes(s)

type Mode = 'upload' | 'analyzing' | 'studio'
type Worn = { slug: string; name: string; color: string; size: Size; image: string; glb: string }
type Selected = Partial<Record<Slot, Worn>>

/** Closest available size to the body's ideal. */
function pickSize(ideal: Size, available: string[]): Size {
  const avail = available.filter(isSize)
  if (!avail.length) return ideal
  if (avail.includes(ideal)) return ideal
  const ii = SIZES.indexOf(ideal)
  return avail.reduce((best, s) => (Math.abs(SIZES.indexOf(s) - ii) < Math.abs(SIZES.indexOf(best) - ii) ? s : best))
}

function sampleSkin(img: HTMLImageElement, image: Landmark2D[] | null): RGB[] {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  ctx.drawImage(img, 0, 0)
  const samples: RGB[] = []
  let cx = canvas.width / 2
  let cy = canvas.height * 0.18
  let span = canvas.width * 0.08
  if (image && image[0]) {
    const nose = image[0]
    cx = nose.x * canvas.width
    cy = nose.y * canvas.height
    const lEar = image[7]
    const rEar = image[8]
    const earGap = lEar && rEar ? Math.abs(lEar.x - rEar.x) * canvas.width : canvas.width * 0.12
    span = Math.max(earGap * 0.3, 8)
  }
  const offs = [-0.3, 0, 0.3]
  for (const dx of offs) {
    for (const dy of offs) {
      const x = clampN(Math.round(cx + dx * span), 0, canvas.width - 1)
      const y = clampN(Math.round(cy + dy * span), 0, canvas.height - 1)
      const d = ctx.getImageData(x, y, 1, 1).data
      samples.push({ r: d[0], g: d[1], b: d[2] })
    }
  }
  return samples
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image failed to load'))
    img.src = url
  })
}

function manualProfile(heightCm: number, build: Build, skinTone: string): AvatarProfile {
  const widthAdj = { slim: 0.92, regular: 1.0, athletic: 1.05, broad: 1.14 }[build]
  const shoulderCm = Math.round(heightCm * 0.247 * widthAdj)
  const chestCm = Math.round(shoulderCm * 2.35)
  const waistCm = Math.round(chestCm * (build === 'broad' ? 0.95 : build === 'slim' ? 0.78 : 0.85))
  const hipCm = Math.round(waistCm * 1.06)
  return {
    heightCm,
    shoulderCm,
    chestCm,
    waistCm,
    hipCm,
    inseamCm: Math.round(heightCm * 0.45),
    torsoCm: Math.round(heightCm * 0.32),
    sleeveCm: Math.round(heightCm * 0.34),
    appearance: { skinTone, build },
    confidence: 0.6,
    notes: ['Built from your height and body type — upload a full-body photo for a closer match.'],
    source: 'manual',
  }
}

export function FittingRoom({ wardrobe }: { wardrobe: Wardrobe }) {
  const [mode, setMode] = useState<Mode>('upload')
  const [height, setHeight] = useState('')
  const [manualBuild, setManualBuild] = useState<Build>('regular')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [profile, setProfile] = useState<AvatarProfile | null>(null)
  const [selected, setSelected] = useState<Selected>({})
  const [pose, setPose] = useState<PoseName>('relaxed')
  const [idle, setIdle] = useState(true)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const outfit: OutfitPiece[] = useMemo(
    () => SLOT_ORDER.filter((s) => selected[s]).map((s) => ({ slot: s, name: selected[s]!.name, color: selected[s]!.color, size: selected[s]!.size })),
    [selected],
  )
  const worn: WornMap = useMemo(() => {
    const m: WornMap = {}
    for (const s of SLOT_ORDER) {
      const sel = selected[s]
      if (sel) m[s] = { color: sel.color, image: sel.image, glb: sel.glb }
    }
    return m
  }, [selected])
  const assessment = useMemo(() => (profile ? assessOutfit(profile, outfit) : null), [profile, outfit])
  const scale = useMemo(() => (profile ? avatarScale(profile) : { x: 1, y: 1, z: 1 }), [profile])
  // Measurement → body morph influences (girth deforms the mesh, not global scale).
  const morphs = useMemo(() => {
    const cl = (n: number) => Math.max(-0.5, Math.min(1.7, n))
    return profile
      ? { chest: cl((profile.chestCm - 100) / 38), waist: cl((profile.waistCm - 84) / 40), hips: cl((profile.hipCm - 98) / 42) }
      : { chest: 0, waist: 0, hips: 0 }
  }, [profile])

  function initOutfit(p: AvatarProfile) {
    const core: Slot[] = ['helmet', 'jacket', 'gloves', 'pants', 'boots']
    const next: Selected = {}
    for (const slot of core) {
      const item = wardrobe[slot][0]
      if (!item) continue
      next[slot] = {
        slug: item.slug,
        name: item.name,
        color: item.colors[0].hex,
        size: pickSize(idealSizeFor(slot, p), item.sizes),
        image: item.image,
        glb: item.glb,
      }
    }
    setSelected(next)
  }

  async function onPhoto(file: File) {
    setError('')
    setBusy(true)
    setMode('analyzing')
    try {
      const img = await loadImage(file)
      let world: Vec3[] | undefined
      let image: Landmark2D[] | undefined
      try {
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'IMAGE',
          numPoses: 1,
        })
        const result = landmarker.detect(img)
        landmarker.close()
        world = result.worldLandmarks?.[0] as Vec3[] | undefined
        image = result.landmarks?.[0] as Landmark2D[] | undefined
      } catch {
        // pose model unavailable — fall through to skin-only + manual sizing
      }

      const skin = sampleSkin(img, image ?? null)
      const skinTone = skin.length ? rgbToHex(averageSkinTone(skin)) : DEFAULT_SKIN
      URL.revokeObjectURL(img.src)

      if (world && image && world.length >= 29) {
        const est = estimateMeasurements(world, image, height ? Number(height) : null)
        const m = est.measurements
        const build = classifyBuild(m.shoulderCm, m.waistCm)
        const p: AvatarProfile = {
          heightCm: m.heightCm ?? (height ? Number(height) : 175),
          shoulderCm: m.shoulderCm,
          chestCm: m.chestCm,
          waistCm: m.waistCm,
          hipCm: m.hipCm,
          inseamCm: m.inseamCm,
          torsoCm: m.torsoCm,
          sleeveCm: m.sleeveCm,
          appearance: { skinTone, build },
          confidence: est.confidence,
          notes: ['Measurements estimated on your device from the photo — nothing was uploaded.', ...est.notes],
          source: 'photo',
        }
        setProfile(p)
        initOutfit(p)
        setMode('studio')
      } else {
        const h = height ? Number(height) : 175
        const p = manualProfile(h, manualBuild, skinTone)
        p.notes = ['No full body was detected in the photo, so sizing uses your height and body type.', ...p.notes]
        setProfile(p)
        initOutfit(p)
        setMode('studio')
        setError('We could not read a full body from that photo — stand full-length in frame for a closer match. Using your height and body type for now.')
      }
    } catch {
      setError('That image could not be processed. Try another photo, or build your avatar manually below.')
      setMode('upload')
    } finally {
      setBusy(false)
    }
  }

  function buildManual() {
    const h = height ? Number(height) : 0
    if (!h || h < 120 || h > 220) {
      setError('Enter a height between 120 and 220 cm.')
      return
    }
    setError('')
    const p = manualProfile(h, manualBuild, DEFAULT_SKIN)
    setProfile(p)
    initOutfit(p)
    setMode('studio')
  }

  function chooseProduct(slot: Slot, slug: string) {
    if (!slug) {
      setSelected((prev) => {
        const next = { ...prev }
        delete next[slot]
        return next
      })
      return
    }
    const item = wardrobe[slot].find((i) => i.slug === slug)
    if (!item || !profile) return
    setSelected((prev) => ({
      ...prev,
      [slot]: { slug: item.slug, name: item.name, color: item.colors[0].hex, size: pickSize(idealSizeFor(slot, profile), item.sizes), image: item.image, glb: item.glb },
    }))
  }
  function setColor(slot: Slot, color: string) {
    setSelected((prev) => (prev[slot] ? { ...prev, [slot]: { ...prev[slot]!, color } } : prev))
  }
  function setSize(slot: Slot, size: Size) {
    setSelected((prev) => (prev[slot] ? { ...prev, [slot]: { ...prev[slot]!, size } } : prev))
  }

  function reset() {
    setProfile(null)
    setSelected({})
    setMode('upload')
    setError('')
  }

  // ---------------------------------------------------------------- UPLOAD ---
  if (mode !== 'studio') {
    return (
      <div className="mx-auto max-w-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-heading text-xl font-bold">Build your avatar</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Upload a clear, front-facing full-body photo. Your device reads your proportions and skin tone to build a
          3D stand-in of you — <span className="text-foreground">the photo never leaves your browser</span>. Then dress
          it in real gear from the shop and see how each piece fits and looks.
        </p>

        <label className="mt-6 block text-sm font-medium">
          Your height (cm) — improves sizing
          <input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="numeric" placeholder="178" className="field" />
        </label>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPhoto(f)
            e.target.value = ''
          }}
        />

        {error && (
          <p role="alert" className="mt-5 border border-destructive p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || mode === 'analyzing'} className="btn-primary disabled:opacity-50">
            {mode === 'analyzing' ? 'Analyzing photo…' : 'Upload a photo'}
          </button>
          <span className="text-xs text-muted-foreground">or</span>
          <select value={manualBuild} onChange={(e) => setManualBuild(e.target.value as Build)} className="field !mt-0 w-auto" aria-label="Body type">
            {BUILDS.map((b) => (
              <option key={b} value={b}>
                {BUILD_LABEL[b]} build
              </option>
            ))}
          </select>
          <button type="button" onClick={buildManual} disabled={busy} className="btn-secondary disabled:opacity-50">
            Build manually
          </button>
        </div>

        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          On-device only: pose and colour are read in your browser with MediaPipe; no image is stored or sent. The
          avatar is a proportional stand-in, not a biometric likeness.
        </p>
      </div>
    )
  }

  // ---------------------------------------------------------------- STUDIO ---
  const p = profile!
  const a = assessment!
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Stage */}
      <section className="technical-grid relative h-[66vh] min-h-[500px] overflow-hidden border border-border bg-background">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Rendering studio…</div>}>
          <AvatarModel skinTone={p.appearance.skinTone} scale={scale} worn={worn} morphs={morphs} pose={pose} idle={idle} />
        </Suspense>

        {/* Pose + animation controls */}
        <div className="absolute bottom-4 left-5 flex items-center gap-2">
          {([
            ['relaxed', 'Relaxed'],
            ['open', 'Open'],
            ['raised', 'Raised'],
          ] as const).map(([p2, label]) => (
            <button
              key={p2}
              type="button"
              onClick={() => setPose(p2)}
              aria-pressed={pose === p2}
              className="border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors"
              style={{
                borderColor: pose === p2 ? 'var(--color-primary)' : 'var(--color-border)',
                color: pose === p2 ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                background: pose === p2 ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'rgba(0,0,0,0.3)',
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIdle((v) => !v)}
            aria-pressed={idle}
            title="Toggle idle breathing animation"
            className="border border-border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
            style={{ background: 'rgba(0,0,0,0.3)' }}
          >
            {idle ? '❚❚ Idle' : '▶ Idle'}
          </button>
        </div>

        <div className="pointer-events-none absolute left-5 top-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Outfit score</p>
          <div className="mt-1 flex items-end gap-3">
            <span className="font-heading text-6xl font-black leading-none" style={{ color: GRADE_COLOR[a.grade] }}>
              {a.overall}
            </span>
            <span className="mb-1 grid size-9 place-items-center border-2 font-heading text-lg font-black" style={{ borderColor: GRADE_COLOR[a.grade], color: GRADE_COLOR[a.grade] }}>
              {a.grade}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Fit {a.fitScore} · Look {a.lookScore}
          </p>
        </div>

        <div className="pointer-events-none absolute right-5 top-5 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <p>Your avatar</p>
          <p className="mt-1 flex items-center justify-end gap-1.5">
            <span className="inline-block size-2.5 border border-border" style={{ background: p.appearance.skinTone }} />
            {BUILD_LABEL[p.appearance.build]} · {p.heightCm} cm
          </p>
          <p className="mt-0.5">{p.source === 'photo' ? `Photo match ${Math.round(p.confidence * 100)}%` : 'Manual build'}</p>
        </div>

        <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Drag to rotate
        </p>
      </section>

      {/* Controls + verdict */}
      <aside className="flex flex-col gap-5">
        {error && (
          <p role="status" className="border border-border bg-card p-3 text-xs text-muted-foreground">
            {error}
          </p>
        )}

        <div className="border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">The verdict</h2>
          <p className="mt-2 text-sm leading-6">{a.verdictLine}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {([
              ['Fit', a.fitScore],
              ['Look', a.lookScore],
            ] as const).map(([label, val]) => (
              <div key={label}>
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <span className="font-mono">{val}%</span>
                </div>
                <div className="mt-1 h-2 bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${val}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{a.paletteNote}</p>
        </div>

        {/* Real-catalog wardrobe */}
        <div className="border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Try on shop gear</h2>
          <p className="mt-1 text-xs text-muted-foreground">Pick real products — the avatar wears each in your chosen colour and size.</p>
          <div className="mt-4 flex flex-col gap-5">
            {SLOT_ORDER.map((slot) => {
              const items = wardrobe[slot]
              if (!items.length) return null
              const sel = selected[slot]
              const item = sel ? items.find((i) => i.slug === sel.slug) : undefined
              const fit = a.pieces.find((pp) => pp.slot === slot)
              const sizeOptions = item ? item.sizes.filter(isSize) : []
              return (
                <div key={slot}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{SLOT_LABEL[slot]}</span>
                    {sel && fit && (
                      <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: VERDICT_COLOR[fit.verdict] }}>
                        {fit.verdict}
                        {fit.idealSize !== fit.chosenSize ? ` · ideal ${fit.idealSize}` : ''}
                      </span>
                    )}
                  </div>

                  <select
                    value={sel?.slug ?? ''}
                    onChange={(e) => chooseProduct(slot, e.target.value)}
                    className="field !mt-2"
                    aria-label={`${SLOT_LABEL[slot]} product`}
                  >
                    <option value="">— None —</option>
                    {items.map((i) => (
                      <option key={i.slug} value={i.slug}>
                        {i.brand} — {i.name.replace(`${i.brand} `, '')}
                      </option>
                    ))}
                  </select>

                  {item && sel && (
                    <div className="mt-2 flex items-center gap-3">
                      <Link to={`/product/${item.slug}`} className="shrink-0" title={`View ${item.name}`}>
                        <img src={item.image} alt="" className="size-12 border border-border object-cover" loading="lazy" />
                      </Link>
                      <div className="flex flex-1 flex-wrap items-center gap-1.5">
                        {item.colors.map((c) => {
                          const on = sel.color === c.hex
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => setColor(slot, c.hex)}
                              title={c.name}
                              aria-label={c.name}
                              aria-pressed={on}
                              className="size-5 rounded-sm border-2"
                              style={{ background: c.hex, borderColor: on ? 'var(--color-primary)' : 'var(--color-border)' }}
                            />
                          )
                        })}
                        {sizeOptions.length > 0 && (
                          <select
                            value={sel.size}
                            onChange={(e) => setSize(slot, e.target.value as Size)}
                            className="ml-auto border border-border bg-background px-2 py-1 text-xs"
                            aria-label={`${SLOT_LABEL[slot]} size`}
                          >
                            {sizeOptions.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {a.missing.length > 0 && (
          <div className="border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-bold">Complete the look</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {a.missing.map((s) => (
                <li key={s} className="border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  + {SLOT_LABEL[s]}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" onClick={reset} className="btn-secondary">
          Start over with a new photo
        </button>
      </aside>
    </div>
  )
}
