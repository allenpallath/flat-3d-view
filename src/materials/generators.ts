// Pure procedural texture generators (no three.js objects, no DOM) so they can run in a Web Worker.
import { Noise, buildRaw, cellRand, gridDist, hex, lerp, smooth, type RawSet } from './textures'

type RGB = [number, number, number]
const mix3 = (a: RGB, b: RGB, t: number, o: Float32Array) => {
  o[0] = lerp(a[0], b[0], t)
  o[1] = lerp(a[1], b[1], t)
  o[2] = lerp(a[2], b[2], t)
}
const mul3 = (o: Float32Array, k: number) => {
  o[0] *= k
  o[1] *= k
  o[2] *= k
}

/** 80x80 beige marble-look vitrified tile, 2 mm grout. Texture = 2x2 tiles (1.6 m). */
export function hallTileTex(): RawSet {
  const n = new Noise(11)
  const base = hex('#e8dfcf')
  const vein = hex('#c4b294')
  const grout = hex('#c9bfae')
  return buildRaw(
    (u, v, o) => {
      const tu = u * 2
      const tv = v * 2
      const ti = Math.floor(tu)
      const tj = Math.floor(tv)
      const r = cellRand(ti, tj, 7)
      // distance to grout centre in metres (tile = 0.8 m)
      const d = Math.min(gridDist(tu), gridDist(tv)) * 0.8
      const g = smooth(0.0007, 0.0017, d) // 1 on tile, 0 in grout
      // marble: domain-warped noise, thin veins on its zero crossings; each tile cut from a different slab area
      const ou = u + r * 0.37
      const ov = v + r * 0.61
      const w = n.fbm(ou, ov, 2, 3)
      const vf = n.fbm(ou + 0.25 * w, ov + 0.15 * w, 3, 4)
      const veins = 1 - smooth(0.0, 0.035, Math.abs(vf))
      const veinsSoft = 1 - smooth(0.0, 0.18, Math.abs(vf))
      const cloud = w
      mix3(base, vein, veins * 0.55 + veinsSoft * 0.12, o)
      mul3(o, 1 + cloud * 0.035 + (r - 0.5) * 0.03)
      // grout
      o[0] = lerp(grout[0], o[0], g)
      o[1] = lerp(grout[1], o[1], g)
      o[2] = lerp(grout[2], o[2], g)
      o[3] = lerp(0.85, 0.13 + 0.05 * (cloud + 1) + veins * 0.04, g)
      o[4] = g + cloud * 0.01
    },
    { w: 1024, size: [1.6, 1.6], normal: 1.5 },
  )
}

/** Wood grain generator shared by toilet tile & veneers. Grain runs along v. */
function woodGrain(n: Noise, u: number, v: number, seed: number, ringFreq: number, figure: number) {
  const ou = u + seed * 0.53
  const ov = v + seed * 0.29
  const warp = n.fbm(ou, ov, 2, 2, 0.5, 1)
  const fibres = n.fbm(ou, ov, 64, 2, 0.5, 2) // long thin streaks along v
  const rings = Math.sin((ou * ringFreq + warp * figure) * Math.PI * 2)
  const ring = Math.pow(0.5 + 0.5 * rings, 3)
  const pores = n.noise(ou * 256, ov * 16, 256, 16)
  return { ring, fibres, pores, warp }
}

/** 60x120 wood-look porcelain tile. Texture covers 1.2 x 1.2 m = 2 planks across, staggered by half. */
export function toiletTileTex(): RawSet {
  const n = new Noise(23)
  const light = hex('#d3a575')
  const dark = hex('#a77447')
  const grout = hex('#9b7d5e')
  return buildRaw(
    (u, v, o) => {
      const tu = u * 2
      const i = Math.floor(tu)
      const tv = v + (i % 2 ? 0.5 : 0)
      const j = Math.floor(tv)
      const r = cellRand(i, j, 3)
      const d = Math.min(gridDist(tu) * 0.6, gridDist(tv) * 1.2)
      const g = smooth(0.0008, 0.002, d)
      const wg = woodGrain(n, u, v, r, 9, 1.2)
      const t = 0.35 + wg.ring * 0.35 + wg.fibres * 0.25 + (r - 0.5) * 0.3
      mix3(light, dark, Math.min(1, Math.max(0, t)), o)
      o[0] = lerp(grout[0], o[0], g)
      o[1] = lerp(grout[1], o[1], g)
      o[2] = lerp(grout[2], o[2], g)
      o[3] = lerp(0.8, 0.42 + wg.ring * 0.08, g)
      o[4] = g + wg.fibres * 0.03
    },
    { w: 512, size: [1.2, 1.2], normal: 1.2 },
  )
}

