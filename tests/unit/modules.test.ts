// Cross-module QA tests (A6) for pure helpers written by other agents.
import { describe, expect, it } from 'vitest'
import planC from '../../src/data/planC'
import { planBounds } from '../../src/data/geometry'
import type { ElectricalPoint, Rect } from '../../src/data/schema'
import { makeProject, parseProject, roomViewpoint } from '../../src/ui/format'
import {
  PLAYER_RADIUS, buildColliders, collides, doorOpenings, findFreeSpot, moveCircle, nearestDoor,
} from '../../src/navigation/collision'
import { CSV_COLUMNS, countByType, csvEscape, parsePointsJson, pointsToCsv } from '../../src/electrical/exportCsv'

const pt = (p: Partial<ElectricalPoint> & Pick<ElectricalPoint, 'id' | 'type'>): ElectricalPoint => ({
  x: 330, y: 30, z: 300, nx: -1, nz: 0, wallId: 'hallEast', roomId: 'hall', ...p,
})

/** Flood fill on a 5 cm grid from (sx,sz); returns a predicate telling whether a point is reachable. */
function reachable(rects: Rect[], sx: number, sz: number) {
  const STEP = 5
  const b = planBounds(planC)
  const x0 = b.x1 - 20
  const z0 = b.z1 - 20
  const nx = Math.ceil((b.x2 - b.x1 + 40) / STEP)
  const nz = Math.ceil((b.z2 - b.z1 + 40) / STEP)
  const seen = new Uint8Array(nx * nz)
  const toCell = (x: number, z: number) => [Math.round((x - x0) / STEP), Math.round((z - z0) / STEP)]
  const [ci, cj] = toCell(sx, sz)
  const q = [ci + cj * nx]
  seen[q[0]] = 1
  while (q.length) {
    const c = q.pop()!
    const i = c % nx
    const j = (c - i) / nx
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di
      const jj = j + dj
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue
      const k = ii + jj * nx
      if (seen[k]) continue
      const x = x0 + ii * STEP
      const z = z0 + jj * STEP
      if (x < b.x1 || x > b.x2 || z < b.z1 || z > b.z2) continue
      if (collides(x, z, PLAYER_RADIUS, rects)) continue
      seen[k] = 1
      q.push(k)
    }
  }
  return (r: Rect) => {
    for (let x = r.x1; x <= r.x2; x += STEP)
      for (let z = r.z1; z <= r.z2; z += STEP) {
        const [i, j] = toCell(x, z)
        if (seen[i + j * nx]) return true
      }
    return false
  }
}

describe('navigation collision (src/navigation/collision.ts)', () => {
  // main door closed so the flood fill stays inside the flat
  const open = buildColliders(planC, { mainDoor: false }, [])

  it('spawn point is free', () => {
    expect(collides(planC.spawn.x, planC.spawn.z, PLAYER_RADIUS, open)).toBe(false)
  })

  it('every room except the wash niche is reachable from spawn with doors open', () => {
    const can = reachable(open, planC.spawn.x, planC.spawn.z)
    const unreachable = planC.rooms.filter((r) => r.id !== 'washNiche' && !can(r.rect)).map((r) => r.id)
    expect(unreachable).toEqual([])
  })

  it('closing the master door seals the master suite off from the hall', () => {
    const closed = buildColliders(planC, { mainDoor: false, masterDoor: false }, [])
    const can = reachable(closed, planC.spawn.x, planC.spawn.z)
    const master = planC.rooms.find((r) => r.id === 'master')!
    const bedroom = planC.rooms.find((r) => r.id === 'bedroom')!
    expect(can(master.rect)).toBe(false)
    expect(can(bedroom.rect)).toBe(true)
  })

  it('cannot walk through the TV wall but can walk through the master door', () => {
    // hall -> east through solid wall at z=300
    const blocked = moveCircle(250, 300, 200, 0, PLAYER_RADIUS, open)
    expect(blocked.x).toBeLessThanOrEqual(330 - PLAYER_RADIUS + 0.5)
    // hall -> master through masterDoor (z 375..465)
    const through = moveCircle(250, 420, 200, 0, PLAYER_RADIUS, open)
    expect(through.x).toBeGreaterThan(400)
  })

  it('large single moves do not tunnel through walls', () => {
    const p = moveCircle(165, 300, 5000, 0, PLAYER_RADIUS, open)
    expect(p.x).toBeLessThan(330)
  })

  it('every e2e room viewpoint is free or has a free spot nearby', () => {
    for (const r of planC.rooms) {
      const v = roomViewpoint(r.rect)
      const f = findFreeSpot(v.x, v.z, PLAYER_RADIUS, open, 150)
      expect(collides(f.x, f.z, PLAYER_RADIUS, open), r.id).toBe(false)
    }
  })

  it('finds the nearest door', () => {
    const doors = doorOpenings(planC).map((d) => d.opening.id)
    expect(doors).toContain('masterDoor')
    expect(nearestDoor(planC, 300, 420)).toBe('masterDoor')
    expect(nearestDoor(planC, 165, 300)).toBeUndefined()
  })
})

describe('electrical export (src/electrical/exportCsv.ts)', () => {
  const points = [pt({ id: 'a', type: 'socket6A' }), pt({ id: 'b', type: 'tvPoint', y: 110, note: 'TV, "main"' }), pt({ id: 'c', type: 'socket6A', z: 250 })]

  it('escapes CSV fields', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape(undefined)).toBe('')
    expect(csvEscape(12.5)).toBe('12.5')
  })

  it('writes a header plus one row per point', () => {
    const csv = pointsToCsv(points, planC)
    const lines = csv.trim().split(/\r\n/)
    expect(lines[0]).toBe(CSV_COLUMNS.join(','))
    expect(lines).toHaveLength(points.length + 1)
    expect(csv).toContain('"TV, ""main"""')
  })

  it('counts by type', () => {
    expect(countByType(points)).toEqual({ socket6A: 2, tvPoint: 1 })
  })

  it('reads points back from a Toolbar project file (shared Save/Load format)', () => {
    const file = JSON.stringify(makeProject([], points))
    const back = parsePointsJson(file)
    expect(back.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    // and the toolbar's own parser accepts the same file
    expect(parseProject(file).points).toHaveLength(3)
  })
})
