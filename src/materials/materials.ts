import * as THREE from 'three'
import { invalidate } from '@react-three/fiber'
import { useStore } from '../store'
import type { RawSet } from './textures'
import type { TexSetName } from './generators'
import type { Quality } from '../data/schema'

// HDR safety: a sharp highlight (sun or a downlight glinting off glass, polished tile, steel or
// ceramic) can exceed the half-float range of the post-processing buffers. It then becomes Inf/NaN
// and bloom/AO/SMAA smear it into black flickering blotches at certain viewing angles.
// Clamp every built-in material's output to a generous HDR ceiling and drop NaNs, before any compile.
const HDR_GUARD = '\n#include <hdr_guard>'
if (!THREE.ShaderChunk.opaque_fragment.includes(HDR_GUARD)) {
  ;(THREE.ShaderChunk as Record<string, string>).hdr_guard = [
    // NaN can't be recovered: emit nothing for that pixel instead of a value that spreads
    'if ( any( isnan( gl_FragColor ) ) ) gl_FragColor = vec4( 0.0 );',
    // +Inf and over-bright highlights are capped (still well above white, so bloom keeps working)
    'gl_FragColor = vec4( min( gl_FragColor.rgb, vec3( 48.0 ) ), clamp( gl_FragColor.a, 0.0, 1.0 ) );',
  ].join('\n')
  THREE.ShaderChunk.opaque_fragment += HDR_GUARD
}

// OWNER: Materials & Lighting agent (A2).
// Contract: getMaterials() returns memoised singleton materials keyed by name.
// Other modules must only use these keys (do not create ad-hoc materials for surfaces listed here).
//
// PBR materials with procedurally generated colour / roughness / normal maps.
// UV convention: geometry UV 1.0 = 1 metre. Texture repeats are set to real-world sizes,
// e.g. hallTile shows 80x80 cm tiles when the floor's UVs are in metres.
// If your geometry has 0..1 UVs per face instead, the pattern is shown at the size of 1 m.

export type MaterialKey =
  | 'wallPaint' // interior walls, matte warm white
  | 'exteriorWall' // outside faces / wall caps
  | 'ceiling'
  | 'hallTile' // large-format beige marble-look vitrified tile (80x80)
  | 'toiletTile' // wood-look warm tile (floor + walls of toilets), 60x120
  | 'balconyTile' // anti-skid matte tile 40x40
  | 'skirting'
  | 'woodVeneer' // light oak wardrobes / TV unit / desk
  | 'darkWood' // walnut (door leaves, shelves, coffee table)
  | 'stoneTop' // kitchen / vanity counter top (light quartz)
  | 'kitchenCabinet' // teal-blue matte kitchen shutters (as in render)
  | 'glass' // window / sliding door / shower glass (thin, slightly blue)
  | 'metal' // brushed steel (hob, sink, handles)
  | 'blackMetal' // window/door frames, railing
  | 'ceramic' // WC, basins
  | 'fabricBlue' // sofa
  | 'fabricLight' // bed linen, chairs
  | 'plant'
  | 'soil'
  // ---- added by A2 (append-only) ----
  | 'mirror' // bathroom mirror (reflects the environment map)
  | 'tvScreen' // glossy black TV panel (switched off)
  | 'rug' // light grey-beige pile rug
  | 'leather' // cognac leather (chairs, headboards)
  | 'curtain' // sheer off-white curtain fabric (double sided, slightly translucent)
  | 'lightPanel' // emissive warm-white ceiling light / lamp diffuser
  | 'grass' // outdoor lawn (1 m UV)
  | 'paving' // outdoor 30x30 concrete pavers (1 m UV)
  | 'concrete' // fair-faced grey concrete / plaster outside

let cache: Record<MaterialKey, THREE.Material> | null = null

// ---------------------------------------------------------------- texture loading
// Textures are generated in a Web Worker (~1.5 s of CPU) so the first frame is not blocked.
// Materials start with a flat average colour and receive their maps as each set arrives.

