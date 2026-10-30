// Pure plan geometry (cm, no three.js / React): wall pieces with holes, colliders, room lookup and the
// small rect / angle helpers shared by architecture, navigation, planner and electrical code.
import type { Box, Fixture, Opening, Plan, Rect, Wall } from './schema'

/** Width (x extent) of a rect. */
export const rectW = (r: Rect) => r.x2 - r.x1
/** Depth (z extent) of a rect. */
export const rectD = (r: Rect) => r.z2 - r.z1
/** Centre point of a rect. */
export const rectCenter = (r: Rect) => ({ x: (r.x1 + r.x2) / 2, z: (r.z1 + r.z2) / 2 })
/** True if two rects overlap with positive area (touching edges do not count). */
export const rectsOverlap = (a: Rect, b: Rect) => a.x1 < b.x2 && a.x2 > b.x1 && a.z1 < b.z2 && a.z2 > b.z1

/** Wrap an angle in degrees into (-180, 180]. */
export function wrapDeg(d: number) {
  const r = ((d % 360) + 360) % 360
  return r > 180 ? r - 360 : r
}

/** Long axis of a wall: 'x' if it runs east-west, 'z' if it runs north-south. */
export const wallAxis = (w: Wall): 'x' | 'z' => (rectW(w.rect) >= rectD(w.rect) ? 'x' : 'z')

/**
 * Split a wall into solid boxes (cm) leaving holes for its openings:
 * solid runs between openings, plus a sill piece below and a lintel above each opening.
 */
export function wallBoxes(w: Wall): Box[] {
  const { x1, z1, x2, z2 } = w.rect
  const axis = wallAxis(w)
  const start = axis === 'x' ? x1 : z1
  const end = axis === 'x' ? x2 : z2
  const piece = (a: number, b: number, y0: number, y1: number): Box =>
    axis === 'x'
      ? { min: [a, y0, z1], max: [b, y1, z2] }
      : { min: [x1, y0, a], max: [x2, y1, b] }

  const ops = [...(w.openings ?? [])].sort((a, b) => a.from - b.from)
  const boxes: Box[] = []
  let cursor = start
  for (const o of ops) {
    if (o.from > cursor) boxes.push(piece(cursor, o.from, 0, w.height))
    if (o.sill > 0) boxes.push(piece(o.from, o.to, 0, o.sill))
    if (o.head < w.height) boxes.push(piece(o.from, o.to, o.head, w.height))
    cursor = Math.max(cursor, o.to)
  }
  if (cursor < end) boxes.push(piece(cursor, end, 0, w.height))
  return boxes.filter((b) => b.max[0] > b.min[0] && b.max[1] > b.min[1] && b.max[2] > b.min[2])
}

/** Opening kinds you walk through (and that can be opened / closed). */
export const DOOR_KINDS: ReadonlySet<Opening['kind']> = new Set<Opening['kind']>(['door', 'mainDoor', 'sliding'])

/** Plan rect (cm) covering an opening across the full thickness of its wall. */
export function openingRect(w: Wall, o: Opening): Rect {
  return wallAxis(w) === 'x'
    ? { x1: o.from, z1: w.rect.z1, x2: o.to, z2: w.rect.z2 }
    : { x1: w.rect.x1, z1: o.from, x2: w.rect.x2, z2: o.to }
}

/** 3D box (cm) of a fixture, from its plan rect, base elevation and height. */
export function fixtureBox(f: Fixture): Box {
  const y = f.y ?? 0
  return { min: [f.rect.x1, y, f.rect.z1], max: [f.rect.x2, y + f.height, f.rect.z2] }
}

/**
 * Fixtures that occupy floor space. Drains are flush with the floor; hobs and sinks sit inside a
 * counter, which is already a fixture of its own.
 */
export const isSolidFixture = (f: Fixture) => f.type !== 'showerDrain' && f.type !== 'hob' && f.type !== 'sink'

/**
 * 2D collision rectangles (cm) for a walker: every wall piece or fixture that
 * blocks at knee/waist height (between 20 cm and 150 cm above floor).
 */
export function staticColliders(plan: Plan): Rect[] {
  const boxes: Box[] = [...plan.walls.flatMap(wallBoxes), ...plan.fixtures.filter(isSolidFixture).map(fixtureBox)]
  return boxes
    .filter((b) => b.min[1] < 150 && b.max[1] > 20)
    .map((b) => ({ x1: b.min[0], z1: b.min[2], x2: b.max[0], z2: b.max[2] }))
}

/** Overall bounds of the plan (cm). */
export function planBounds(plan: Plan): Rect {
  const rs = [...plan.walls.map((w) => w.rect), ...plan.rooms.map((r) => r.rect)]
  return {
    x1: Math.min(...rs.map((r) => r.x1)),
    z1: Math.min(...rs.map((r) => r.z1)),
    x2: Math.max(...rs.map((r) => r.x2)),
    z2: Math.max(...rs.map((r) => r.z2)),
  }
}

/** Room whose rect contains (x, z) cm, edges included; undefined inside walls and doorways. */
export function roomAt(plan: Plan, x: number, z: number) {
  return plan.rooms.find((r) => x >= r.rect.x1 && x <= r.rect.x2 && z >= r.rect.z1 && z <= r.rect.z2)
}

/** Parse "300X300" -> { w: 300, l: 300 } */
export function parseLabel(label?: string) {
  if (!label) return undefined
  const m = /^(\d+)\s*[xX]\s*(\d+)$/.exec(label.trim())
  return m ? { w: Number(m[1]), l: Number(m[2]) } : undefined
}
