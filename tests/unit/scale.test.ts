import { describe, expect, it } from 'vitest'
import planC from '../../src/data/planC'
import { parseLabel, rectD, rectW, staticColliders, wallBoxes } from '../../src/data/geometry'

// Rooms whose printed size we reproduce exactly (cm). Dress areas are open to
// their bedrooms and are ~6 cm narrower than printed so the 114 cm balconies fit.
const EXACT = ['hall', 'kitchen', 'balcony1', 'master', 'balcony2', 'toilet1', 'toilet2', 'bedroom', 'balcony3', 'workArea']

describe('plan C is to scale', () => {
  for (const id of EXACT) {
    it(`${id} matches its printed size`, () => {
      const r = planC.rooms.find((x) => x.id === id)!
      const n = parseLabel(r.label)!
      expect(Math.abs(rectW(r.rect) - n.w)).toBeLessThanOrEqual(1)
      expect(Math.abs(rectD(r.rect) - n.l)).toBeLessThanOrEqual(1)
    })
  }

  it('dress areas are within 10 cm of printed size', () => {
    for (const id of ['dress1', 'dress2']) {
      const r = planC.rooms.find((x) => x.id === id)!
      const n = parseLabel(r.label)!
      expect(Math.abs(rectW(r.rect) - n.w)).toBeLessThanOrEqual(10)
      expect(Math.abs(rectD(r.rect) - n.l)).toBeLessThanOrEqual(10)
    }
  })

  it('no wall piece intrudes into a room', () => {
    const boxes = planC.walls.flatMap(wallBoxes)
    for (const r of planC.rooms) {
      for (const b of boxes) {
        const ox = Math.min(b.max[0], r.rect.x2) - Math.max(b.min[0], r.rect.x1)
        const oz = Math.min(b.max[2], r.rect.z2) - Math.max(b.min[2], r.rect.z1)
        expect(ox > 0.5 && oz > 0.5, `${r.id} overlaps wall box ${JSON.stringify(b)}`).toBe(false)
      }
    }
  })

  it('doors leave a walkable 200+ cm high gap', () => {
    for (const w of planC.walls) {
      for (const o of w.openings ?? []) {
        if (o.kind === 'door' || o.kind === 'mainDoor' || o.kind === 'sliding') {
          expect(o.sill).toBe(0)
          expect(o.head).toBeGreaterThanOrEqual(200)
          expect(o.to - o.from).toBeGreaterThanOrEqual(75)
        }
      }
    }
  })

  it('door openings are not blocked by colliders', () => {
    const cols = staticColliders(planC)
    for (const w of planC.walls) {
      for (const o of w.openings ?? []) {
        if (o.kind !== 'door' && o.kind !== 'sliding') continue
        const mid = (o.from + o.to) / 2
        const horiz = rectW(w.rect) >= rectD(w.rect)
        const x = horiz ? mid : (w.rect.x1 + w.rect.x2) / 2
        const z = horiz ? (w.rect.z1 + w.rect.z2) / 2 : mid
        const hit = cols.some((c) => x > c.x1 && x < c.x2 && z > c.z1 && z < c.z2)
        expect(hit, `opening ${o.id} blocked`).toBe(false)
      }
    }
  })
})
