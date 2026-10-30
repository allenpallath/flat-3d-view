// OWNER: Furniture Planner agent (A4). Pure geometry helpers (cm) for placement, overlap and wall distances.
import planC from '../data/planC'
import { fixtureBox, wallBoxes } from '../data/geometry'
import type { Box, PlacedItem } from '../data/schema'
import { footprintRects, getEntry, itemDims } from './catalog'

export interface WallBox extends Box {
  wallId: string
}

export const WALL_BOXES: WallBox[] = planC.walls.flatMap((w) => wallBoxes(w).map((b) => ({ ...b, wallId: w.id })))
const FIXTURE_BOXES: Box[] = planC.fixtures.filter((f) => f.type !== 'showerDrain' && f.type !== 'hob' && f.type !== 'sink').map(fixtureBox)
/** walls + fixtures (3D, cm) used for the overlap test */
export const STATIC_BOXES: Box[] = [...WALL_BOXES, ...FIXTURE_BOXES]

export const isFlat = (catalogId: string, h: number) => h <= 2 || getEntry(catalogId)?.model === 'rug'

type P2 = [number, number]

/** World-space footprint polygons (cm) of an item placed at (x,z) with yaw rot (deg). */
export function footprintPolys(catalogId: string, x: number, z: number, rot: number, w: number, d: number, shrink = 0): P2[][] {
  const a = (rot * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  // three.js rotation.y: local (lx, lz) -> world (lx*c + lz*s, -lx*s + lz*c)
  const tf = (lx: number, lz: number): P2 => [x + lx * c + lz * s, z - lx * s + lz * c]
  return footprintRects(catalogId, w, d).map((r) => {
    const x1 = r.x1 + shrink
    const x2 = r.x2 - shrink
    const z1 = r.z1 + shrink
    const z2 = r.z2 - shrink
    return [tf(x1, z1), tf(x2, z1), tf(x2, z2), tf(x1, z2)]
  })
}

export function polyBounds(polys: P2[][]) {
  let x1 = Infinity
  let z1 = Infinity
  let x2 = -Infinity
  let z2 = -Infinity
  for (const p of polys)
    for (const [x, z] of p) {
      x1 = Math.min(x1, x)
      x2 = Math.max(x2, x)
      z1 = Math.min(z1, z)
      z2 = Math.max(z2, z)
    }
  return { x1, z1, x2, z2 }
}

function project(poly: P2[], ax: number, az: number) {
  let mn = Infinity
  let mx = -Infinity
  for (const [x, z] of poly) {
    const v = x * ax + z * az
    mn = Math.min(mn, v)
    mx = Math.max(mx, v)
  }
  return [mn, mx]
}

/** Separating-axis test for two convex quads. */
export function polysOverlap(a: P2[], b: P2[]) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i]
      const [x2, z2] = poly[(i + 1) % poly.length]
      const ax = -(z2 - z1)
      const az = x2 - x1
      const [amin, amax] = project(a, ax, az)
      const [bmin, bmax] = project(b, ax, az)
      if (amax <= bmin || bmax <= amin) return false
    }
  }
  return true
}

const boxPoly = (b: Box): P2[] => [
  [b.min[0], b.min[2]],
  [b.max[0], b.min[2]],
  [b.max[0], b.max[2]],
  [b.min[0], b.max[2]],
]

export interface Pose {
  x: number
  z: number
  y: number
  rot: number
}

/** True if an item with this pose overlaps a wall/fixture or another (non-flat) item. */
export function collides(catalogId: string, pose: Pose, dims: { w: number; d: number; h: number }, items: PlacedItem[], selfId?: string) {
  if (isFlat(catalogId, dims.h)) return false
  const polys = footprintPolys(catalogId, pose.x, pose.z, pose.rot, dims.w, dims.d, 1)
  const y0 = pose.y + 0.5
  const y1 = pose.y + dims.h - 0.5
  const bb = polyBounds(polys)
  for (const b of STATIC_BOXES) {
    if (b.max[1] <= y0 || b.min[1] >= y1) continue
    if (b.max[0] <= bb.x1 || b.min[0] >= bb.x2 || b.max[2] <= bb.z1 || b.min[2] >= bb.z2) continue
    const bp = boxPoly(b)
    if (polys.some((p) => polysOverlap(p, bp))) return true
  }
  for (const it of items) {
    if (it.id === selfId) continue
    const dd = itemDims(it)
    if (isFlat(it.catalogId, dd.h)) continue
    if (it.y + dd.h <= y0 || it.y >= y1) continue
    const op = footprintPolys(it.catalogId, it.x, it.z, it.rot, dd.w, dd.d)
    if (polys.some((p) => op.some((q) => polysOverlap(p, q)))) return true
  }
  return false
}

// ------------------------------------------------------------------ rays (cm)
export interface RayHit {
  t: number
  x: number
  y: number
  z: number
  nx: number
  nz: number
  kind: 'floor' | 'wall'
}

