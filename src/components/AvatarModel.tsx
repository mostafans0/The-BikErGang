import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, createPortal } from '@react-three/fiber'
import type { Group } from 'three'
import { ContactShadows, Decal, Environment, OrbitControls, RoundedBox, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Object3D, SkinnedMesh } from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Slot } from '@/features/fitting-room/types'

const AVATAR_URL = '/models/avatar.glb' // rigged MB-Lab human (skeleton + chest/waist/hip morphs)
const TARGET_HEIGHT = 1.7

export type AvatarScale = { x: number; y: number; z: number }
export type Morphs = { chest: number; waist: number; hips: number }
export type WornItem = { color: string; image?: string; glb?: string }
export type WornMap = Partial<Record<Slot, WornItem>>

// --------------------------------------------------------------- bump noise ---
// One tileable grain texture, shared, for a believable surface micro-relief.
let _bump: THREE.Texture | null = null
function getBump(): THREE.Texture {
  if (_bump) return _bump
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const n = 150 + Math.random() * 60 + (Math.random() < 0.5 ? 0 : 20)
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = n
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 4)
  _bump = tex
  return tex
}

// -------------------------------------------------- product image → texture ---
// Load a product photo, key out its (near-uniform) studio background to a
// transparent cutout, and sample the true dominant garment colour. Everything
// stays on-device. Returns null texture if the image is cross-origin tainted.
function processImage(img: HTMLImageElement): { tex: THREE.Texture; color: string } {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  // Contain the image centered on a square.
  const r = Math.min(S / img.naturalWidth, S / img.naturalHeight)
  const w = img.naturalWidth * r
  const h = img.naturalHeight * r
  ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h)
  const data = ctx.getImageData(0, 0, S, S)
  const d = data.data

  // Studio backgrounds here are a grey gradient. Key out grey (low saturation,
  // mid lightness) — this keeps black/navy/coloured garments and white gear,
  // and survives the gradient that corner-based keying misses.
  let sr = 0, sg = 0, sb = 0, n = 0
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 510 // 0..1
    const sv = max === 0 ? 0 : (max - min) / max // HSV saturation
    const isBackground = sv < 0.17 && l > 0.3 && l < 0.82
    if (isBackground) {
      d[i + 3] = 0 // background → transparent
    } else {
      sr += r
      sg += g
      sb += b
      n++
    }
  }
  ctx.putImageData(data, 0, 0)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  const color = n ? `#${hex(sr / n)}${hex(sg / n)}${hex(sb / n)}` : '#3a3f47'
  return { tex, color }
}

type Processed = { tex: THREE.Texture | null; color: string }

function useProcessedTexture(url: string | undefined, fallbackColor: string): Processed {
  const [data, setData] = useState<Processed>({ tex: null, color: fallbackColor })
  useEffect(() => {
    if (!url) {
      setData({ tex: null, color: fallbackColor })
      return
    }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const out = processImage(img)
        if (!cancelled) setData(out)
      } catch {
        if (!cancelled) setData({ tex: null, color: fallbackColor }) // tainted → colour only
      }
    }
    img.onerror = () => {
      if (!cancelled) setData({ tex: null, color: fallbackColor })
    }
    img.src = url
    return () => {
      cancelled = true
    }
  }, [url, fallbackColor])
  return data
}

// Projects the product photo onto the front of its parent mesh.
function FrontDecal({ tex, position, rotation, scale }: { tex: THREE.Texture | null; position: [number, number, number]; rotation?: [number, number, number]; scale: [number, number, number] }) {
  if (!tex) return null
  return (
    <Decal position={position} rotation={rotation ?? [0, 0, 0]} scale={scale}>
      <meshStandardMaterial map={tex} transparent polygonOffset polygonOffsetFactor={-12} roughness={0.5} metalness={0.05} />
    </Decal>
  )
}

