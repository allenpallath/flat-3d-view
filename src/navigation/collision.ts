// OWNER: Navigation agent (A3). Pure collision helpers (cm), no three.js / React.
import type { Plan, PlacedItem, Rect, Wall, Opening } from '../data/schema'
import { staticColliders, wallAxis } from '../data/geometry'

export const PLAYER_RADIUS = 20
/** items lower than this (rugs, mats) don't block walking */
export const MIN_BLOCKING_HEIGHT = 30
export const DOOR_KINDS = new Set<Opening['kind']>(['door', 'mainDoor', 'sliding'])

/** Rect covering an opening across the full wall thickness. */
export function openingRect(w: Wall, o: Opening): Rect {
  return wallAxis(w) === 'x'
    ? { x1: o.from, z1: w.rect.z1, x2: o.to, z2: w.rect.z2 }
    : { x1: w.rect.x1, z1: o.from, x2: w.rect.x2, z2: o.to }
}

/** All door-like openings of the plan with their wall. */
export function doorOpenings(plan: Plan): { wall: Wall; opening: Opening; rect: Rect; cx: number; cz: number }[] {
  const out: { wall: Wall; opening: Opening; rect: Rect; cx: number; cz: number }[] = []
  for (const wall of plan.walls)
    for (const opening of wall.openings ?? [])
      if (DOOR_KINDS.has(opening.kind)) {
        const rect = openingRect(wall, opening)
        out.push({ wall, opening, rect, cx: (rect.x1 + rect.x2) / 2, cz: (rect.z1 + rect.z2) / 2 })
      }
  return out
}

/** Axis-aligned bounding box (cm) of a rotated w×d footprint centred at (x,z), rot in degrees. */
export function rotatedFootprint(x: number, z: number, w: number, d: number, rotDeg: number): Rect {
  const a = (rotDeg * Math.PI) / 180
  const c = Math.abs(Math.cos(a))
  const s = Math.abs(Math.sin(a))
  const hw = (w * c + d * s) / 2
  const hd = (w * s + d * c) / 2
  return { x1: x - hw, z1: z - hd, x2: x + hw, z2: z + hd }
}

export type SizeLookup = (catalogId: string) => { w: number; d: number; h: number; y?: number } | undefined

/** Footprints of furniture that blocks walking. Items with unknown size are skipped. */
export function itemColliders(items: PlacedItem[], lookup?: SizeLookup): Rect[] {
  const out: Rect[] = []
  for (const it of items) {
    const cat = lookup?.(it.catalogId)
    const w = it.w ?? cat?.w
    const d = it.d ?? cat?.d
    const h = it.h ?? cat?.h
    if (w == null || d == null || !(w > 0) || !(d > 0)) continue
    if (h != null && h < MIN_BLOCKING_HEIGHT) continue
    const y = it.y ?? 0
    // wall-mounted things above head-ish / below knee don't block (e.g. TV at 100 cm still blocks)
    if (y >= 150) continue
    if (h != null && y + h <= 20) continue
    out.push(rotatedFootprint(it.x, it.z, w, d, it.rot ?? 0))
  }
  return out
}

/** Every rect a walker collides with. */
export function buildColliders(plan: Plan, doorsOpen: Record<string, boolean>, items: PlacedItem[], lookup?: SizeLookup): Rect[] {
  const rects = staticColliders(plan)
  for (const d of doorOpenings(plan)) if (!(doorsOpen[d.opening.id] ?? true)) rects.push(d.rect)
  rects.push(...itemColliders(items, lookup))
  return rects
}

/** True if a circle at (x,z) of radius r overlaps any rect. */
export function collides(x: number, z: number, r: number, rects: Rect[]): boolean {
  for (const b of rects) {
    const cx = Math.max(b.x1, Math.min(x, b.x2))
    const cz = Math.max(b.z1, Math.min(z, b.z2))
    const dx = x - cx
    const dz = z - cz
    if (dx * dx + dz * dz < r * r - 1e-6) return true
  }
  return false
}

