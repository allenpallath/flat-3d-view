// Electrical planner unit tests: suggested set, wall maths, CSV / JSON round trips, TV sizing.
import { describe, expect, it } from 'vitest'
import planC from '../../data/planC'
import type { ElectricalPoint } from '../../data/schema'
import { suggestedPoints } from '../suggested'
import { CSV_COLUMNS, csvEscape, parsePointsJson, pointsToCsv, pointsToJson } from '../exportCsv'
import { alongInfo, findWallFace, overlappingOpening, setLeftDistance, viewpointFor } from '../wallMath'
import { tvViewingRange } from '../presets'

const withIds = (ps: Omit<ElectricalPoint, 'id'>[]): ElectricalPoint[] => ps.map((p, i) => ({ ...p, id: `p${i}` }))

describe('suggested points', () => {
  const pts = suggestedPoints(planC)
  it('produces a reasonable starter set', () => {
    expect(pts.length).toBeGreaterThan(40)
  })
  it('every wall point sits on a real wall face and clear of openings', () => {
    for (const p of pts) {
      if (p.nx === 0 && p.nz === 0) {
        expect(p.y).toBe(planC.ceilingHeight)
        continue
      }
      expect(p.wallId, `${p.note}`).toBeTruthy()
      expect(overlappingOpening(planC, p), `${p.note}`).toBeUndefined()
    }
  })
  it('puts the hall TV point on the hall east (TV) wall face', () => {
    const tv = pts.find((p) => p.type === 'tvPoint' && p.roomId === 'hall')!
    expect(tv.x).toBe(330)
    expect(tv.nx).toBe(-1)
    expect(tv.wallId).toBe('hallEast')
    expect(tv.z).toBeGreaterThan(205)
    expect(tv.z).toBeLessThan(366)
  })
})

describe('wall math', () => {
  it('finds wall faces', () => {
    expect(findWallFace(planC, 330, 300, -1, 0)?.id).toBe('hallEast')
    expect(findWallFace(planC, 343, 300, 1, 0)?.id).toBe('hallEast')
    expect(findWallFace(planC, 400, 170, 0, 1)?.id).toBe('masterN')
  })
  it('measures from the left corner when facing the wall', () => {
    // Standing in the hall facing east: left = north (z=0)
    const p = { type: 'tvPoint' as const, x: 330, y: 120, z: 285, nx: -1, nz: 0, roomId: 'hall', wallId: 'hallEast' }
    const a = alongInfo(planC, p)!
    expect(a.left).toBe(285)
    expect(a.right).toBe(622 - 285)
    // Master north wall, facing north: left = west (x=343)
    const q = { type: 'socket6A' as const, x: 385, y: 60, z: 170, nx: 0, nz: 1, roomId: 'master' }
    expect(alongInfo(planC, q)!.left).toBe(42)
    expect(setLeftDistance(planC, q, 100)).toEqual({ x: 443, z: 170 })
    expect(setLeftDistance(planC, p, 100)).toEqual({ x: 330, z: 100 })
  })
  it('viewpoint faces the wall', () => {
    const v = viewpointFor(planC, { type: 'tvPoint', x: 330, y: 120, z: 285, nx: -1, nz: 0 })
    expect(v.yawDeg).toBe(-90) // looking east
    expect(v.x).toBe(170)
  })
  it('viewing range', () => {
    expect(tvViewingRange(55)).toEqual({ min: 168, max: 224 })
  })
})

describe('export / import', () => {
  const pts = withIds(suggestedPoints(planC))
  it('csv has header + one row per point', () => {
    const csv = pointsToCsv(pts, planC)
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe(CSV_COLUMNS.join(','))
    expect(lines.length).toBe(pts.length + 1)
    expect(csv).toContain('Hall (Living + Dining),TV point,East wall (hallEast),120,285,330,285,')
  })
  it('escapes', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape(5)).toBe('5')
  })
  it('json round-trips', () => {
    const back = parsePointsJson(pointsToJson(pts))
    expect(back).toEqual(pts)
    expect(parsePointsJson(JSON.stringify([{ type: 'nope', x: 1, y: 1, z: 1 }, { type: 'fanPoint', x: 1, y: 285, z: 1 }])).length).toBe(1)
    expect(() => parsePointsJson('{"a":1}')).toThrow()
  })
})
