// Procedural furniture models built from primitives. Everything here is modelled in CENTIMETRES with
// the origin at the footprint centre on the floor; the GeoBuilder bakes a 0.01 scale so the result
// is in metres. Front of every item faces local +z. Parts stay inside w × d × h exactly.
// Models push their parts into a GeoBuilder (see builder.ts); the result is merged into one
// geometry per item (one group per material) and shared through geoCache.ts.
import * as THREE from 'three'
import { getMaterials, registerVariant, type MaterialKey } from '../materials/materials'
import { getEntry, type ModelKind } from './catalog'
import { GeoBuilder, type BuiltGeometry } from './builder'

type Mat = THREE.Material

// ---------------------------------------------------------------- materials
const localCache = new Map<string, Mat>()
const cached = (key: string, make: () => Mat) => {
  let m = localCache.get(key)
  if (!m) {
    m = make()
    localCache.set(key, m)
  }
  return m
}
const M = (k: MaterialKey) => getMaterials()[k]

/** A getMaterials() material, optionally re-coloured (clone cached per colour). */
export function tint(base: MaterialKey, color?: string): Mat {
  if (!color) return M(base)
  return cached(`tint|${base}|${color}`, () => {
    const m = M(base).clone() as THREE.MeshStandardMaterial
    m.color = new THREE.Color(color)
    registerVariant(base, m) // gets the maps even if they arrive after this clone was made
    return m
  })
}
const paint = (color: string, roughness = 0.5, metalness = 0) =>
  cached(`paint|${color}|${roughness}|${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }))

const L = {
  screen: () =>
    cached('screen', () => new THREE.MeshPhysicalMaterial({ color: '#06070a', roughness: 0.06, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 })),
  white: () => paint('#f4f3ef', 0.35),
  linen: () => paint('#fbfaf6', 0.9),
  steel: () => paint('#c9ccd0', 0.32, 0.75),
  dark: () => paint('#1b1c1f', 0.5, 0.2),
  grey: () => paint('#8c8f94', 0.45, 0.3),
  porthole: () =>
    cached('porthole', () => new THREE.MeshPhysicalMaterial({ color: '#2a3036', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1 })),
  mirror: () => cached('mirror', () => new THREE.MeshStandardMaterial({ color: '#dfe7ea', roughness: 0.03, metalness: 1 })),
  bulb: () => cached('bulb', () => new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffe7b0', emissiveIntensity: 2 })),
  rugBorder: () => paint('#8d8172', 0.95),
}
const shade = (color: string) =>
  cached(`shade|${color}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.9, side: THREE.DoubleSide }))

// ---------------------------------------------------------------- helpers
const legs4 = (b: GeoBuilder, w: number, d: number, inset: number, size: number, h: number, m: Mat, round = false, y = 0) => {
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const x = sx * (w / 2 - inset)
    const z = sz * (d / 2 - inset)
    if (round) b.cyl([x, y, z], size / 2, h, m, { rt: size / 2.6, seg: 12 })
    else b.box([x, y, z], [size, h, size], m)
  }
}

interface MP {
  w: number
  d: number
  h: number
  main: Mat
  variant?: string
}
type Model = (b: GeoBuilder, p: MP) => void

// ---------------------------------------------------------------- living
const Sofa: Model = (b, { w, d, h, main }) => {
  const legH = 8
  const baseTop = Math.min(40, h * 0.47)
  const armW = Math.min(18, w * 0.14)
  const armH = Math.min(64, h * 0.76)
  const backT = Math.min(20, d * 0.22)
  const seatTop = Math.min(52, h * 0.62)
  const iw = w - 2 * armW
  const n = Math.max(1, Math.round(iw / 65))
  const cw = iw / n
  const sd = d - backT - 2
  legs4(b, w, d, 7, 4.5, legH, M('darkWood'), true)
  b.box([0, legH, 0], [w, baseTop - legH, d], main, 3)
  b.box([-w / 2 + armW / 2, legH, 0], [armW, armH - legH, d], main, 6)
  b.box([w / 2 - armW / 2, legH, 0], [armW, armH - legH, d], main, 6)
  b.box([0, legH, -d / 2 + backT / 2], [iw + 2, h - legH, backT], main, 5)
  for (let i = 0; i < n; i++) {
    const cx = -iw / 2 + cw * (i + 0.5)
    b.box([cx, baseTop - 1, -d / 2 + backT + sd / 2], [cw - 1.2, seatTop - baseTop + 1, sd], main, 5)
    b.box([cx, seatTop - 1, -d / 2 + backT + 7], [cw - 2, h - 5 - seatTop, 15], main, 6)
  }
}

