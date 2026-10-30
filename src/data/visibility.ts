// Room-to-room visibility for culling: which rooms can see each other through doorways,
// open boundaries (open kitchen, dress areas) or windows. Pure functions, unit-tested.
import type { Box, Plan, Rect } from './schema'
import { DOOR_KINDS, fixtureBox, openingRect, roomAt, wallBoxes } from './geometry'

export interface RoomLink {
  a: string
  b: string
  /** door-like openings the link passes through; empty = always open (open plan, window, glass) */
  doors: string[]
}

/** Heights (cm) at which a gap must be clear to see through: door height and eye height. */
const SAMPLE_Y = [100, 150]
const MAX_GAP = 30 // cm: rooms further apart than a thick wall are not neighbours
const MIN_SHARED = 20 // cm of shared boundary needed

/** Strictly inside a box (0.5 cm margin on x/z so a sample on a shared face counts as clear). */
const inside = (b: Box, x: number, y: number, z: number) =>
  x > b.min[0] + 0.5 && x < b.max[0] - 0.5 && y > b.min[1] && y < b.max[1] && z > b.min[2] + 0.5 && z < b.max[2] - 0.5

/**
 * Every pair of rooms that can see each other, and which doors (if any) that depends on.
 * For each pair of rooms that face each other across at most one wall, sample the strip between
 * them every 5 cm. A sample is a gap if no wall piece / fixture covers it at door or eye height;
 * gaps inside a door opening make the link depend on that door, any other gap makes it always open.
 */
export function roomLinks(plan: Plan): RoomLink[] {
  // glass walls and railings don't block the view
  const solid = plan.walls.filter((w) => w.kind !== 'glass' && w.kind !== 'railing')
  const blockers: Box[] = [...solid.flatMap(wallBoxes), ...plan.fixtures.filter((f) => f.type !== 'showerGlass').map(fixtureBox)]
  const doorRects: { id: string; r: Rect }[] = plan.walls.flatMap((w) =>
    (w.openings ?? [])
      .filter((o) => DOOR_KINDS.has(o.kind))
      .map((o) => ({ id: o.id, r: openingRect(w, o) })),
  )
  const links: RoomLink[] = []
  const rooms = plan.rooms
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const A = rooms[i].rect
      const B = rooms[j].rect
      const gapX = Math.max(A.x1, B.x1) - Math.min(A.x2, B.x2)
      const gapZ = Math.max(A.z1, B.z1) - Math.min(A.z2, B.z2)
      const sharedZ = Math.min(A.z2, B.z2) - Math.max(A.z1, B.z1)
      const sharedX = Math.min(A.x2, B.x2) - Math.max(A.x1, B.x1)
      // side by side (east/west neighbours) or one above the other (north/south); sample the midline of the gap
      const samples: { x: number; z: number }[] = []
      if (gapX >= -1 && gapX <= MAX_GAP && sharedZ >= MIN_SHARED) {
        const x = A.x2 <= B.x1 + 1 ? (A.x2 + B.x1) / 2 : (B.x2 + A.x1) / 2
        for (let z = Math.max(A.z1, B.z1) + 2; z < Math.min(A.z2, B.z2) - 2; z += 5) samples.push({ x, z })
      } else if (gapZ >= -1 && gapZ <= MAX_GAP && sharedX >= MIN_SHARED) {
        const z = A.z2 <= B.z1 + 1 ? (A.z2 + B.z1) / 2 : (B.z2 + A.z1) / 2
        for (let x = Math.max(A.x1, B.x1) + 2; x < Math.min(A.x2, B.x2) - 2; x += 5) samples.push({ x, z })
      } else continue

      let always = false
      const doors = new Set<string>()
      for (const p of samples) {
        const clear = SAMPLE_Y.some((y) => !blockers.some((b) => inside(b, p.x, y, p.z)))
        if (!clear) continue
        const door = doorRects.find((d) => p.x >= d.r.x1 && p.x <= d.r.x2 && p.z >= d.r.z1 && p.z <= d.r.z2)
        if (door) doors.add(door.id)
        else always = true
      }
      if (always) links.push({ a: rooms[i].id, b: rooms[j].id, doors: [] })
      else if (doors.size) links.push({ a: rooms[i].id, b: rooms[j].id, doors: [...doors] })
    }
  }
  return links
}

/** Rooms the walker is in or touching (doorways and wall gaps belong to no room). */
export function roomsNear(plan: Plan, x: number, z: number, margin = 40): string[] {
  const r = roomAt(plan, x, z)
  if (r) return [r.id]
  return plan.rooms
    .filter((q) => x >= q.rect.x1 - margin && x <= q.rect.x2 + margin && z >= q.rect.z1 - margin && z <= q.rect.z2 + margin)
    .map((q) => q.id)
}

/**
 * Rooms that may be visible from `from`: breadth-first over links whose doors are open, up to
 * `depth` hops (2 = you can see into the next room and through it into the one beyond).
 */
export function visibleRooms(links: RoomLink[], from: string[], isOpen: (doorId: string) => boolean, depth = 2): Set<string> {
  const seen = new Set(from)
  let frontier = [...from]
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const l of links) {
        const other = l.a === id ? l.b : l.b === id ? l.a : null
        if (!other || seen.has(other)) continue
        if (l.doors.length && !l.doors.some(isOpen)) continue
        seen.add(other)
        next.push(other)
      }
    }
    frontier = next
  }
  return seen
}