interface Binding {
  set: TexSetName
  /** material.color once the (tinted or full-colour) map is applied */
  tint: string
  normalScale?: number
  map?: boolean
  rough?: boolean
  normal?: boolean
}

const bindings: [MaterialKey, Binding][] = []
const bind = (key: MaterialKey, b: Binding) => bindings.push([key, b])

// Memory: each DataTexture's pixel buffer is released right after its GPU upload (`onUpdate`), so the
// ~57 MB of CPU copies do not stay in the JS heap. What is kept to rebuild them is just the set name
// and the resolution tier (the generators are deterministic). On WebGL context loss the GPU copies
// are gone too, so on `webglcontextrestored` every set is regenerated into the same texture objects.
// Resolution tier: half size on touch devices (pointer: coarse) or quality 'low'. Changing quality on a
// desktop regenerates the sets at the new size into the same texture objects, disposing the old GPU
// copies (see refill), so nothing leaks and cloned materials keep working.

type SetTextures = { map: THREE.DataTexture; rough: THREE.DataTexture | null; normal: THREE.DataTexture | null }
const live = new Map<TexSetName, SetTextures>()

function releasePixels(t: THREE.Texture) {
  // keep width/height (three reads them for mip/size bookkeeping); drop the pixel buffer
  const img = t.image as { data: Uint8Array | null; width: number; height: number }
  img.data = null
}