// ------------------------------------------------------------------ bodies ---
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function FallbackFigure({ skinTone }: { skinTone: string }) {
  return (
    <group>
      <mesh position={[0, 0.74, 0]} castShadow>
        <sphereGeometry args={[0.14, 32, 32]} />
        <meshPhysicalMaterial color={skinTone} roughness={0.7} clearcoat={0.1} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.9, 12, 24]} />
        <meshPhysicalMaterial color={skinTone} roughness={0.7} clearcoat={0.1} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------- materials ---
function Leather({ color, rough = 0.52 }: { color: string; rough?: number }) {
  return (
    <meshPhysicalMaterial color={color} roughness={rough} metalness={0.08} clearcoat={0.35} clearcoatRoughness={0.45} bumpMap={getBump()} bumpScale={0.004} envMapIntensity={1} />
  )
}
function Textile({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.9} metalness={0.02} bumpMap={getBump()} bumpScale={0.006} envMapIntensity={0.7} />
}
function Paint({ color }: { color: string }) {
  return <meshPhysicalMaterial color={color} roughness={0.35} metalness={0.1} clearcoat={1} clearcoatRoughness={0.06} envMapIntensity={1.2} />
}
function Metal({ color = '#c9ccd1' }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.28} metalness={1} envMapIntensity={1.3} />
}
function Glass() {
  return <meshPhysicalMaterial color="#0a0d12" roughness={0.04} metalness={0} clearcoat={1} clearcoatRoughness={0.03} transparent opacity={0.78} envMapIntensity={2} side={THREE.DoubleSide} />
}

// ------------------------------------------------------------------- gear ----
type GearProps = { color: string; tex: THREE.Texture | null }

function Helmet({ color, tex }: GearProps) {
  return (
    <group position={[0, 0.03, 0]}>
      {/* shell (hero — carries the product photo) */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <sphereGeometry args={[0.162, 64, 64]} />
        <Paint color={color} />
        <FrontDecal tex={tex} position={[0, -0.01, 0.14]} scale={[0.2, 0.2, 0.26]} />
      </mesh>
      {/* chin bar */}
      <RoundedBox args={[0.27, 0.13, 0.22]} radius={0.055} smoothness={6} position={[0, 0.645, 0.04]} castShadow>
        <Paint color={color} />
      </RoundedBox>
      {/* visor */}
      <mesh position={[0, 0.76, 0]} scale={[1.02, 1.04, 1.1]}>
        <sphereGeometry args={[0.162, 48, 32, -1.05, 2.1, 0.95, 0.5]} />
        <Glass />
      </mesh>
      <mesh position={[0, 0.705, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.008, 12, 40, Math.PI]} />
        <Metal color="#2a2d33" />
      </mesh>
      <RoundedBox args={[0.06, 0.03, 0.12]} radius={0.012} smoothness={4} position={[0.05, 0.87, 0.02]}>
        <Metal color="#1b1d22" />
      </RoundedBox>
      <RoundedBox args={[0.06, 0.03, 0.12]} radius={0.012} smoothness={4} position={[-0.05, 0.87, 0.02]}>
        <Metal color="#1b1d22" />
      </RoundedBox>
      <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.125, 0.016, 12, 40]} />
        <meshStandardMaterial color="#17191d" roughness={0.6} />
      </mesh>
    </group>
  )
}

function ArmSide({ side, color }: { side: 1 | -1; color: string }) {
  return (
    <group>
      <mesh position={[0.275 * side, 0.24, 0]} rotation={[0, 0, 0.19 * side]} castShadow>
        <cylinderGeometry args={[0.093, 0.068, 0.62, 28]} />
        <Leather color={color} />
      </mesh>
      <mesh position={[0.22 * side, 0.52, 0]} scale={[1.1, 0.9, 1]} castShadow>
        <sphereGeometry args={[0.122, 32, 32]} />
        <Leather color={color} rough={0.4} />
      </mesh>
      <RoundedBox args={[0.11, 0.11, 0.11]} radius={0.045} smoothness={5} position={[0.3 * side, 0.17, 0.02]} castShadow>
        <meshStandardMaterial color="#17191d" roughness={0.38} metalness={0.4} bumpMap={getBump()} bumpScale={0.003} />
      </RoundedBox>
    </group>
  )
}