const LSofa: Model = (b, { w, d, h, main, variant }) => {
  const s = variant === 'left' ? 1 : -1 // x side of the chaise
  const legH = 8
  const baseTop = 40
  const armW = 16
  const armH = Math.min(62, h * 0.75)
  const backT = 20
  const seatD = Math.min(90, d)
  const chaiseW = Math.min(90, w)
  const seatTop = 52
  const chaiseL = d - seatD
  const iw = w - 2 * armW
  const n = Math.max(1, Math.round(iw / 65))
  const cw = iw / n
  const chaiseInnerW = chaiseW - armW
  const ccx = s * (w / 2 - armW - chaiseInnerW / 2)
  const wood = M('darkWood')
  b.group([0, 0, -d / 2 + seatD / 2], undefined, () => legs4(b, w, seatD, 7, 4.5, legH, wood, true, 0))
  b.cyl([s * (w / 2 - 7), 0, d / 2 - 7], 2.25, legH, wood, { rt: 1.7, seg: 12 })
  b.cyl([s * (w / 2 - chaiseW + 7), 0, d / 2 - 7], 2.25, legH, wood, { rt: 1.7, seg: 12 })
  // bases
  b.box([0, legH, -d / 2 + seatD / 2], [w, baseTop - legH, seatD], main, 3)
  if (chaiseL > 0) b.box([s * (w / 2 - chaiseW / 2), legH, d / 2 - chaiseL / 2 - 0.5], [chaiseW, baseTop - legH, chaiseL + 1], main, 3)
  // arms: plain end + along the outer side of the chaise
  b.box([-s * (w / 2 - armW / 2), legH, -d / 2 + seatD / 2], [armW, armH - legH, seatD], main, 6)
  b.box([s * (w / 2 - armW / 2), legH, 0], [armW, armH - legH, d], main, 6)
  // back
  b.box([0, legH, -d / 2 + backT / 2], [iw + 2, h - legH, backT], main, 5)
  for (let i = 0; i < n; i++) {
    const cx = -iw / 2 + cw * (i + 0.5)
    b.box([cx, baseTop - 1, -d / 2 + backT + (seatD - backT) / 2], [cw - 1.2, seatTop - baseTop + 1, seatD - backT - 1], main, 5)
    b.box([cx, seatTop - 1, -d / 2 + backT + 7], [cw - 2, h - 5 - seatTop, 15], main, 6)
  }
  if (chaiseL > 0) b.box([ccx, baseTop - 1, d / 2 - chaiseL / 2 - 1], [chaiseInnerW - 1.2, seatTop - baseTop + 1, chaiseL], main, 5)
  // scatter cushions
  b.box([-s * (w / 2 - armW - 25), seatTop - 2, -d / 2 + backT + 18], [38, 34, 12], tint('fabricLight'), 5, [-0.25, 0, 0])
  b.box([s * (w / 2 - armW - 25), seatTop - 2, -d / 2 + backT + 18], [38, 34, 12], tint('fabricLight'), 5, [-0.25, 0, 0])
}

const RoundTable: Model = (b, { w, d, h, main }) => {
  const r = Math.min(w, d) / 2
  const t = Math.min(4, h * 0.1)
  b.cyl([0, 0, 0], r * 0.55, 2, M('blackMetal'), { seg: 32 })
  b.cyl([0, 2, 0], Math.max(2, r * 0.09), h - t - 2, M('blackMetal'), { rt: Math.max(1.8, r * 0.08), seg: 16 })
  b.cyl([0, h - t, 0], r, t, main, { seg: 40 })
}

const CentreTable: Model = (b, { w, d, h, main }) => {
  legs4(b, w, d, 5, 5, h - 4, M('darkWood'))
  b.box([0, 10, 0], [w - 8, 2.5, d - 8], main)
  b.box([0, h - 4, 0], [w, 4, d], main, 1.2)
}