/** Analytic ray cast against the plan's walls (capped at maxWallH) and the floor plane. o in cm, dir normalised. */
export function rayPlan(o: [number, number, number], dir: [number, number, number], maxWallH = 9999): RayHit | null {
  let best: RayHit | null = null
  for (const b of WALL_BOXES) {
    const mn = [b.min[0], b.min[1], b.min[2]]
    const mx = [b.max[0], Math.min(b.max[1], maxWallH), b.max[2]]
    if (mx[1] <= mn[1]) continue
    let t0 = -Infinity
    let t1 = Infinity
    let axis = -1
    let sign = 0
    let ok = true
    for (let i = 0; i < 3; i++) {
      if (Math.abs(dir[i]) < 1e-9) {
        if (o[i] < mn[i] || o[i] > mx[i]) {
          ok = false
          break
        }
        continue
      }
      let ta = (mn[i] - o[i]) / dir[i]
      let tb = (mx[i] - o[i]) / dir[i]
      if (ta > tb) [ta, tb] = [tb, ta]
      if (ta > t0) {
        t0 = ta
        axis = i
        // entering face normal points against the ray direction
        sign = dir[i] > 0 ? -1 : 1
      }
      t1 = Math.min(t1, tb)
      if (t0 > t1) {
        ok = false
        break
      }
    }
    if (!ok || t0 < 0 || axis < 0) continue
    if (!best || t0 < best.t) {
      best = {
        t: t0,
        x: o[0] + dir[0] * t0,
        y: o[1] + dir[1] * t0,
        z: o[2] + dir[2] * t0,
        nx: axis === 0 ? sign : 0,
        nz: axis === 2 ? sign : 0,
        kind: axis === 1 ? 'floor' : 'wall',
      }
    }
  }
  if (dir[1] < -1e-6) {
    const t = -o[1] / dir[1]
    if (t > 0 && (!best || t < best.t)) {
      const x = o[0] + dir[0] * t
      const z = o[2] + dir[2] * t
      if (x > -80 && x < 960 && z > -25 && z < 925) best = { t, x, y: 0, z, nx: 0, nz: 0, kind: 'floor' }
    }
  }
  return best
}

/** Nearest vertical wall face to (x,z) whose height range contains y (cm). */
export function nearestWallFace(x: number, z: number, y: number, maxDist = 80) {
  let best: { dist: number; px: number; pz: number; nx: number; nz: number } | null = null
  for (const b of WALL_BOXES) {
    if (y < b.min[1] || y > b.max[1]) continue
    const faces = [
      { dist: b.min[0] - x, px: b.min[0], pz: clamp(z, b.min[2], b.max[2]), nx: -1, nz: 0, along: z >= b.min[2] && z <= b.max[2] },
      { dist: x - b.max[0], px: b.max[0], pz: clamp(z, b.min[2], b.max[2]), nx: 1, nz: 0, along: z >= b.min[2] && z <= b.max[2] },
      { dist: b.min[2] - z, px: clamp(x, b.min[0], b.max[0]), pz: b.min[2], nx: 0, nz: -1, along: x >= b.min[0] && x <= b.max[0] },
      { dist: z - b.max[2], px: clamp(x, b.min[0], b.max[0]), pz: b.max[2], nx: 0, nz: 1, along: x >= b.min[0] && x <= b.max[0] },
    ]
    for (const f of faces) {
      if (!f.along || f.dist < -2 || f.dist > maxDist) continue
      if (!best || f.dist < best.dist) best = f
    }
  }
  return best
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Yaw (deg) that makes local +z point along the horizontal normal (nx, nz). */
export const yawFromNormal = (nx: number, nz: number) => Math.round((Math.atan2(nx, nz) * 180) / Math.PI)

export interface WallGap {
  dir: 'E' | 'W' | 'N' | 'S'
  dist: number
  /** segment from the item edge to the wall (cm) */
  a: [number, number]
  b: [number, number]
}

/** Clear distance (cm) from the item's rotated bounding box to the nearest wall on each side, measured along its centre lines. */
export function wallGaps(it: PlacedItem): WallGap[] {
  const dd = itemDims(it)
  const bb = polyBounds(footprintPolys(it.catalogId, it.x, it.z, it.rot, dd.w, dd.d))
  const cx = (bb.x1 + bb.x2) / 2
  const cz = (bb.z1 + bb.z2) / 2
  const py = Math.min(280, Math.max(1, it.y + dd.h / 2))
  const res: Record<string, WallGap> = {}
  const consider = (g: WallGap) => {
    if (g.dist < -0.5) return
    const cur = res[g.dir]
    if (!cur || g.dist < cur.dist) res[g.dir] = g
  }
  for (const b of WALL_BOXES) {
    if (py < b.min[1] || py > b.max[1]) continue
    if (cz >= b.min[2] && cz <= b.max[2]) {
      if (b.min[0] >= bb.x2 - 0.5) consider({ dir: 'E', dist: b.min[0] - bb.x2, a: [bb.x2, cz], b: [b.min[0], cz] })
      if (b.max[0] <= bb.x1 + 0.5) consider({ dir: 'W', dist: bb.x1 - b.max[0], a: [bb.x1, cz], b: [b.max[0], cz] })
    }
    if (cx >= b.min[0] && cx <= b.max[0]) {
      if (b.min[2] >= bb.z2 - 0.5) consider({ dir: 'S', dist: b.min[2] - bb.z2, a: [cx, bb.z2], b: [cx, b.min[2]] })
      if (b.max[2] <= bb.z1 + 0.5) consider({ dir: 'N', dist: bb.z1 - b.max[2], a: [cx, bb.z1], b: [cx, b.max[2]] })
    }
  }
  return Object.values(res).filter((g) => g.dist < 1500)
}