/** Push a circle out of all overlapping rects (iterative minimum-translation). */
export function pushOut(x: number, z: number, r: number, rects: Rect[], iterations = 6): { x: number; z: number } {
  for (let it = 0; it < iterations; it++) {
    let moved = false
    for (const b of rects) {
      const cx = Math.max(b.x1, Math.min(x, b.x2))
      const cz = Math.max(b.z1, Math.min(z, b.z2))
      const dx = x - cx
      const dz = z - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= r * r) continue
      const d = Math.sqrt(d2)
      if (d > 1e-6) {
        x += (dx / d) * (r - d)
        z += (dz / d) * (r - d)
      } else {
        // centre inside the rect: leave through the nearest edge
        const opts = [
          { p: x - b.x1 + r, ax: -1, az: 0 },
          { p: b.x2 - x + r, ax: 1, az: 0 },
          { p: z - b.z1 + r, ax: 0, az: -1 },
          { p: b.z2 - z + r, ax: 0, az: 1 },
        ].sort((a, b2) => a.p - b2.p)[0]
        x += opts.ax * opts.p
        z += opts.az * opts.p
      }
      moved = true
    }
    if (!moved) break
  }
  return { x, z }
}

/**
 * Move a circle from (x,z) by (dx,dz) against rects, sliding along walls.
 * Sub-steps so fast moves can't tunnel through thin walls; resolves per axis.
 */
export function moveCircle(x: number, z: number, dx: number, dz: number, r: number, rects: Rect[]): { x: number; z: number } {
  if (collides(x, z, r, rects)) ({ x, z } = pushOut(x, z, r, rects))
  const len = Math.hypot(dx, dz)
  const steps = Math.max(1, Math.ceil(len / 4))
  const sx = dx / steps
  const sz = dz / steps
  // advance along one axis as far as possible (bisection when blocked)
  const axisStep = (px: number, pz: number, ax: number, az: number) => {
    if (!collides(px + ax, pz + az, r, rects)) return { x: px + ax, z: pz + az }
    let lo = 0
    let hi = 1
    for (let k = 0; k < 6; k++) {
      const m = (lo + hi) / 2
      if (collides(px + ax * m, pz + az * m, r, rects)) hi = m
      else lo = m
    }
    return { x: px + ax * lo, z: pz + az * lo }
  }
  for (let i = 0; i < steps; i++) {
    if (sx !== 0) ({ x, z } = axisStep(x, z, sx, 0))
    if (sz !== 0) ({ x, z } = axisStep(x, z, 0, sz))
  }
  return { x, z }
}

/** Nearest free spot to (x,z): push out, else spiral search up to maxR cm. */
export function findFreeSpot(x: number, z: number, r: number, rects: Rect[], maxR = 300): { x: number; z: number } {
  if (!collides(x, z, r, rects)) return { x, z }
  const p = pushOut(x, z, r, rects, 10)
  if (!collides(p.x, p.z, r, rects) && Math.hypot(p.x - x, p.z - z) < 80) return p
  for (let rad = 10; rad <= maxR; rad += 10) {
    const n = Math.max(8, Math.round((2 * Math.PI * rad) / 15))
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const qx = x + Math.cos(a) * rad
      const qz = z + Math.sin(a) * rad
      if (!collides(qx, qz, r, rects)) return { x: qx, z: qz }
    }
  }
  return p
}

/** Nearest door-like opening within maxDist cm of (x,z). */
export function nearestDoor(plan: Plan, x: number, z: number, maxDist = 130): string | undefined {
  let best: string | undefined
  let bestD = maxDist
  for (const d of doorOpenings(plan)) {
    // distance to the opening rect (not just its centre) so wide sliders work too
    const cx = Math.max(d.rect.x1, Math.min(x, d.rect.x2))
    const cz = Math.max(d.rect.z1, Math.min(z, d.rect.z2))
    const dist = Math.hypot(x - cx, z - cz)
    if (dist <= bestD) {
      bestD = dist
      best = d.opening.id
    }
  }
  return best
}