function Jacket({ color, tex }: GearProps) {
  return (
    <group>
      {/* torso (hero) */}
      <mesh position={[0, 0.31, 0]} castShadow>
        <cylinderGeometry args={[0.235, 0.228, 0.56, 48, 1, false]} />
        <Leather color={color} />
        <FrontDecal tex={tex} position={[0, 0.06, 0.2]} scale={[0.38, 0.44, 0.44]} />
      </mesh>
      <mesh position={[0, 0.555, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.125, 0.032, 16, 40]} />
        <Leather color={color} rough={0.45} />
      </mesh>
      <RoundedBox args={[0.022, 0.46, 0.02]} radius={0.008} smoothness={3} position={[0, 0.34, 0.206]}>
        <Metal color="#9aa0a8" />
      </RoundedBox>
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.225, 0.024, 12, 40]} />
        <Leather color={color} rough={0.6} />
      </mesh>
      <ArmSide side={1} color={color} />
      <ArmSide side={-1} color={color} />
    </group>
  )
}

function BackPlate({ color }: GearProps) {
  void color
  return (
    <group position={[0, 0.34, -0.15]}>
      <RoundedBox args={[0.28, 0.42, 0.05]} radius={0.04} smoothness={5} castShadow>
        <meshStandardMaterial color="#1c1f24" roughness={0.5} metalness={0.2} bumpMap={getBump()} bumpScale={0.004} />
      </RoundedBox>
      {[-0.13, -0.045, 0.045, 0.13].map((y) => (
        <RoundedBox key={y} args={[0.24, 0.045, 0.06]} radius={0.02} smoothness={4} position={[0, y, 0.01]}>
          <meshStandardMaterial color="#2a2e35" roughness={0.45} metalness={0.3} />
        </RoundedBox>
      ))}
    </group>
  )
}

function GloveSide({ side, color }: { side: 1 | -1; color: string }) {
  const x = 0.33 * side
  return (
    <group>
      <RoundedBox args={[0.1, 0.13, 0.1]} radius={0.035} smoothness={5} position={[x, -0.04, 0.02]} castShadow>
        <Leather color={color} />
      </RoundedBox>
      <mesh position={[x - 0.02 * side, 0.07, 0]} castShadow>
        <cylinderGeometry args={[0.072, 0.066, 0.1, 20]} />
        <Leather color={color} rough={0.6} />
      </mesh>
      <RoundedBox args={[0.1, 0.035, 0.11]} radius={0.015} smoothness={4} position={[x, 0.04, 0.04]}>
        <meshStandardMaterial color="#17191d" roughness={0.35} metalness={0.4} />
      </RoundedBox>
      {[-0.03, -0.01, 0.01, 0.03].map((dz) => (
        <RoundedBox key={dz} args={[0.09, 0.03, 0.02]} radius={0.01} smoothness={3} position={[x, -0.115, 0.05 + dz]}>
          <Leather color={color} />
        </RoundedBox>
      ))}
    </group>
  )
}

function Gloves({ color }: GearProps) {
  return (
    <group>
      <GloveSide side={1} color={color} />
      <GloveSide side={-1} color={color} />
    </group>
  )
}

// A single glove centred at the origin, for parenting onto a hand bone.
function GloveOne({ color }: { color: string }) {
  return (
    <group>
      <RoundedBox args={[0.085, 0.11, 0.085]} radius={0.028} smoothness={5} castShadow>
        <Leather color={color} />
      </RoundedBox>
      <RoundedBox args={[0.085, 0.03, 0.095]} radius={0.01} smoothness={4} position={[0, 0.05, 0.03]}>
        <meshStandardMaterial color="#17191d" roughness={0.35} metalness={0.4} />
      </RoundedBox>
      {[-0.028, -0.009, 0.009, 0.028].map((dz) => (
        <RoundedBox key={dz} args={[0.075, 0.024, 0.02]} radius={0.007} smoothness={3} position={[0, -0.065, 0.04 + dz]}>
          <Leather color={color} />
        </RoundedBox>
      ))}
    </group>
  )
}