function dataTex(data: Uint8Array, raw: RawSet, srgb: boolean) {
  const t = new THREE.DataTexture(data, raw.w, raw.h, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.repeat.set(1 / raw.size[0], 1 / raw.size[1])
  t.onUpdate = releasePixels
  t.needsUpdate = true
  return t
}

/**
 * Put new pixels into an existing texture object. Materials (including clones made elsewhere, e.g.
 * planner `tint()`) keep pointing at the same object, so nothing goes stale. When the size changes,
 * the old GPU texture is disposed first (immutable storage cannot be resized); three then allocates
 * and uploads a fresh one on next use. After a context loss, three has already dropped its GL state.
 */
function refill(t: THREE.DataTexture | null, data: Uint8Array | undefined, raw: RawSet) {
  if (!t || !data) return
  const img = t.image as { data: Uint8Array | null; width: number; height: number }
  if (img.width !== raw.w || img.height !== raw.h) t.dispose()
  t.image = { data, width: raw.w, height: raw.h }
  t.needsUpdate = true
}

let resolveReady: () => void = () => {}
/** Resolves once every procedural texture has been generated and applied. */
export const texturesReady: Promise<void> = new Promise((r) => (resolveReady = r))

function applySet(name: TexSetName, raw: RawSet) {
  if (!cache) return
  const old = live.get(name)
  if (old) {
    // regeneration (quality tier change or context restore): reuse the texture objects
    refill(old.map, raw.col, raw)
    refill(old.rough, raw.rough, raw)
    refill(old.normal, raw.normal, raw)
    invalidate()
    return
  }
  const map = dataTex(raw.col, raw, true)
  const rough = raw.rough ? dataTex(raw.rough, raw, false) : null
  const normal = raw.normal ? dataTex(raw.normal, raw, false) : null
  live.set(name, { map, rough, normal })
  for (const [key, b] of bindings) {
    if (b.set !== name) continue
    const m = cache[key] as THREE.MeshStandardMaterial
    if (b.map !== false) m.map = map
    if (b.rough !== false && rough) {
      m.roughnessMap = rough
      m.roughness = 1
    }
    if (b.normal !== false && normal) {
      m.normalMap = normal
      m.normalScale.setScalar(b.normalScale ?? 1)
    }
    m.color.set(b.tint)
    m.needsUpdate = true
  }
  invalidate() // frameloop="demand": show the new maps now
}

const coarsePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
const scaleFor = (q: Quality) => (coarsePointer() || q === 'low' ? 0.5 : 1)

let loadStarted = false
let gen = 0 // bumps on every (re)generation request; results of older requests are discarded
let genScale = 1
let pendingCount = 0
let worker: Worker | null = null
let regenTimer: ReturnType<typeof setTimeout> | undefined

/** Number of texture sets still being generated (0 = idle). For perf tools / tests. */
export const texturesPending = () => pendingCount
/** Current texture resolution multiplier (1 or 0.5). */
export const textureScale = () => genScale

function setOrder(): TexSetName[] {
  const order: TexSetName[] = []
  for (const [, b] of bindings) if (!order.includes(b.set)) order.push(b.set)
  return order
}

function generate(scale: number) {
  const myGen = ++gen
  genScale = scale
  worker?.terminate()
  worker = null
  const order = setOrder()
  const pending = new Set(order)
  pendingCount = pending.size
  const done = (name: TexSetName, raw: RawSet) => {
    if (myGen !== gen || !pending.has(name)) return
    pending.delete(name)
    pendingCount = pending.size
    applySet(name, raw)
    if (pending.size === 0) {
      worker?.terminate()
      worker = null
      resolveReady()
    }
  }
  const mainThread = async () => {
    const { GENERATORS } = await import('./generators')
    const { setTextureScale } = await import('./textures')
    for (const name of [...pending]) {
      await new Promise((r) => setTimeout(r, 0))
      if (myGen !== gen) return
      setTextureScale(scale)
      done(name, GENERATORS[name]())
    }
  }
  try {
    const w = new Worker(new URL('./texWorker.ts', import.meta.url), { type: 'module' })
    worker = w
    w.onmessage = (e: MessageEvent<{ name: TexSetName; raw: RawSet; gen: number }>) => done(e.data.name, e.data.raw)
    w.onerror = () => {
      w.terminate()
      if (worker === w) worker = null
      if (myGen === gen) void mainThread()
    }
    w.postMessage({ names: order, scale, gen: myGen })
  } catch {
    void mainThread()
  }
}

function startTextureLoad() {
  if (loadStarted) return
  loadStarted = true
  if (typeof window === 'undefined') return resolveReady() // node / tests: flat colours only
  generate(scaleFor(currentQuality))
  // GPU copies are lost with the context and the CPU copies were released: rebuild them.
  // (capture phase: the event is dispatched on the canvas and does not bubble)
  window.addEventListener('webglcontextrestored', () => generate(genScale), true)
}

/** Debounced: regenerate at the tier for `q` if it differs from what is loaded / loading. */
function requestTier(q: Quality) {
  if (!loadStarted || typeof window === 'undefined') return
  clearTimeout(regenTimer)
  regenTimer = setTimeout(() => {
    const s = scaleFor(q)
    if (s !== genScale) generate(s)
  }, 250)
}

// ---------------------------------------------------------------- materials
let currentQuality: Quality = useStore.getState().quality ?? 'high'

/**
 * Thin architectural glass without a transmission pass (which re-renders the whole scene and blurs it).
 * Diffuse is almost black, so the pane only adds its Fresnel reflection of the environment/sun on top
 * of what is behind it; the background is attenuated by `opacity` (premultiplied blending, and the
 * shader's alpha-premultiply step is skipped so reflections are not faded out with the alpha).
 */
function makeGlass() {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#091214', // faint blue-green body tint
    metalness: 0,
    roughness: 0.03,
    ior: 1.5,
    specularIntensity: 1,
    transparent: true,
    premultipliedAlpha: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <premultiplied_alpha_fragment>', '')
  }
  m.customProgramCacheKey = () => 'a2-thin-glass'
  return m
}

