// Walls (with holes for openings), parapets, glass railings, glass walls, skirting and toilet wall
// tiling. One mesh (per opaque/transparent) per wall, tagged {kind:'wall', wallId}.
import { useMemo } from 'react'
import planC from '../data/planC'
import { wallAxis, wallBoxes } from '../data/geometry'
import type { Box, Opening, Room, Wall } from '../data/schema'
import { getMaterials } from '../materials/materials'
import type { GeoBuilder } from './builder'
import { BMesh, useBuilt, useCut, wallFrame } from './common'

const SKIRT_H = 8 // skirting height, cm
const SKIRT_T = 1 // skirting thickness, cm
const TILE_H = 210 // toilet wall tiling height, cm
const TILE_T = 1 // tile thickness, cm
const TOL = 1.5 // cm: a room side within this of a wall face lies on it

interface FaceStrip {
  wall: Wall
  room: Room
  /** strip rect (cm) of thickness `t` inside the room along the wall face */
  rect: { x1: number; z1: number; x2: number; z2: number }
  /** openings of the wall that cut through this strip */
  openings: Opening[]
}

/** For every room side that lies on a wall face, a thin strip just inside the room. */
function faceStrips(t: number, roomFilter: (r: Room) => boolean): FaceStrip[] {
  const out: FaceStrip[] = []
  for (const r of planC.rooms.filter(roomFilter)) {
    const R = r.rect
    for (const w of planC.walls) {
      if (w.kind === 'railing' || w.kind === 'glass') continue
      const W = w.rect
      const axis = wallAxis(w)
      // north side of the room touches wall's south face, etc.
      const cands: { hit: boolean; along: 'x' | 'z'; rect: (a: number, b: number) => FaceStrip['rect'] }[] = [
        { hit: Math.abs(W.z2 - R.z1) <= TOL, along: 'x', rect: (a, b) => ({ x1: a, x2: b, z1: W.z2, z2: W.z2 + t }) },
        { hit: Math.abs(W.z1 - R.z2) <= TOL, along: 'x', rect: (a, b) => ({ x1: a, x2: b, z1: W.z1 - t, z2: W.z1 }) },
        { hit: Math.abs(W.x2 - R.x1) <= TOL, along: 'z', rect: (a, b) => ({ x1: W.x2, x2: W.x2 + t, z1: a, z2: b }) },
        { hit: Math.abs(W.x1 - R.x2) <= TOL, along: 'z', rect: (a, b) => ({ x1: W.x1 - t, x2: W.x1, z1: a, z2: b }) },
      ]
      for (const c of cands) {
        if (!c.hit) continue
        const a = Math.max(c.along === 'x' ? W.x1 : W.z1, c.along === 'x' ? R.x1 : R.z1)
        const b = Math.min(c.along === 'x' ? W.x2 : W.z2, c.along === 'x' ? R.x2 : R.z2)
        if (b - a < 2) continue
        const openings =
          axis === c.along
            ? (w.openings ?? [])
                .filter((o) => o.to > a && o.from < b)
                .map((o) => ({ ...o, from: Math.max(o.from, a), to: Math.min(o.to, b) }))
            : []
        out.push({ wall: w, room: r, rect: c.rect(a, b), openings })
      }
    }
  }
  return out
}

/** Solid pieces of a strip with holes for openings, clamped to `h`. */
function stripBoxes(s: FaceStrip, h: number): Box[] {
  const pseudo: Wall = { id: 'strip', kind: 'interior', height: h, rect: s.rect, openings: s.openings }
  // wallAxis picks the long axis; strips are always much longer than thick
  return wallBoxes(pseudo)
    .map((b) => ({ min: b.min, max: [b.max[0], Math.min(b.max[1], h), b.max[2]] as [number, number, number] }))
    .filter((b) => b.max[1] > b.min[1])
}

const isToilet = (r: Room) => r.floor === 'toiletTile'