/** 40x40 matte anti-skid tile. Texture = 2x2 tiles (0.8 m). */
export function balconyTileTex(): RawSet {
  const n = new Noise(31)
  const base = hex('#d3ccbf')
  const speck = hex('#a59c8e')
  const grout = hex('#a8a093')
  return buildRaw(
    (u, v, o) => {
      const tu = u * 2
      const tv = v * 2
      const r = cellRand(Math.floor(tu), Math.floor(tv), 5)
      const d = Math.min(gridDist(tu), gridDist(tv)) * 0.4
      const g = smooth(0.001, 0.0025, d)
      const s = n.fbm(u, v, 96, 2)
      const sp = smooth(0.35, 0.55, s)
      const cloud = n.fbm(u, v, 4, 3)
      mix3(base, speck, sp * 0.6, o)
      mul3(o, 1 + cloud * 0.04 + (r - 0.5) * 0.04)
      o[0] = lerp(grout[0], o[0], g)
      o[1] = lerp(grout[1], o[1], g)
      o[2] = lerp(grout[2], o[2], g)
      o[3] = lerp(0.95, 0.82 + s * 0.08, g)
      o[4] = g + n.fbm(u, v, 128, 2) * 0.12
    },
    { w: 512, size: [0.8, 0.8], normal: 2 },
  )
}

/** Light oak veneer, grain along v, 1 m. */
export function oakTex(): RawSet {
  const n = new Noise(41)
  const light = hex('#d4b086')
  const dark = hex('#b08657')
  return buildRaw(
    (u, v, o) => {
      const wg = woodGrain(n, u, v, 0.2, 14, 2.5)
      const t = wg.ring * 0.5 + (wg.fibres + 0.5) * 0.4 + Math.max(0, wg.pores) * 0.2
      mix3(light, dark, Math.min(1, Math.max(0, t)), o)
      o[3] = 0.5 + wg.ring * 0.1 + Math.max(0, wg.pores) * 0.1
      o[4] = wg.fibres * 0.3 - Math.max(0, wg.pores) * 0.4
    },
    { w: 512, size: [1, 1], normal: 0.6 },
  )
}

/** Walnut, darker and with stronger cathedral figure, 1 m. */
export function walnutTex(): RawSet {
  const n = new Noise(43)
  const light = hex('#7a5539')
  const dark = hex('#4b3020')
  return buildRaw(
    (u, v, o) => {
      const wg = woodGrain(n, u, v, 0.7, 8, 4)
      const t = wg.ring * 0.55 + (wg.fibres + 0.5) * 0.35 + Math.max(0, wg.pores) * 0.25
      mix3(light, dark, Math.min(1, Math.max(0, t)), o)
      o[3] = 0.42 + wg.ring * 0.08
      o[4] = wg.fibres * 0.3 - Math.max(0, wg.pores) * 0.4
    },
    { w: 512, size: [1, 1], normal: 0.6 },
  )
}