const Pouf: Model = (b, { w, d, h, main }) => {
  const r = Math.min(w, d) / 2
  b.cyl([0, 0, 0], r * 0.97, h - 4, main, { rt: r, seg: 36 })
  b.sphere([0, h - 4, 0], [1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2], main, [r * 0.98, 4, r * 0.98])
}

const Rug: Model = (b, { w, d, h, main }) => {
  const bw = Math.min(8, w * 0.05)
  const th = Math.max(0.3, h)
  b.box([0, 0, 0], [w - 0.2, th * 0.8, d - 0.2], main)
  for (const [x, z, sw, sd] of [
    [0, -d / 2 + bw / 2, w, bw],
    [0, d / 2 - bw / 2, w, bw],
    [-w / 2 + bw / 2, 0, bw, d - 2 * bw],
    [w / 2 - bw / 2, 0, bw, d - 2 * bw],
  ])
    b.box([x, 0, z], [sw, th, sd], L.rugBorder())
  for (const k of [0.55, 0.3]) {
    b.box([0, 0, -d * k * 0.5], [w * k, th * 0.9, 1.5], L.rugBorder())
    b.box([0, 0, d * k * 0.5], [w * k, th * 0.9, 1.5], L.rugBorder())
    b.box([-w * k * 0.5, 0, 0], [1.5, th * 0.9, d * k], L.rugBorder())
    b.box([w * k * 0.5, 0, 0], [1.5, th * 0.9, d * k], L.rugBorder())
  }
}

const TvUnit: Model = (b, { w, d, h, main }) => {
  const legH = 10
  const bodyH = h - legH
  const fz = d / 2 - 0.6
  const sec = w / 3
  legs4(b, w, d, 6, 3, legH, M('blackMetal'))
  b.box([0, legH, -0.3], [w, bodyH, d - 0.6], main, 1)
  // open centre niche
  b.box([0, legH + 5, fz - 15], [sec - 4, bodyH - 10, 30], M('darkWood'))
  // drawer fronts: grooves + handles
  for (const sx of [-1, 1]) {
    b.box([sx * (sec / 2), legH + 1, fz + 0.2], [0.6, bodyH - 2, 0.8], M('blackMetal'))
    b.box([sx * sec, legH + bodyH / 2 - 0.3, fz + 0.2], [sec - 2, 0.6, 0.8], M('blackMetal'))
    b.box([sx * sec, legH + bodyH * 0.75 - 1, fz + 0.4], [sec * 0.4, 1.2, 0.4], M('metal'))
    b.box([sx * sec, legH + bodyH * 0.25 - 1, fz + 0.4], [sec * 0.4, 1.2, 0.4], M('metal'))
  }
  b.box([0, h - 2, 0], [w, 2, d], M('darkWood'))
}

const Tv: Model = (b, { w, d, h, main }) => {
  const backD = Math.max(0.5, d - 2.2)
  b.box([0, h * 0.15, -d / 2 + backD / 2], [w * 0.7, h * 0.7, backD], main, 1.5)
  b.box([0, 0, d / 2 - 1.0], [w, h, 1.6], main, 0.5)
  b.plane([0, h / 2, d / 2 + 0.05], w - 1.8, h - 1.8, L.screen())
}

const Divider: Model = (b, { w, d, h, main }) => {
  const t = 3
  const plinth = 6
  const n = Math.max(2, Math.round(w / 45))
  const iw = w - 2 * t
  const ih = h - plinth - 2 * t
  b.box([0, 0, 0], [w - 2 * t, plinth, d - 4], M('blackMetal'))
  b.box([-w / 2 + t / 2, 0, 0], [t, h, d], main)
  b.box([w / 2 - t / 2, 0, 0], [t, h, d], main)
  b.box([0, h - t, 0], [w, t, d], main, 0.6)
  b.box([0, plinth, 0], [iw, t, d], main)
  b.box([0, plinth + t + ih / 2 - t / 2, 0], [iw, t, d], main)
  b.box([0, plinth + t, -d / 2 + 0.5], [iw, ih, 1], M('woodVeneer'))
  for (let i = 0; i < n - 1; i++) b.box([-iw / 2 + (iw / n) * (i + 1), plinth + t, 0], [t, ih, d], main)
}

