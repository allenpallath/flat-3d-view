// OWNER: Materials & Lighting agent (A2).
// Procedural PBR texture generation (no downloads). Everything is generated into
// raw RGBA buffers from tileable gradient noise, so it also works without a DOM.
// Convention: geometry UV 1.0 = 1 metre, so each texture set gets
// repeat = 1 / (real-world size it covers).

// ---------------------------------------------------------------- noise
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Periodic 2D gradient noise (period must be an integer <= 256). Returns roughly -1..1. */
export class Noise {
  private perm = new Uint8Array(512)
  private gx = new Float32Array(256)
  private gy = new Float32Array(256)
  constructor(seed = 1) {
    const r = mulberry32(seed)
    const p = Array.from({ length: 256 }, (_, i) => i)
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[p[i], p[j]] = [p[j], p[i]]
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]
    for (let i = 0; i < 256; i++) {
      const a = r() * Math.PI * 2
      this.gx[i] = Math.cos(a)
      this.gy[i] = Math.sin(a)
    }
  }
  noise(x: number, y: number, px: number, py: number): number {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const x0 = ((xi % px) + px) % px
    const y0 = ((yi % py) + py) % py
    const x1 = (x0 + 1) % px
    const y1 = (y0 + 1) % py
    const P = this.perm
    const h00 = P[P[x0 & 255] + (y0 & 255)]
    const h10 = P[P[x1 & 255] + (y0 & 255)]
    const h01 = P[P[x0 & 255] + (y1 & 255)]
    const h11 = P[P[x1 & 255] + (y1 & 255)]
    const d00 = this.gx[h00] * xf + this.gy[h00] * yf
    const d10 = this.gx[h10] * (xf - 1) + this.gy[h10] * yf
    const d01 = this.gx[h01] * xf + this.gy[h01] * (yf - 1)
    const d11 = this.gx[h11] * (xf - 1) + this.gy[h11] * (yf - 1)
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
    const a = d00 + (d10 - d00) * u
    const b = d01 + (d11 - d01) * u
    return (a + (b - a) * v) * 1.4
  }
  /** Tileable fBm over the unit square: u,v in [0,1), base frequency `f` (integer). */
  fbm(u: number, v: number, f: number, octaves = 4, gain = 0.5, fy = f): number {
    let sum = 0
    let amp = 1
    let norm = 0
    let fx = f
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(u * fx, v * fy, fx, fy)
      norm += amp
      amp *= gain
      fx *= 2
      fy *= 2
    }
    return sum / norm
  }
}

// ---------------------------------------------------------------- helpers
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
export function hex(c: string): [number, number, number] {
  const n = parseInt(c.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
/** hash of integer cell -> 0..1 */
export const cellRand = (i: number, j: number, seed = 0) => {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Per-pixel generator. Write into `o`:
 * o[0..2] = sRGB colour 0..1, o[3] = roughness 0..1, o[4] = height (any units, ~0..1).
 */
export type PixelFn = (u: number, v: number, o: Float32Array) => void

export interface RawSet {
  w: number
  h: number
  /** real-world size the texture covers, metres [u, v] */
  size: [number, number]
  col: Uint8Array
  rough?: Uint8Array
  normal?: Uint8Array
}

export interface BuildOpts {
  /** texture resolution (power of two) */
  w: number
  h?: number
  /** real-world size the texture covers, metres [u, v] */
  size: [number, number]
  /** normal strength: slope multiplier applied to height differences between neighbouring texels */
  normal?: number
  roughness?: boolean
}

// Resolution multiplier applied to every generator's `w`/`h` (1 = full, 0.5 = phones / low quality).
// Generators work in u,v space, so the pattern is resolution independent.
let texScale = 1
export function setTextureScale(s: number) {
  texScale = s
}
export const getTextureScale = () => texScale

/** Run a pixel generator and return raw RGBA colour / roughness / normal buffers. */
export function buildRaw(fn: PixelFn, opts: BuildOpts): RawSet {
  const w = Math.max(8, Math.round(opts.w * texScale))
  const h = Math.max(8, Math.round((opts.h ?? opts.w) * texScale))
  const n = w * h
  const col = new Uint8Array(n * 4)
  const rough = opts.roughness === false ? undefined : new Uint8Array(n * 4)
  const height = opts.normal ? new Float32Array(n) : null
  const o = new Float32Array(5)
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w
      o[0] = o[1] = o[2] = 0.5
      o[3] = 0.5
      o[4] = 0
      fn(u, v, o)
      const i = y * w + x
      const k = i * 4
      col[k] = clamp01(o[0]) * 255
      col[k + 1] = clamp01(o[1]) * 255
      col[k + 2] = clamp01(o[2]) * 255
      col[k + 3] = 255
      if (rough) {
        const r = clamp01(o[3]) * 255
        rough[k] = rough[k + 1] = rough[k + 2] = r
        rough[k + 3] = 255
      }
      if (height) height[i] = o[4]
    }
  }
  const raw: RawSet = { w, h, size: opts.size, col, rough }
  if (height) {
    const nm = new Uint8Array(n * 4)
    // height differences between neighbouring texels grow as resolution drops: keep the slope constant
    const s = opts.normal! * (w / opts.w)
    for (let y = 0; y < h; y++) {
      const ym = ((y - 1 + h) % h) * w
      const yp = ((y + 1) % h) * w
      const yc = y * w
      for (let x = 0; x < w; x++) {
        const xm = (x - 1 + w) % w
        const xp = (x + 1) % w
        const dx = (height[yc + xp] - height[yc + xm]) * s
        const dy = (height[yp + x] - height[ym + x]) * s
        const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1)
        const k = (yc + x) * 4
        nm[k] = (-dx * inv * 0.5 + 0.5) * 255
        nm[k + 1] = (-dy * inv * 0.5 + 0.5) * 255
        nm[k + 2] = (inv * 0.5 + 0.5) * 255
        nm[k + 3] = 255
      }
    }
    raw.normal = nm
  }
  return raw
}

/** Distance (in texture-space units 0..1 of one cell) to the nearest grid line, for tiles. */
export const gridDist = (t: number) => {
  const f = t - Math.floor(t)
  return Math.min(f, 1 - f)
}