export function getMaterials(): Record<MaterialKey, THREE.Material> {
  if (cache) return cache

  const std = (color: string, roughness = 0.8, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })

  const fabric = (color: string) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.95,
      sheen: 0.6,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.4),
    })

  const glass = makeGlass()

  // provisional flat colours ~ the average of each texture, replaced when the maps arrive
  cache = {
    wallPaint: std('#ede8df', 0.9),
    exteriorWall: std('#3a3a3d', 0.9),
    ceiling: std('#f4f2ed', 0.92),
    hallTile: std('#e2d8c7', 0.2),
    toiletTile: std('#c0905f', 0.45),
    balconyTile: std('#cbc4b7', 0.85),
    skirting: std('#e6dccb', 0.3),
    woodVeneer: std('#c49c6c', 0.55),
    darkWood: std('#644430', 0.45),
    stoneTop: std('#e6e2db', 0.18),
    kitchenCabinet: std('#3e6a7a', 0.52),
    glass,
    metal: std('#c4c7cb', 0.32, 1),
    blackMetal: std('#232427', 0.45, 0.5),
    ceramic: std('#f7f7f5', 0.08, 0),
    fabricBlue: fabric('#2c5470'),
    fabricLight: fabric('#ddd7cd'),
    plant: std('#3d6e33', 0.6, 0, { side: THREE.DoubleSide }),
    soil: std('#3f3226', 1),

    mirror: std('#f4f6f7', 0.02, 1),
    tvScreen: std('#0a0b0d', 0.08, 0.2),
    rug: std('#c4bcaf', 0.97),
    leather: std('#7f4f30', 0.5),
    curtain: new THREE.MeshPhysicalMaterial({
      color: '#f3efe7',
      roughness: 0.95,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    lightPanel: std('#ffffff', 0.6, 0, { emissive: '#ffeedd', emissiveIntensity: 4 }),
    grass: std('#53723a', 0.95),
    paving: std('#aba499', 0.9),
    concrete: std('#c9c4bb', 0.9),
  }
  for (const [k, m] of Object.entries(cache)) m.name = k

  bind('wallPaint', { set: 'plaster', tint: '#f1ece3', normalScale: 0.5 })
  bind('ceiling', { set: 'plaster', tint: '#f7f5f0', normalScale: 0.3 })
  bind('exteriorWall', { set: 'plaster', tint: '#3b3b3e', normalScale: 0.5 })
  bind('hallTile', { set: 'hallTile', tint: '#ffffff', normalScale: 0.8 })
  bind('toiletTile', { set: 'toiletTile', tint: '#ffffff', normalScale: 0.8 })
  bind('balconyTile', { set: 'balconyTile', tint: '#ffffff' })
  bind('woodVeneer', { set: 'oak', tint: '#ffffff', normalScale: 0.6 })
  bind('darkWood', { set: 'walnut', tint: '#ffffff', normalScale: 0.6 })
  bind('stoneTop', { set: 'quartz', tint: '#ffffff' })
  bind('kitchenCabinet', { set: 'lacquer', tint: '#3e6a7a' })
  bind('metal', { set: 'brushed', tint: '#c4c7cb', normalScale: 0.3 })
  bind('fabricBlue', { set: 'weave', tint: '#2c5470', normalScale: 0.6 })
  bind('fabricLight', { set: 'weave', tint: '#ddd7cd', normalScale: 0.6 })
  bind('curtain', { set: 'weave', tint: '#f3efe7', rough: false, normal: false })
  bind('soil', { set: 'soil', tint: '#4a3a2c' })
  bind('rug', { set: 'rug', tint: '#cfc7ba', normalScale: 0.8 })
  bind('leather', { set: 'leather', tint: '#8a5634', normalScale: 0.5 })
  bind('grass', { set: 'grass', tint: '#ffffff', normalScale: 0.6 })
  bind('paving', { set: 'paving', tint: '#ffffff', normalScale: 0.8 })
  bind('concrete', { set: 'concrete', tint: '#d8d3ca', normalScale: 0.5 })

  applyQuality(currentQuality)
  startTextureLoad()
  return cache
}

/**
 * Adapt material cost to the quality setting (called by <Lighting/> when the store changes).
 * high: fabric sheen. low: no sheen (glass is the same cheap thin-glass shader on both).
 */
export function applyQuality(q: Quality) {
  currentQuality = q
  requestTier(q)
  if (!cache) return
  for (const k of ['fabricBlue', 'fabricLight'] as const) {
    const m = cache[k] as THREE.MeshPhysicalMaterial
    m.sheen = q === 'high' ? 0.6 : 0
    m.needsUpdate = true
  }
}