// Hand-bone-local placements (tuned). hand_L/hand_R point down the hand.
const GLOVE_PLACE: Record<'L' | 'R', { pos: [number, number, number]; rot: [number, number, number]; scale: number }> = {
  L: { pos: [0, 0.03, 0], rot: [0, 0, 0], scale: 1 },
  R: { pos: [0, 0.03, 0], rot: [0, 0, 0], scale: 1 },
}

function GloveBones({ color, bones }: { color: string; bones: Record<string, Object3D> }) {
  const l = bones['hand_L']
  const r = bones['hand_R']
  return (
    <>
      {l &&
        createPortal(
          <group position={GLOVE_PLACE.L.pos} rotation={GLOVE_PLACE.L.rot} scale={GLOVE_PLACE.L.scale}>
            <GloveOne color={color} />
          </group>,
          l,
        )}
      {r &&
        createPortal(
          <group position={GLOVE_PLACE.R.pos} rotation={GLOVE_PLACE.R.rot} scale={GLOVE_PLACE.R.scale}>
            <GloveOne color={color} />
          </group>,
          r,
        )}
    </>
  )
}

function LegSide({ side, color, tex }: { side: 1 | -1; color: string; tex: THREE.Texture | null }) {
  const x = 0.11 * side
  return (
    <group>
      <mesh position={[x, -0.4, -0.012]} castShadow>
        <cylinderGeometry args={[0.132, 0.116, 0.86, 28]} />
        <Textile color={color} />
        {side === 1 && <FrontDecal tex={tex} position={[0, 0.16, 0.14]} scale={[0.22, 0.4, 0.3]} />}
      </mesh>
      <RoundedBox args={[0.145, 0.15, 0.13]} radius={0.05} smoothness={5} position={[x, -0.44, 0.05]} castShadow>
        <meshStandardMaterial color="#17191d" roughness={0.38} metalness={0.4} bumpMap={getBump()} bumpScale={0.003} />
      </RoundedBox>
      <RoundedBox args={[0.02, 0.16, 0.1]} radius={0.01} smoothness={3} position={[x + 0.11 * side, -0.24, 0.02]}>
        <Leather color={color} rough={0.5} />
      </RoundedBox>
    </group>
  )
}

function Pants({ color, tex }: GearProps) {
  return (
    <group>
      <RoundedBox args={[0.37, 0.2, 0.26]} radius={0.07} smoothness={5} position={[0, 0, 0]} castShadow>
        <Textile color={color} />
      </RoundedBox>
      <LegSide side={1} color={color} tex={tex} />
      <LegSide side={-1} color={color} tex={tex} />
    </group>
  )
}

function BootSide({ side, color }: { side: 1 | -1; color: string }) {
  const x = 0.11 * side
  return (
    <group>
      <mesh position={[x, -0.72, -0.01]} castShadow>
        <cylinderGeometry args={[0.102, 0.096, 0.24, 24]} />
        <Leather color={color} rough={0.45} />
      </mesh>
      <RoundedBox args={[0.13, 0.12, 0.3]} radius={0.05} smoothness={5} position={[x, -0.84, 0.07]} castShadow>
        <Leather color={color} rough={0.45} />
      </RoundedBox>
      <mesh position={[x, -0.85, 0.21]} scale={[1, 0.8, 1]}>
        <sphereGeometry args={[0.065, 24, 24]} />
        <meshStandardMaterial color="#17191d" roughness={0.3} metalness={0.5} />
      </mesh>
      <RoundedBox args={[0.145, 0.04, 0.34]} radius={0.015} smoothness={4} position={[x, -0.905, 0.07]}>
        <meshStandardMaterial color="#0e0f12" roughness={0.9} />
      </RoundedBox>
      {[-0.7, -0.78].map((y) => (
        <RoundedBox key={y} args={[0.12, 0.02, 0.04]} radius={0.008} smoothness={3} position={[x, y, 0.08]}>
          <Metal color="#b9bec6" />
        </RoundedBox>
      ))}
    </group>
  )
}