/** Light quartz with fine speckle, 0.6 m. */
export function quartzTex(): RawSet {
  const n = new Noise(53)
  const base = hex('#efebe5')
  const grey = hex('#b9b3aa')
  const dark = hex('#6f6a63')
  return buildRaw(
    (u, v, o) => {
      const a = n.fbm(u, v, 128, 1)
      const b = n.fbm(u + 0.5, v + 0.3, 64, 2)
      const c = n.fbm(u, v, 3, 3)
      mix3(base, grey, smooth(0.25, 0.45, b) * 0.55, o)
      if (a > 0.55) mix3([o[0], o[1], o[2]], dark, smooth(0.55, 0.7, a) * 0.8, o)
      mul3(o, 1 + c * 0.02)
      o[3] = 0.16 + c * 0.03
      o[4] = 0
    },
    { w: 512, size: [0.6, 0.6], roughness: true },
  )
}

/** Neutral plaster / paint: near-white colour variation (tinted by material.color), roughness variation, faint orange peel. 2 m. */
export function plasterTex(): RawSet {
  const n = new Noise(61)
  return buildRaw(
    (u, v, o) => {
      const c = n.fbm(u, v, 3, 4)
      const k = 1 + c * 0.012
      o[0] = o[1] = o[2] = k * 0.985
      o[3] = 0.86 + c * 0.07
      o[4] = n.fbm(u, v, 48, 2) * 0.08
    },
    { w: 512, size: [2, 2], normal: 1 },
  )
}

/** Matte lacquer (cabinet shutters): roughness variation only. 1 m. */
export function lacquerTex(): RawSet {
  const n = new Noise(67)
  return buildRaw(
    (u, v, o) => {
      const c = n.fbm(u, v, 4, 3)
      o[0] = o[1] = o[2] = 0.985 + c * 0.015
      o[3] = 0.5 + c * 0.06
    },
    { w: 256, size: [1, 1] },
  )
}

/** Plain weave fabric: neutral colour (tinted by material.color), 4 cm texture with 32 threads. */
export function weaveTex(): RawSet {
  const n = new Noise(71)
  const N = 32
  return buildRaw(
    (u, v, o) => {
      const tu = u * N
      const tv = v * N
      const i = Math.floor(tu)
      const j = Math.floor(tv)
      const lu = tu - i
      const lv = tv - j
      const warpTop = (i + j) & 1
      const across = Math.sin(Math.PI * lu)
      const along = Math.sin(Math.PI * lv)
      const h = warpTop ? across * (0.55 + 0.45 * along) : along * (0.55 + 0.45 * across)
      const heather = n.fbm(u, v, 16, 2) * 0.06 + (cellRand(i, j, 9) - 0.5) * 0.05
      const k = 0.8 + h * 0.2 + heather
      o[0] = o[1] = o[2] = k
      o[3] = 0.85 + (1 - h) * 0.15
      o[4] = h
    },
    { w: 256, size: [0.04, 0.04], normal: 1.2 },
  )
}

/** Short pile rug, neutral, 1 m. */
export function rugTex(): RawSet {
  const n = new Noise(73)
  return buildRaw(
    (u, v, o) => {
      const p = n.fbm(u, v, 128, 2)
      const c = n.fbm(u, v, 6, 3)
      // faint concentric loop pattern like the drawing's rug
      const ring = Math.sin(Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2 * Math.PI * 9 + c * 3)
      const line = smooth(0.92, 0.99, ring)
      const k = 0.88 + p * 0.1 + c * 0.03 - line * 0.07
      o[0] = o[1] = o[2] = k
      o[3] = 0.97
      o[4] = p * 0.5
    },
    { w: 512, size: [1, 1], normal: 1.5 },
  )
}

/** Pebbled leather, neutral, 25 cm. */
export function leatherTex(): RawSet {
  const n = new Noise(79)
  return buildRaw(
    (u, v, o) => {
      const a = Math.abs(n.fbm(u, v, 24, 3))
      const c = n.fbm(u, v, 4, 2)
      const crease = smooth(0.0, 0.12, a)
      o[0] = o[1] = o[2] = 0.88 + crease * 0.12 + c * 0.04
      o[3] = 0.42 + (1 - crease) * 0.2
      o[4] = crease
    },
    { w: 256, size: [0.25, 0.25], normal: 1.2 },
  )
}