// ---------------------------------------------------------------- dining / seating
const DiningTable: Model = (b, { w, d, h, main }) => {
  const t = 4
  legs4(b, w, d, 12, 6, h - t, M('darkWood'))
  b.box([0, h - t - 9, 0], [w - 18, 9, d - 18], M('darkWood'))
  b.box([0, h - t, 0], [w, t, d], main, 1.5)
}

const DiningChair: Model = (b, { w, d, h, main }) => {
  const seatY = 44
  const wood = M('darkWood')
  b.box([-w / 2 + 2.5, 0, d / 2 - 3], [3, seatY, 3], wood)
  b.box([w / 2 - 2.5, 0, d / 2 - 3], [3, seatY, 3], wood)
  b.box([-w / 2 + 2.5, 0, -d / 2 + 1.5], [3, h - 2, 3], wood)
  b.box([w / 2 - 2.5, 0, -d / 2 + 1.5], [3, h - 2, 3], wood)
  b.box([0, seatY - 3, 1.5], [w, 7, d - 3], main, 2.5)
  b.box([0, seatY + 12, -d / 2 + 4], [w - 2, h - seatY - 12, 4], main, 2)
}

const BalconyChair: Model = (b, { w, d, h, main }) => {
  const seatY = 40
  legs4(b, w, d, 3, 3.5, seatY, main)
  b.box([-w / 2 + 2, 0, -d / 2 + 1.75], [3.5, h, 3.5], main)
  b.box([w / 2 - 2, 0, -d / 2 + 1.75], [3.5, h, 3.5], main)
  b.box([0, seatY - 4, 0], [w - 2, 4, d], main)
  b.box([0, seatY, 2], [w - 6, 8, d - 10], M('fabricLight'), 3)
  b.box([0, seatY + 14, -d / 2 + 4], [w - 6, h - seatY - 16, 6], M('fabricLight'), 3, [-0.12, 0, 0])
  for (const sx of [-1, 1]) b.box([sx * (w / 2 - 2), seatY + 20, 0], [4, 3, d - 2], main, 1)
  for (const sx of [-1, 1]) b.box([sx * (w / 2 - 2), seatY, d / 2 - 3], [3, 20, 3], main)
}

const BarStool: Model = (b, { w, d, h, main }) => {
  const r = Math.min(w, d) / 2
  b.cyl([0, 0, 0], r * 0.85, 2, M('metal'))
  b.cyl([0, 2, 0], 2.5, h - 8, M('metal'), { seg: 14 })
  b.torus([0, 26, 0], [Math.PI / 2, 0, 0], [r * 0.6, 1, 8, 32], M('metal'))
  b.cyl([0, h - 7, 0], r * 0.7, 2, M('blackMetal'))
  b.cyl([0, h - 5, 0], r, 5, main, { rt: r * 0.96, seg: 32 })
}

// ---------------------------------------------------------------- bedroom
const Bed: Model = (b, { w, d, h, main }) => {
  const headT = 8
  const frameH = 30
  const len = d - headT
  const mattTop = frameH + 22
  const duvetL = len * 0.68
  const nP = w >= 120 ? 2 : 1
  const pw = Math.min(68, (w - 16) / nP - 4)
  b.box([0, 0, headT / 2], [w - 10, 6, len - 10], M('blackMetal'))
  b.box([0, 6, headT / 2], [w, frameH - 6, len], M('darkWood'), 2)
  b.box([0, 0, -d / 2 + headT / 4], [w, h, headT / 2], M('darkWood'), 1)
  b.box([0, frameH + 4, -d / 2 + headT * 0.75], [w - 6, h - frameH - 8, headT / 2], tint('fabricLight'), 2)
  b.box([0, frameH, headT / 2], [w - 4, 22, len - 2], L.linen(), 4)
  b.box([0, frameH + 3, d / 2 - duvetL / 2 - 0.5], [w - 1, mattTop - frameH - 1, duvetL], main, 3)
  b.box([0, mattTop + 1, d / 2 - duvetL + 9], [w - 1, 2.5, 18], L.linen(), 1)
  for (let i = 0; i < nP; i++)
    b.box([nP === 1 ? 0 : (i === 0 ? -1 : 1) * (pw / 2 + 3), mattTop - 2, -d / 2 + headT + 24], [pw, 14, 38], L.linen(), 6, [-0.35, 0, 0])
}