function Boots({ color }: GearProps) {
  return (
    <group>
      <BootSide side={1} color={color} />
      <BootSide side={-1} color={color} />
    </group>
  )
}

const GEAR_COMPONENT: Record<Slot, (p: GearProps) => ReactNode> = {
  helmet: Helmet,
  jacket: Jacket,
  back: BackPlate,
  gloves: Gloves,
  pants: Pants,
  boots: Boots,
}

// --- Generated product GLBs (2.5D relief models from the product photos) ------
// Each GLB is centred and normalised (max silhouette dim ~1 unit); we re-fit it
// and place it on the matching body region, textured front facing forward.
const PLACEMENT: Record<Slot, { scale: number; pos: [number, number, number]; rot: [number, number, number] }> = {
  // Generated GLBs have their textured front on local −Z, so worn pieces rotate
  // 180° to face the viewer; the back protector keeps its front on the back.
  helmet: { scale: 0.36, pos: [0, 0.74, 0.0], rot: [0, Math.PI, 0] },
  jacket: { scale: 0.78, pos: [0, 0.3, -0.01], rot: [0, Math.PI, 0] },
  back: { scale: 0.46, pos: [0, 0.34, -0.14], rot: [0, 0, 0] },
  gloves: { scale: 0.34, pos: [0, -0.05, 0.14], rot: [0, Math.PI, 0] },
  pants: { scale: 0.8, pos: [0, -0.3, -0.01], rot: [0, Math.PI, 0] },
  boots: { scale: 0.34, pos: [0, -0.82, 0.06], rot: [0, Math.PI, 0] },
}

