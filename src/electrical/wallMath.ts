// OWNER: Electrical Planner agent (A5). Pure helpers (no three / DOM) so they can be unit tested.
import type { ElectricalPoint, Opening, Plan, Rect, Room, Wall } from '../data/schema'
import { roomAt } from '../data/geometry'
import { PRESETS } from './presets'

type P = Pick<ElectricalPoint, 'x' | 'y' | 'z' | 'nx' | 'nz' | 'type'> & { roomId?: string; wallId?: string }

/** Ceiling points carry a zero horizontal normal. */
export const isCeilingPoint = (p: Pick<ElectricalPoint, 'nx' | 'nz'>) => p.nx === 0 && p.nz === 0

export type Side = 'north' | 'south' | 'east' | 'west'

/** Which wall of the room the point is on (normal +x → the wall is on the room's west side). */
export function wallSide(nx: number, nz: number): Side | null {
  if (nx === 0 && nz === 0) return null
  if (Math.abs(nx) >= Math.abs(nz)) return nx > 0 ? 'west' : 'east'
  return nz > 0 ? 'north' : 'south'
}

export const sideLabel = (s: Side | null) => (s ? s[0].toUpperCase() + s.slice(1) + ' wall' : 'Ceiling')

/** Room a point belongs to: probe 5 cm into the room along the normal. */
export function roomForPoint(plan: Plan, p: P): Room | undefined {
  if (p.roomId) {
    const r = plan.rooms.find((r) => r.id === p.roomId)
    if (r) return r
  }
  return roomAt(plan, p.x + p.nx * 5, p.z + p.nz * 5)
}

/** The wall whose face (side facing +normal) contains (x,z). Tolerance in cm. */
export function findWallFace(plan: Plan, x: number, z: number, nx: number, nz: number, tol = 1.5): Wall | undefined {
  const side = wallSide(nx, nz)
  if (!side) return undefined
  return plan.walls.find((w) => {
    const r = w.rect
    switch (side) {
      case 'west': // face at r.x2 looking +x
        return Math.abs(r.x2 - x) <= tol && z >= r.z1 - tol && z <= r.z2 + tol
      case 'east':
        return Math.abs(r.x1 - x) <= tol && z >= r.z1 - tol && z <= r.z2 + tol
      case 'north':
        return Math.abs(r.z2 - z) <= tol && x >= r.x1 - tol && x <= r.x2 + tol
      case 'south':
        return Math.abs(r.z1 - z) <= tol && x >= r.x1 - tol && x <= r.x2 + tol
    }
  })
}

/** Along-wall coordinate axis for a wall point. */
const alongAxis = (p: Pick<P, 'nx' | 'nz'>): 'x' | 'z' => (Math.abs(p.nx) >= Math.abs(p.nz) ? 'z' : 'x')

export interface AlongInfo {
  /** distance (cm) from the left / right corner as seen standing in the room facing the wall */
  left: number
  right: number
  nearest: { dist: number; side: 'left' | 'right' }
  /** corner positions (cm, x/z) */
  leftEnd: { x: number; z: number }
  rightEnd: { x: number; z: number }
}

/**
 * Span of the wall face inside the point's room: room rect span along the wall,
 * intersected with the wall rect when the wall is known.
 */
export function faceSpan(plan: Plan, p: P): [number, number] | null {
  const room = roomForPoint(plan, p)
  const axis = alongAxis(p)
  const wall = p.wallId ? plan.walls.find((w) => w.id === p.wallId) : findWallFace(plan, p.x, p.z, p.nx, p.nz)
  const span = (r: Rect): [number, number] => (axis === 'x' ? [r.x1, r.x2] : [r.z1, r.z2])
  let s: [number, number] | null = room ? span(room.rect) : wall ? span(wall.rect) : null
  if (s && wall && room) {
    const ws = span(wall.rect)
    const lo = Math.max(s[0], ws[0])
    const hi = Math.min(s[1], ws[1])
    if (hi > lo) s = [lo, hi]
  }
  return s
}