const Bedside: Model = (b, { w, d, h, main }) => {
  const legH = 8
  const fz = d / 2 - 0.6
  const bh = h - legH
  legs4(b, w, d, 4, 3, legH, M('darkWood'), true)
  b.box([0, legH, -0.3], [w, bh, d - 0.6], main, 1)
  b.box([0, legH + bh / 2, fz + 0.2], [w - 2, 0.6, 0.8], M('blackMetal'))
  b.cylZ([0, legH + bh * 0.75, fz + 0.2], 1.4, 0.8, M('metal'))
  b.cylZ([0, legH + bh * 0.25, fz + 0.2], 1.4, 0.8, M('metal'))
}

const Wardrobe: Model = (b, { w, d, h, main }) => {
  const plinth = 8
  const bodyD = d - 2.5
  const fz = -1.25 + bodyD / 2
  const n = w <= 100 ? 2 : w <= 150 ? 3 : 4
  const dw = w / n
  const loftY = h - 45
  b.box([0, 0, -2], [w - 2, plinth, d - 7], M('darkWood'))
  b.box([0, plinth, -1.25], [w, h - plinth, bodyD], main, 0.8)
  b.box([0, loftY, fz + 0.2], [w - 1, 0.6, 0.8], M('blackMetal'))
  for (let i = 1; i < n; i++) b.box([-w / 2 + i * dw, plinth + 1, fz + 0.2], [0.6, h - plinth - 2, 0.8], M('blackMetal'))
  for (let i = 0; i < n; i++) {
    const right = i % 2 === 0
    const hx = -w / 2 + dw * i + (right ? dw - 4 : 4)
    b.box([hx, 85, fz + 1.25], [1.4, 45, 2.5], M('metal'), 0.6)
    b.box([hx, loftY + 4, fz + 1.25], [1.4, 14, 2.5], M('metal'), 0.6)
  }
}

const DressingTable: Model = (b, { w, d, h, main }) => {
  const topY = 72
  const mw = Math.min(w * 0.7, 60)
  legs4(b, w, d, 3, 4, topY - 15, M('darkWood'))
  b.box([0, topY - 15, 0], [w, 15, d - 1], main, 0.8)
  b.box([0, topY - 7.8, d / 2 - 0.1], [w - 4, 0.6, 0.2], M('blackMetal'))
  b.box([0, topY, 0], [w, 3, d], main, 0.8)
  b.box([0, topY + 3, -d / 2 + 1.5], [mw, h - topY - 3, 3], M('darkWood'), 1.2)
  b.box([0, topY + 6, -d / 2 + 3.1], [mw - 6, h - topY - 9, 0.3], L.mirror())
}

// ---------------------------------------------------------------- study / storage
const Desk: Model = (b, { w, d, h, main }) => {
  const t = 3
  const metal = M('blackMetal')
  for (const sx of [-1, 1]) {
    b.box([sx * (w / 2 - 3), 0, d / 2 - 4], [3, h - t, 3], metal)
    b.box([sx * (w / 2 - 3), 0, -d / 2 + 4], [3, h - t, 3], metal)
    b.box([sx * (w / 2 - 3), 6, 0], [3, 3, d - 8], metal)
  }
  b.box([0, h - t - 30, -d / 2 + 4], [w - 10, 26, 1.5], main)
  b.box([w / 2 - 26, h - t - 15, 0], [40, 15, d - 6], main, 0.6)
  b.box([w / 2 - 26, h - t - 8, d / 2 - 3 + 0.2], [14, 1.2, 0.5], M('metal'))
  b.box([0, h - t, 0], [w, t, d], main, 0.8)
}

const StudyChair: Model = (b, { w, d, h, main }) => {
  const r = Math.min(w, d) / 2
  const seatY = 46
  for (let i = 0; i < 5; i++) {
    b.group(undefined, [0, (i * 2 * Math.PI) / 5, 0], () => {
      b.box([0, 4, (r - 4) / 2], [4, 2.5, r - 4], M('blackMetal'))
      b.sphere([0, 2.5, r - 3], [2.5, 12, 8], L.dark())
    })
  }
  b.cyl([0, 5, 0], 2.6, seatY - 13, M('metal'), { seg: 16 })
  b.box([0, seatY - 9, 0], [w - 10, 2, d - 14], M('blackMetal'))
  b.box([0, seatY - 8, 2], [w - 6, 8, d - 10], main, 3)
  b.box([0, seatY - 8, -d / 2 + 4], [5, 22, 3], M('blackMetal'))
  b.box([0, seatY + 10, -d / 2 + 4], [w - 12, h - seatY - 10, 6], main, 3, [-0.1, 0, 0])
}