function ProductGLB({ url, slot }: { url: string; slot: Slot }) {
  const { scene } = useGLTF(url)
  const obj = useMemo(() => {
    const clone = scene.clone(true)
    const box = new THREE.Box3().setFromObject(clone)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxd = Math.max(size.x, size.y, size.z) || 1
    clone.scale.setScalar(1 / maxd)
    const b2 = new THREE.Box3().setFromObject(clone)
    const ctr = new THREE.Vector3()
    b2.getCenter(ctr)
    clone.position.sub(ctr)
    clone.traverse((o: Object3D) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    return clone
  }, [scene])
  const pl = PLACEMENT[slot]
  return (
    <group position={pl.pos} rotation={pl.rot} scale={pl.scale}>
      <primitive object={obj} />
    </group>
  )
}

function ProcGearSlot({ slot, item }: { slot: Slot; item: WornItem }) {
  const { tex, color } = useProcessedTexture(item.image, item.color)
  const Comp = GEAR_COMPONENT[slot]
  return <group>{Comp({ color, tex })}</group>
}

// Gloves are a left+right pair in one photo → one centred mesh can't sit on the
// two spread hands, so gloves stay procedural (placed on each hand).
const GLB_SLOTS: Record<Slot, boolean> = { helmet: true, jacket: true, back: true, gloves: false, pants: true, boots: true }

function GearSlot({ slot, item }: { slot: Slot; item: WornItem }) {
  if (item.glb && GLB_SLOTS[slot]) {
    return (
      <ModelBoundary fallback={<ProcGearSlot slot={slot} item={item} />}>
        <Suspense fallback={null}>
          <ProductGLB url={item.glb} slot={slot} />
        </Suspense>
      </ModelBoundary>
    )
  }
  return <ProcGearSlot slot={slot} item={item} />
}

// ------------------------------------------------------------------ scene ----
// --- Rigged human: realistic MB-Lab mesh, posed, measurement-morphed, breathing ---
const GROUND = -0.92
const WORLD_Z = new THREE.Vector3(0, 0, 1)
const WORLD_X = new THREE.Vector3(1, 0, 0)
const POSE_BONES = ['upperarm_L', 'upperarm_R', 'lowerarm_L', 'lowerarm_R'] as const

// Arm angles per pose: upperarm swings about world Z, lowerarm (elbow) about X.
export type PoseName = 'relaxed' | 'open' | 'raised'
type PoseAngles = { uaL: number; uaR: number; laL: number; laR: number }
const POSES: Record<PoseName, PoseAngles> = {
  relaxed: { uaL: -1.32, uaR: 1.32, laL: 0.18, laR: 0.18 },
  open: { uaL: -0.62, uaR: 0.62, laL: 0.12, laR: 0.12 },
  raised: { uaL: 0.5, uaR: -0.5, laL: 0.45, laR: 0.45 },
}
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function RiggedHuman({
  skinTone,
  heightFactor,
  morphs,
  pose,
  idle,
  bonesRef,
  onReady,
}: {
  skinTone: string
  heightFactor: number
  morphs: Morphs
  pose: PoseName
  idle: boolean
  bonesRef: { current: Record<string, Object3D> }
  onReady: () => void
}) {
  const { scene } = useGLTF(AVATAR_URL)
  const skinRef = useRef<SkinnedMesh | null>(null)
  const dictRef = useRef<Record<string, number>>({})
  const restRef = useRef<Record<string, THREE.Quaternion>>({})
  const curRef = useRef<PoseAngles>({ ...POSES.relaxed })

  const root = useMemo(() => {
    const clone = skeletonClone(scene) as Object3D
    const bones: Record<string, Object3D> = {}
    clone.traverse((o: Object3D) => {
      if ((o as unknown as { isBone?: boolean }).isBone) bones[o.name] = o
    })
    bonesRef.current = bones
    const skin = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(skinTone),
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.6,
      sheen: 0.4,
      sheenColor: new THREE.Color(skinTone).multiplyScalar(1.25),
    })
    clone.traverse((o: Object3D) => {
      const m = o as SkinnedMesh
      if ((m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh || (m as unknown as { isMesh?: boolean }).isMesh) {
        m.material = skin
        m.castShadow = true
        m.receiveShadow = true
        m.frustumCulled = false
        if (m.morphTargetDictionary) {
          skinRef.current = m
          dictRef.current = m.morphTargetDictionary
        }
      }
    })
    // Capture the rest (bind) rotations of the animated bones — the pose is then
    // applied every frame relative to these, so it stays non-destructive.
    const rest: Record<string, THREE.Quaternion> = {}
    for (const n of POSE_BONES) {
      const b = bones[n]
      if (b) rest[n] = b.quaternion.clone()
    }
    restRef.current = rest
    // Ground + scale to height
    const box = new THREE.Box3().setFromObject(clone)
    const size = new THREE.Vector3()
    box.getSize(size)
    const s = (TARGET_HEIGHT / (size.y || 1)) * heightFactor
    clone.scale.setScalar(s)
    const b2 = new THREE.Box3().setFromObject(clone)
    clone.position.set(-(b2.min.x + b2.max.x) / 2, GROUND - b2.min.y, -(b2.min.z + b2.max.z) / 2)
    return clone
  }, [scene, skinTone, heightFactor, bonesRef])

  useEffect(() => {
    onReady()
  }, [root, onReady])

  useFrame((state, delta) => {
    const rest = restRef.current
    const bones = bonesRef.current
    // Smoothly interpolate the arm angles toward the selected pose.
    const target = POSES[pose]
    const c = curRef.current
    const k = 1 - Math.pow(0.0001, Math.min(delta, 0.1)) // frame-rate-independent ease
    c.uaL += (target.uaL - c.uaL) * k
    c.uaR += (target.uaR - c.uaR) * k
    c.laL += (target.laL - c.laL) * k
    c.laR += (target.laR - c.laR) * k
    const apply = (name: string, axis: THREE.Vector3, angle: number) => {
      const b = bones[name]
      const r = rest[name]
      if (b && r) {
        b.quaternion.copy(r)
        b.rotateOnWorldAxis(axis, angle)
      }
    }
    apply('upperarm_L', WORLD_Z, c.uaL)
    apply('upperarm_R', WORLD_Z, c.uaR)
    apply('lowerarm_L', WORLD_X, c.laL)
    apply('lowerarm_R', WORLD_X, c.laR)

    // Morphs + optional breathing.
    const mesh = skinRef.current
    if (mesh && mesh.morphTargetInfluences) {
      const d = dictRef.current
      const breathe = idle ? 0.04 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 1.1)) : 0
      const set = (name: string, v: number) => {
        const i = d[name]
        if (i != null) mesh.morphTargetInfluences![i] = v
      }
      set('morph_chest', morphs.chest + breathe)
      set('morph_waist', morphs.waist)
      set('morph_hips', morphs.hips)
    }
  })

  return <primitive object={root} />
}