/** Brushed steel streaks along u, 30 cm. */
export function brushedTex(): RawSet {
  const n = new Noise(83)
  return buildRaw(
    (u, v, o) => {
      const s = n.fbm(u, v, 2, 3, 0.6, 128)
      o[0] = o[1] = o[2] = 0.95 + s * 0.05
      o[3] = 0.3 + s * 0.08
      o[4] = s * 0.2
    },
    { w: 256, size: [0.3, 0.3], normal: 1 },
  )
}

/** Lawn, 2 m. */
export function grassTex(): RawSet {
  const n = new Noise(89)
  const a = hex('#5f7f3c')
  const b = hex('#435f2a')
  const c = hex('#8a9450')
  return buildRaw(
    (u, v, o) => {
      const big = n.fbm(u, v, 3, 3)
      const blades = n.fbm(u, v, 128, 2)
      mix3(a, b, 0.5 + blades * 0.8, o)
      const dry = smooth(0.2, 0.6, big)
      o[0] = lerp(o[0], c[0], dry * 0.5)
      o[1] = lerp(o[1], c[1], dry * 0.5)
      o[2] = lerp(o[2], c[2], dry * 0.5)
      o[3] = 0.95
      o[4] = blades * 0.5
    },
    { w: 512, size: [2, 2], normal: 2 },
  )
}

/** 30x30 concrete pavers with 5 mm joints, texture covers 1.2 m (4x4). */
export function pavingTex(): RawSet {
  const n = new Noise(97)
  const base = hex('#b3aca1')
  const joint = hex('#6e695f')
  return buildRaw(
    (u, v, o) => {
      const tu = u * 4
      const tv = v * 4
      const r = cellRand(Math.floor(tu), Math.floor(tv), 11)
      const d = Math.min(gridDist(tu), gridDist(tv)) * 0.3
      const g = smooth(0.002, 0.004, d)
      const s = n.fbm(u, v, 64, 3)
      o[0] = base[0] * (1 + s * 0.08 + (r - 0.5) * 0.12)
      o[1] = base[1] * (1 + s * 0.08 + (r - 0.5) * 0.12)
      o[2] = base[2] * (1 + s * 0.08 + (r - 0.5) * 0.12)
      o[0] = lerp(joint[0], o[0], g)
      o[1] = lerp(joint[1], o[1], g)
      o[2] = lerp(joint[2], o[2], g)
      o[3] = 0.9
      o[4] = g + s * 0.05
    },
    { w: 512, size: [1.2, 1.2], normal: 1.5 },
  )
}

/** Soil / mulch, 50 cm. */
export function soilTex(): RawSet {
  const n = new Noise(101)
  return buildRaw(
    (u, v, o) => {
      const s = n.fbm(u, v, 32, 3)
      o[0] = o[1] = o[2] = 0.8 + s * 0.3
      o[3] = 1
      o[4] = s
    },
    { w: 256, size: [0.5, 0.5], normal: 2 },
  )
}

/** Fair-faced concrete / exterior plaster, 4 m. */
export function concreteTex(): RawSet {
  const n = new Noise(103)
  return buildRaw(
    (u, v, o) => {
      const c = n.fbm(u, v, 4, 5)
      const pits = smooth(0.55, 0.7, n.fbm(u, v, 128, 1))
      o[0] = o[1] = o[2] = 0.93 + c * 0.08 - pits * 0.1
      o[3] = 0.9
      o[4] = c * 0.05 - pits * 0.1
    },
    { w: 512, size: [4, 4], normal: 1 },
  )
}

export const GENERATORS = {
  plaster: plasterTex,
  hallTile: hallTileTex,
  weave: weaveTex,
  oak: oakTex,
  walnut: walnutTex,
  toiletTile: toiletTileTex,
  balconyTile: balconyTileTex,
  quartz: quartzTex,
  lacquer: lacquerTex,
  rug: rugTex,
  leather: leatherTex,
  brushed: brushedTex,
  grass: grassTex,
  paving: pavingTex,
  soil: soilTex,
  concrete: concreteTex,
} as const
export type TexSetName = keyof typeof GENERATORS