const BOOK_COLORS = ['#7b2f2f', '#2f4d6b', '#c9b48a', '#3d5a40', '#d8d2c4', '#8a5a2b', '#3a3a3f', '#a0473a']
const Bookshelf: Model = (b, { w, d, h, main }) => {
  const t = 2.5
  const n = Math.max(2, Math.round(h / 36))
  const gap = (h - t) / n
  b.box([-w / 2 + t / 2, 0, 0], [t, h, d], main)
  b.box([w / 2 - t / 2, 0, 0], [t, h, d], main)
  b.box([0, 0, -d / 2 + 0.5], [w - 2 * t, h, 1], main)
  for (let i = 0; i <= n; i++) b.box([0, i === n ? h - t : i * gap, 0], [w - 2 * t, t, d], main)
  let seed = 7
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  for (let s = 0; s < n; s++) {
    let x = -w / 2 + t + 1
    const y = s * gap + t
    while (x < w / 2 - t - 8) {
      const bw = 6 + rnd() * 9
      const bh = Math.min(gap - 4, 18 + rnd() * 10)
      if (rnd() < 0.15) {
        x += bw * 0.6
        continue
      }
      b.box([x + bw / 2, y, 1], [bw - 0.4, bh, d - 6], paint(BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)], 0.8))
      x += bw
    }
  }
}

const ShoeRack: Model = (b, { w, d, h, main }) => {
  const legH = 8
  const bh = h - legH
  const fz = d / 2 - 0.6
  legs4(b, w, d, 4, 3, legH, M('blackMetal'))
  b.box([0, legH, -0.3], [w, bh, d - 0.6], main, 0.8)
  b.box([0, legH + 1, fz + 0.2], [0.6, bh - 2, 0.8], M('blackMetal'))
  for (let y = legH + 6; y < h - 4; y += 7) b.box([0, y, fz + 0.2], [w - 4, 0.5, 0.6], M('darkWood'))
  b.box([-3, h - 12, fz + 0.4], [1.2, 8, 0.4], M('metal'))
  b.box([3, h - 12, fz + 0.4], [1.2, 8, 0.4], M('metal'))
}

// ---------------------------------------------------------------- appliances
const Fridge: Model = (b, { w, d, h, main, variant }) => {
  const fz = d / 2 - 2.5
  const split = variant === 'single' ? h * 0.999 : h * 0.7
  b.box([0, 0, -2], [w - 4, 4, d - 8], L.dark())
  b.box([0, 3, -1.25], [w, h - 3, d - 2.5], main, 2)
  if (variant !== 'single') b.box([0, split, fz + 0.2], [w - 0.5, 0.6, 0.8], L.dark())
  if (variant !== 'single') b.box([-w / 2 + 6, split + 5, fz + 1.25], [2, 22, 2.5], L.grey(), 0.8)
  b.box([-w / 2 + 6, variant === 'single' ? h * 0.45 : split - 50, fz + 1.25], [2, 40, 2.5], L.grey(), 0.8)
  b.box([w / 2 - 14, split - 22, fz + 0.2], [8, 12, 0.5], L.dark(), 0.2)
}

const WashingMachine: Model = (b, { w, d, h, main }) => {
  const fz = d / 2 - 2
  const r = Math.min(w * 0.3, h * 0.24)
  b.box([0, 0, -1], [w, h, d - 2], main, 2)
  b.box([0, h - 13, fz], [w - 3, 10, 0.8], L.white(), 0.3)
  b.box([-w / 2 + 12, h - 11, fz + 0.4], [16, 6, 0.5], L.grey())
  b.cylZ([w / 2 - 12, h - 8, fz + 0.9], 3.5, 1.8, L.grey())
  b.box([w / 4, h - 11, fz + 0.4], [10, 4, 0.5], L.dark())
  b.torus([0, h * 0.45, fz - 0.4], undefined, [r, 2.4, 12, 40], L.grey())
  b.cylZ([0, h * 0.45, fz + 0.6], r - 1, 0.8, L.porthole(), 36)
}

