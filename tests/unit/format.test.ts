import { describe, expect, it } from 'vitest'
import planC from '../../src/data/planC'
import { roomAt } from '../../src/data/geometry'
import {
  axisLock, cmToPlanPx, dist3, distCmFromMetres, formatCm, formatDistance, formatFtIn, makeProject, parseProject,
  planImageExtentCm, roomViewpoint, roundVec, snapToNearest,
} from '../../src/ui/format'

describe('measure distance + formatting', () => {
  it('computes 3D distance', () => {
    expect(dist3([0, 0, 0], [3, 4, 0])).toBe(5)
    expect(dist3([1, 2, 3], [1, 2, 3])).toBe(0)
  })
  it('converts metres to cm', () => {
    expect(distCmFromMetres([0, 0, 0], [3.3, 0, 0])).toBeCloseTo(330, 6)
    expect(distCmFromMetres([0, 0, 0], [0, 0, 6.22])).toBeCloseTo(622, 6)
  })
  it('formats cm', () => {
    expect(formatCm(330)).toBe('330 cm')
    expect(formatCm(329.6)).toBe('330 cm')
    expect(formatCm(4.26)).toBe('4.3 cm')
    expect(formatCm(NaN)).toBe('—')
  })
  it('formats feet and inches', () => {
    expect(formatFtIn(30.48)).toBe(`1' 0"`)
    expect(formatFtIn(300)).toBe(`9' 10"`) // 118.1 in
    expect(formatFtIn(622)).toBe(`20' 5"`) // 244.9 in
    expect(formatFtIn(17.78)).toBe(`7"`)
    expect(formatFtIn(-30.48)).toBe(`-1' 0"`)
    // rounding to 12 inches carries into feet
    expect(formatFtIn(60.8)).toBe(`2' 0"`)
  })
  it('formatDistance returns both units', () => {
    expect(formatDistance(150)).toEqual({ cm: '150 cm', ftIn: `4' 11"` })
  })
})

describe('measure snapping helpers', () => {
  it('locks to the dominant axis', () => {
    expect(axisLock([0, 0, 0], [2, 0.3, -0.5])).toEqual({ point: [2, 0, 0], axis: 'x' })
    expect(axisLock([1, 1, 1], [1.1, 3, 1.2])).toEqual({ point: [1, 3, 1], axis: 'y' })
    expect(axisLock([0, 0, 0], [0.1, 0, -4])).toEqual({ point: [0, 0, -4], axis: 'z' })
  })
  it('snaps to the nearest candidate inside the radius', () => {
    const c: [number, number, number][] = [[0, 0, 0], [1, 0, 0]]
    expect(snapToNearest([0.98, 0, 0.01], c, 0.05)).toEqual([1, 0, 0])
    expect(snapToNearest([0.5, 0, 0], c, 0.05)).toBeNull()
  })
  it('rounds to a grid', () => {
    const r = roundVec([0.1234, 1.006, -0.004], 0.01)
    expect(r[0]).toBeCloseTo(0.12)
    expect(r[1]).toBeCloseTo(1.01)
    expect(r[2]).toBeCloseTo(0)
  })
})

describe('plan overlay mapping', () => {
  it('spans the 1600x1200 drawing at 1.12 px/cm', () => {
    const e = planImageExtentCm()
    expect(e.x1).toBeCloseTo(-300 / 1.12)
    expect(e.x2).toBeCloseTo(1300 / 1.12)
    expect(e.z1).toBeCloseTo(-100 / 1.12)
    expect(e.z2).toBeCloseTo(1100 / 1.12)
    expect((e.x2 - e.x1) * 1.12).toBeCloseTo(1600)
    expect((e.z2 - e.z1) * 1.12).toBeCloseTo(1200)
  })
  it('maps the plan origin and extents to drawing px', () => {
    expect(cmToPlanPx(0, 0)).toEqual({ px: 300, py: 100 })
    const e = planImageExtentCm()
    const br = cmToPlanPx(e.x2, e.z2)
    expect(br.px).toBeCloseTo(1600)
    expect(br.py).toBeCloseTo(1200)
  })
  it('the whole apartment lies inside the drawing', () => {
    const e = planImageExtentCm()
    for (const w of planC.walls) {
      expect(w.rect.x1).toBeGreaterThanOrEqual(e.x1)
      expect(w.rect.x2).toBeLessThanOrEqual(e.x2)
      expect(w.rect.z1).toBeGreaterThanOrEqual(e.z1)
      expect(w.rect.z2).toBeLessThanOrEqual(e.z2)
    }
  })
})

describe('project save/load', () => {
  const item = { id: 'item_1', catalogId: 'sofa3', x: 100, z: 200, y: 0, rot: 90 }
  const point = { id: 'pt_1', type: 'socket6A', x: 0, y: 30, z: 100, nx: 1, nz: 0 }
  it('round-trips', () => {
    const json = JSON.stringify(makeProject([item], [point]))
    expect(parseProject(json)).toEqual({ items: [item], points: [point] })
  })
  it('tolerates missing arrays', () => {
    expect(parseProject('{"version":1}')).toEqual({ items: [], points: [] })
  })
  it('rejects bad input', () => {
    expect(() => parseProject('not json')).toThrow(/JSON/)
    expect(() => parseProject('{"items":[]}')).toThrow(/version/)
    expect(() => parseProject('{"version":99}')).toThrow(/newer/)
    expect(() => parseProject('{"version":1,"items":[{"id":1}]}')).toThrow(/furniture/)
    expect(() => parseProject('{"version":1,"points":[{"id":"p"}]}')).toThrow(/electrical/)
  })
})

describe('e2e room viewpoints', () => {
  it('every room viewpoint lies inside its own room', () => {
    for (const r of planC.rooms) {
      const v = roomViewpoint(r.rect)
      expect(roomAt(planC, v.x, v.z)?.id, r.id).toBeDefined()
      expect(v.x).toBeGreaterThanOrEqual(r.rect.x1)
      expect(v.x).toBeLessThanOrEqual(r.rect.x2)
      expect(v.z).toBeGreaterThanOrEqual(r.rect.z1)
      expect(v.z).toBeLessThanOrEqual(r.rect.z2)
    }
  })
})
