// OWNER: Architecture agent (A1).
// Small geometry builder: accumulates axis-aligned boxes (given in cm) into one
// BufferGeometry per mesh, with one draw group per material and world-planar UVs
// in metres (UV 1 = 1 m), so tiled textures line up across pieces at real size.
import * as THREE from 'three'
import type { Box } from '../data/schema'

export type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'
export type FaceMat = THREE.Material | null | undefined
export type MatSpec = THREE.Material | ((f: Face) => FaceMat)

type V3 = [number, number, number]

interface Slot {
  p: number[]
  n: number[]
  uv: number[]
  idx: number[]
}

export interface Built {
  geometry: THREE.BufferGeometry
  materials: THREE.Material[]
}

const M = 0.01

export class GeoBuilder {
  private slots = new Map<THREE.Material, Slot>()
  /** y (cm) above which everything is cut away (plan mode) */
  constructor(public cut = Infinity) {}

  private slot(m: THREE.Material) {
    let s = this.slots.get(m)
    if (!s) {
      s = { p: [], n: [], uv: [], idx: [] }
      this.slots.set(m, s)
    }
    return s
  }

  /** Quad from 4 corners (metres) in cyclic order; winding fixed to face `normal`. */
  quad(m: THREE.Material, c: V3[], normal: V3) {
    const s = this.slot(m)
    const [a, b, d] = [c[0], c[1], c[2]]
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    const pts = cr[0] * normal[0] + cr[1] * normal[1] + cr[2] * normal[2] < 0 ? [c[0], c[3], c[2], c[1]] : c
    const base = s.p.length / 3
    const ax = Math.abs(normal[0]) > 0.5 ? 0 : Math.abs(normal[1]) > 0.5 ? 1 : 2
    for (const p of pts) {
      s.p.push(p[0], p[1], p[2])
      s.n.push(normal[0], normal[1], normal[2])
      if (ax === 0) s.uv.push(normal[0] > 0 ? -p[2] : p[2], p[1])
      else if (ax === 1) s.uv.push(p[0], normal[1] > 0 ? -p[2] : p[2])
      else s.uv.push(normal[2] > 0 ? p[0] : -p[0], p[1])
    }
    s.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  /** Axis-aligned box in cm. `mat` may be a function choosing (or skipping) each face. */
  box(min: V3 | number[], max: V3 | number[], mat: MatSpec) {
    let y0 = min[1]
    let y1 = Math.min(max[1], this.cut)
    if (y1 - y0 <= 0.001) return
    if (max[0] - min[0] <= 0.001 || max[2] - min[2] <= 0.001) return
    const [x0, x1, z0, z1] = [min[0] * M, max[0] * M, min[2] * M, max[2] * M]
    y0 *= M
    y1 *= M
    const pick = (f: Face): FaceMat => (typeof mat === 'function' ? mat(f) : mat)
    const faces: [Face, V3[], V3][] = [
      ['px', [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
      ['nx', [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0]],
      ['py', [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]],
      ['ny', [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]],
      ['pz', [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]],
      ['nz', [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]],
    ]
    for (const [f, c, n] of faces) {
      const m = pick(f)
      if (m) this.quad(m, c, n)
    }
  }

  b(box: Box, mat: MatSpec) {
    this.box(box.min, box.max, mat)
  }

  isEmpty() {
    return this.slots.size === 0
  }

  /** Build geometry. `which` filters slots: opaque (casts shadows) vs transparent. */
  build(which: 'all' | 'opaque' | 'transparent' = 'all'): Built | null {
    const entries = [...this.slots.entries()].filter(([m]) =>
      which === 'all' ? true : which === 'transparent' ? m.transparent : !m.transparent,
    )
    if (!entries.length) return null
    const p: number[] = []
    const n: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    const g = new THREE.BufferGeometry()
    const materials: THREE.Material[] = []
    entries.forEach(([m, s], i) => {
      const base = p.length / 3
      const start = idx.length
      p.push(...s.p)
      n.push(...s.n)
      uv.push(...s.uv)
      for (const k of s.idx) idx.push(k + base)
      g.addGroup(start, s.idx.length, i)
      materials.push(m)
    })
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return { geometry: g, materials }
  }
}

/** Box helper from per-axis ranges (cm). */
export const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({
  min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)],
  max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
})