function Scene({ skinTone, scale, worn, morphs, pose, idle }: { skinTone: string; scale: AvatarScale; worn: WornMap; morphs: Morphs; pose: PoseName; idle: boolean }) {
  const group = useRef<Group>(null)
  const bonesRef = useRef<Record<string, Object3D>>({})
  const [, setReady] = useState(0)
  const onReady = useMemo(() => () => setReady((v) => v + 1), [])
  const reduce = useMemo(prefersReducedMotion, [])
  const effIdle = idle && !reduce
  // Gentle front-facing sway (reveals relief depth without showing rough backs).
  useFrame((state) => {
    if (!group.current) return
    group.current.rotation.y = effIdle ? Math.sin(state.clock.elapsedTime * 0.3) * 0.35 : group.current.rotation.y * 0.9
  })
  return (
    <group ref={group} position={[0, -0.02, 0]}>
      <ModelBoundary fallback={<FallbackFigure skinTone={skinTone} />}>
        <Suspense fallback={<FallbackFigure skinTone={skinTone} />}>
          <RiggedHuman skinTone={skinTone} heightFactor={scale.y} morphs={morphs} pose={pose} idle={effIdle} bonesRef={bonesRef} onReady={onReady} />
        </Suspense>
      </ModelBoundary>

      {(Object.keys(GEAR_COMPONENT) as Slot[]).map((slot) => {
        const item = worn[slot]
        if (!item) return null
        if (slot === 'gloves') return <GloveBones key={slot} color={item.color} bones={bonesRef.current} />
        return <GearSlot key={slot} slot={slot} item={item} />
      })}
    </group>
  )
}

export function AvatarModel({ skinTone, scale, worn, morphs, pose = 'relaxed', idle = true }: { skinTone: string; scale: AvatarScale; worn: WornMap; morphs: Morphs; pose?: PoseName; idle?: boolean }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.0, 3.85], fov: 36 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={['#0e0f13']} />
      <fog attach="fog" args={['#0e0f13', 4.5, 10]} />

      <ambientLight intensity={0.25} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.4} color="#fff6ea" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}>
        <orthographicCamera attach="shadow-camera" args={[-1.4, 1.4, 1.6, -1.4, 0.1, 10]} />
      </directionalLight>
      <directionalLight position={[-3, 1.5, 1]} intensity={0.9} color="#8fb4ff" />
      <pointLight position={[0, 1.2, -2.5]} intensity={5} color="#ffd9a8" />
      <pointLight position={[0, 2.5, 2]} intensity={8} color="#ffffff" />

      <Suspense fallback={null}>
        <Environment files="/hdri/studio.hdr" environmentIntensity={0.85} />
      </Suspense>

      <Scene skinTone={skinTone} scale={scale} worn={worn} morphs={morphs} pose={pose} idle={idle} />

      <ContactShadows position={[0, -0.92, 0]} opacity={0.6} scale={5} blur={2.6} far={2.2} resolution={1024} color="#000000" />

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={false}
        minDistance={1.9}
        maxDistance={5.5}
        minPolarAngle={Math.PI * 0.28}
        maxPolarAngle={Math.PI * 0.6}
        target={[0, 0.0, 0]}
      />

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.82} luminanceSmoothing={0.2} intensity={0.45} />
        <Vignette eskil={false} offset={0.22} darkness={0.75} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