const Microwave: Model = (b, { w, d, h, main }) => {
  const fz = d / 2
  b.box([0, 0, -0.3], [w, h, d - 0.6], main, 1.5)
  b.box([-w * 0.13, 3, fz - 0.4], [w * 0.66, h - 6, 0.4], L.screen())
  b.box([w * 0.36, 3, fz - 0.4], [w * 0.18, h - 6, 0.4], L.grey())
}

const Dishwasher: Model = (b, { w, d, h, main }) => {
  const fz = d / 2 - 2
  b.box([0, 0, -2], [w - 2, 8, d - 6], L.dark())
  b.box([0, 8, -1], [w, h - 8, d - 2], main, 1)
  b.box([0, h - 9, fz + 0.2], [w, 7, 0.8], L.dark())
  b.box([0, h - 18, fz + 1], [w - 16, 2, 2], L.grey(), 0.8)
}

const Ac: Model = (b, { w, d, h, main }) => {
  b.box([0, 0, 0], [w, h, d], main, Math.min(5, h / 3))
  b.box([0, 2, d / 2 - 4], [w - 14, 4.5, 6], L.dark())
  b.box([0, 6.2, d / 2 - 0.15], [w - 16, 0.5, 0.3], L.grey())
  b.box([w / 2 - 14, h * 0.55, d / 2 - 0.2], [6, 2, 0.4], L.dark())
}

const CeilingFan: Model = (b, { w, h, main }) => {
  const R = w / 2
  const hub = 10
  const bladeL = R - hub + 2
  b.cyl([0, h - 5, 0], 7, 5, main, { rt: 5 })
  b.cyl([0, 14, 0], 1.2, h - 19, M('metal'), { seg: 10 })
  b.cyl([0, 4, 0], hub, 10, main, { rt: hub - 1, seg: 32 })
  b.cyl([0, 0, 0], 5, 4, main, { rt: hub - 1, seg: 24 })
  for (let i = 0; i < 3; i++)
    b.group(undefined, [0, (i * 2 * Math.PI) / 3, 0], () => b.box([0, 8, hub - 2 + bladeL / 2], [11, 0.8, bladeL], main, 0.35, [0, 0, 0.08]))
}

const FloorLamp: Model = (b, { w, h, main }) => {
  const R = w / 2
  b.cyl([0, 0, 0], R * 0.6, 2.5, M('blackMetal'), { rt: R * 0.55 })
  b.cyl([0, 2.5, 0], 1.1, h - 30, M('blackMetal'), { seg: 10 })
  b.cyl([0, h - 30, 0], R, 30, main, { rt: R * 0.72, seg: 36, open: true })
  b.sphere([0, h - 18, 0], [4, 16, 12], L.bulb())
}

const Plant: Model = (b, { w, d, h, main }) => {
  const R = Math.min(w, d) / 2
  const ph = Math.max(10, h * (h < 60 ? 0.38 : 0.3))
  b.cyl([0, 0, 0], R * 0.5, ph, main, { rt: R * 0.66, seg: 28 })
  b.cyl([0, ph - 1.5, 0], R * 0.6, 1.4, M('soil'), { seg: 24 })
  const layers = [
    { b: 0.22, n: 3, k: 1 },
    { b: 0.6, n: 5, k: 1 },
    { b: 1.0, n: 7, k: 1 },
  ]
  layers.forEach((Ly, li) => {
    for (let i = 0; i < Ly.n; i++) {
      const a = (i / Ly.n) * Math.PI * 2 + li * 0.7
      const len = Ly.k * Math.min((R * 0.97) / Math.sin(Ly.b), (h - ph + 1) / Math.cos(Ly.b))
      const lw = Math.max(3, Math.min(R * 0.55, len * 0.32))
      b.group([0, ph - 2, 0], [0, a, 0], () =>
        b.group(undefined, [Ly.b, 0, 0], () => b.sphere([0, len / 2, 0], [0.5, 10, 8], M('plant'), [lw, len, lw * 0.25])),
      )
    }
  })
}