/** Geometry of one wall by kind, plus the skirting / tile strips that sit on its faces. */
function buildWall(b: GeoBuilder, w: Wall, skirts: FaceStrip[], tiles: FaceStrip[]) {
  const m = getMaterials()
  const fr = wallFrame(w)
  const pieces = wallBoxes(w)
  const sRange = (p: Box) => (fr.axis === 'x' ? [p.min[0], p.max[0]] : [p.min[2], p.max[2]])

  if (w.kind === 'interior' || w.kind === 'exterior') {
    for (const p of pieces) b.b(p, (f) => (f === 'ny' ? null : f === 'py' ? m.exteriorWall : m.wallPaint))
  } else if (w.kind === 'parapet') {
    for (const p of pieces) {
      const [s0, s1] = sRange(p)
      b.b(fr.box(s0, s1, 0, w.height - 5, fr.t0, fr.t1), (f) => (f === 'ny' ? null : m.wallPaint))
      b.b(fr.box(s0 - 1.5, s1 + 1.5, w.height - 5, w.height, fr.t0 - 1.5, fr.t1 + 1.5), m.stoneTop)
    }
  } else if (w.kind === 'railing') {
    for (const p of pieces) {
      const [s0, s1] = sRange(p)
      const tc = fr.tc
      const hw = Math.min(4, fr.thick / 2)
      const top = w.height
      b.b(fr.box(s0, s1, 0, 9, tc - hw, tc + hw), m.blackMetal) // base shoe
      b.b(fr.box(s0 + 1, s1 - 1, 9, top - 7, tc - 0.6, tc + 0.6), m.glass) // glass infill
      b.b(fr.box(s0, s1, top - 7, top, tc - 2.5, tc + 2.5), m.blackMetal) // handrail
      const n = Math.max(1, Math.round((s1 - s0) / 120))
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n
        const a = Math.max(s0, Math.min(s1 - 4, s - 2))
        b.b(fr.box(a, a + 4, 9, top - 7, tc - 2, tc + 2), m.blackMetal) // posts
      }
    }
  } else if (w.kind === 'glass') {
    for (const p of pieces) {
      const [s0, s1] = sRange(p)
      const y0 = p.min[1]
      const y1 = p.max[1]
      if (s1 - s0 < 20 || y1 - y0 < 15) {
        b.b(p, (f) => (f === 'ny' ? null : m.blackMetal))
        continue
      }
      const F = 4
      const tc = fr.tc
      const d = Math.min(3.5, fr.thick / 2)
      b.b(fr.box(s0, s0 + F, y0, y1, tc - d, tc + d), m.blackMetal)
      b.b(fr.box(s1 - F, s1, y0, y1, tc - d, tc + d), m.blackMetal)
      b.b(fr.box(s0 + F, s1 - F, y0, y0 + F, tc - d, tc + d), m.blackMetal)
      b.b(fr.box(s0 + F, s1 - F, y1 - F, y1, tc - d, tc + d), m.blackMetal)
      b.b(fr.box(s0 + F, s1 - F, y0 + F, y1 - F, tc - 0.5, tc + 0.5), m.glass)
    }
  }

  for (const s of skirts) for (const p of stripBoxes(s, SKIRT_H)) b.b(p, (f) => (f === 'ny' ? null : m.skirting))
  for (const s of tiles) for (const p of stripBoxes(s, TILE_H)) b.b(p, (f) => (f === 'ny' ? null : m.toiletTile))
}

function WallMesh({ w, skirts, tiles, cut }: { w: Wall; skirts: FaceStrip[]; tiles: FaceStrip[]; cut: number }) {
  const built = useBuilt((b) => buildWall(b, w, skirts, tiles), cut, [w, skirts, tiles])
  return <BMesh built={built} tag={{ kind: 'wall', wallId: w.id }} />
}

/** Every wall of the plan. */
export default function Walls() {
  const cut = useCut()
  const { skirts, tiles } = useMemo(() => {
    const skirts = faceStrips(SKIRT_T, (r) => !r.outdoor && !isToilet(r))
    const tiles = faceStrips(TILE_T, isToilet)
    return { skirts, tiles }
  }, [])
  return (
    <group name="walls">
      {planC.walls.map((w) => (
        <WallMesh
          key={w.id}
          w={w}
          cut={cut}
          skirts={skirts.filter((s) => s.wall === w)}
          tiles={tiles.filter((s) => s.wall === w)}
        />
      ))}
    </group>
  )
}