export function alongInfo(plan: Plan, p: P): AlongInfo | null {
  if (isCeilingPoint(p)) return null
  const s = faceSpan(plan, p)
  if (!s) return null
  const axis = alongAxis(p)
  const v = axis === 'x' ? p.x : p.z
  // left vector when facing the wall (looking along -n) is (-nz, nx)
  const lx = -p.nz
  const lz = p.nx
  const leftSign = axis === 'x' ? lx : lz // +1: left end is the high end of the span
  const lo = s[0]
  const hi = s[1]
  const leftV = leftSign > 0 ? hi : lo
  const rightV = leftSign > 0 ? lo : hi
  const left = Math.abs(v - leftV)
  const right = Math.abs(rightV - v)
  const at = (c: number) => (axis === 'x' ? { x: c, z: p.z } : { x: p.x, z: c })
  return {
    left,
    right,
    nearest: left <= right ? { dist: left, side: 'left' } : { dist: right, side: 'right' },
    leftEnd: at(leftV),
    rightEnd: at(rightV),
  }
}

/** Move a wall point so that it is `dist` cm from the left corner. */
export function setLeftDistance(plan: Plan, p: P, dist: number): { x: number; z: number } | null {
  const info = alongInfo(plan, p)
  if (!info) return null
  const axis = alongAxis(p)
  const lx = -p.nz
  const lz = p.nx
  const dir = -(axis === 'x' ? lx : lz) // from left end toward right end
  const start = axis === 'x' ? info.leftEnd.x : info.leftEnd.z
  const v = start + dir * dist
  return axis === 'x' ? { x: v, z: p.z } : { x: p.x, z: v }
}

/** Distances (cm) of a ceiling point to the room's walls. */
export function ceilingInfo(plan: Plan, p: P) {
  const room = roomForPoint(plan, p)
  if (!room) return null
  const r = room.rect
  return { west: p.x - r.x1, east: r.x2 - p.x, north: p.z - r.z1, south: r.z2 - p.z, room }
}

/** Opening on the point's wall that the plate overlaps (door, window...), if any. */
export function overlappingOpening(plan: Plan, p: P): Opening | undefined {
  if (isCeilingPoint(p)) return undefined
  const wall = p.wallId ? plan.walls.find((w) => w.id === p.wallId) : findWallFace(plan, p.x, p.z, p.nx, p.nz)
  if (!wall) return undefined
  const pre = PRESETS[p.type]
  const halfW = pre.plate.w / 2
  const halfH = pre.plate.h / 2
  const v = alongAxis(p) === 'x' ? p.x : p.z
  return (wall.openings ?? []).find(
    (o) => v + halfW > o.from && v - halfW < o.to && p.y + halfH > o.sill && p.y - halfH < o.head,
  )
}

/** Camera spot (cm + yaw) to look at a point from inside its room. */
export function viewpointFor(plan: Plan, p: P, standOff = 160, currentYaw = 0) {
  const room = roomForPoint(plan, p)
  let x = p.x
  let z = p.z
  let yawDeg = currentYaw
  if (!isCeilingPoint(p)) {
    x = p.x + p.nx * standOff
    z = p.z + p.nz * standOff
    yawDeg = (Math.atan2(p.nx, p.nz) * 180) / Math.PI
  }
  if (room) {
    const m = 35
    const r = room.rect
    const cx = (a: number, lo: number, hi: number) => (hi - lo > 2 * m ? Math.min(hi - m, Math.max(lo + m, a)) : (lo + hi) / 2)
    x = cx(x, r.x1, r.x2)
    z = cx(z, r.z1, r.z2)
  }
  return { x: Math.round(x), z: Math.round(z), yawDeg: Math.round(yawDeg) }
}

export const snap = (v: number, step: number) => Math.round(v / step) * step