const Mirror: Model = (b, { w, d, h, main }) => {
  b.box([0, 0, -0.3], [w, h, d - 0.6], main, 1.2)
  b.box([0, 3, d / 2 - 0.5], [w - 6, h - 6, 0.5], L.mirror())
}

const Fallback: Model = (b, { w, d, h, main }) => {
  b.box([0, 0, 0], [w, h, d], main, 2)
}

// ---------------------------------------------------------------- registry
const MODELS: Record<ModelKind, Model> = {
  sofa: Sofa,
  lsofa: LSofa,
  armchair: Sofa,
  roundTable: RoundTable,
  centreTable: CentreTable,
  pouf: Pouf,
  rug: Rug,
  tvUnit: TvUnit,
  tv: Tv,
  divider: Divider,
  diningTable: DiningTable,
  diningChair: DiningChair,
  balconyChair: BalconyChair,
  barStool: BarStool,
  bed: Bed,
  bedside: Bedside,
  wardrobe: Wardrobe,
  dressingTable: DressingTable,
  desk: Desk,
  studyChair: StudyChair,
  bookshelf: Bookshelf,
  shoeRack: ShoeRack,
  fridge: Fridge,
  washingMachine: WashingMachine,
  microwave: Microwave,
  dishwasher: Dishwasher,
  ac: Ac,
  ceilingFan: CeilingFan,
  floorLamp: FloorLamp,
  plant: Plant,
  mirror: Mirror,
}

/** Main (colour-overridable) material per model: a getMaterials() key, or 'paint' = plain paint in the catalog colour. */
const MAIN: Record<ModelKind, MaterialKey | 'paint' | 'shade'> = {
  sofa: 'fabricBlue',
  lsofa: 'fabricBlue',
  armchair: 'fabricBlue',
  roundTable: 'darkWood',
  centreTable: 'darkWood',
  pouf: 'paint',
  rug: 'paint',
  tvUnit: 'woodVeneer',
  tv: 'blackMetal',
  divider: 'darkWood',
  diningTable: 'stoneTop',
  diningChair: 'fabricLight',
  balconyChair: 'woodVeneer',
  barStool: 'darkWood',
  bed: 'fabricLight',
  bedside: 'woodVeneer',
  wardrobe: 'woodVeneer',
  dressingTable: 'woodVeneer',
  desk: 'woodVeneer',
  studyChair: 'paint',
  bookshelf: 'darkWood',
  shoeRack: 'woodVeneer',
  fridge: 'paint',
  washingMachine: 'paint',
  microwave: 'paint',
  dishwasher: 'paint',
  ac: 'paint',
  ceilingFan: 'paint',
  floorLamp: 'shade',
  plant: 'paint',
  mirror: 'darkWood',
}

/** The colour-overridable main material of a catalog item (falls back to plain paint for unknown ids). */
export function mainMaterial(catalogId: string, color?: string): Mat {
  const e = getEntry(catalogId)
  if (!e) return paint(color ?? '#9a9a9a', 0.7)
  const k = MAIN[e.model]
  if (k === 'paint') {
    const metallic = e.model === 'fridge' || e.model === 'dishwasher'
    return paint(color ?? e.color, metallic ? 0.32 : e.model === 'pouf' || e.model === 'rug' || e.model === 'studyChair' ? 0.95 : 0.4, metallic ? 0.6 : 0)
  }
  if (k === 'shade') return shade(color ?? e.color)
  return tint(k, color)
}

export interface FurnitureModelProps {
  catalogId: string
  w: number
  d: number
  h: number
  color?: string
}

/**
 * Build the merged geometry of a model in metres (origin = footprint centre at the bottom, front = +z):
 * one BufferGeometry with one group per material. `lod` = the low-detail distance proxy instead
 * (plain boxes / low-poly cylinders for the bigger parts; handles, grooves, screens dropped).
 */
export function buildFurniture({ catalogId, w, d, h, color }: FurnitureModelProps, lod = false): BuiltGeometry {
  const e = getEntry(catalogId)
  const model = e ? MODELS[e.model] : Fallback
  const b = new GeoBuilder(!lod)
  model(b, { w, d, h, main: mainMaterial(catalogId, color), variant: e?.variant })
  return lod ? b.buildLod() : b.build()
}

