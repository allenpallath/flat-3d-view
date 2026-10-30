// Room floors (tagged {kind:'floor', roomId} for placement and culling), marble thresholds in every
// floor-level opening, and the base slab under the whole flat.
import { useMemo } from 'react'
import planC from '../data/planC'
import { planBounds, roomAt } from '../data/geometry'
import type { FloorMaterial, Rect } from '../data/schema'
import { getMaterials } from '../materials/materials'
import { BMesh, GAP_FILLS, useBuilt, wallFrame } from './common'

interface FloorPatch {
  key: string
  roomId: string
  rect: Rect
  mat: FloorMaterial | 'stoneTop'
  y: number
}

function floorPatches(): FloorPatch[] {
  const out: FloorPatch[] = planC.rooms.map((r) => ({ key: r.id, roomId: r.id, rect: r.rect, mat: r.floor, y: 0 }))
  GAP_FILLS.forEach((f, i) => out.push({ key: `fill${i}`, roomId: f.roomId, rect: f.rect, mat: 'hallTile', y: 0 }))
  // Marble thresholds in every floor-level opening.
  for (const w of planC.walls) {
    const fr = wallFrame(w)
    for (const o of w.openings ?? []) {
      if (o.sill > 0 || o.kind === 'window' || o.kind === 'ventilator') continue
      const b = fr.box(o.from, o.to, 0, 0, fr.t0, fr.t1)
      const rect = { x1: b.min[0], z1: b.min[2], x2: b.max[0], z2: b.max[2] }
      // the threshold belongs to the room 5 cm past either face of the wall (for culling)
      const s = (o.from + o.to) / 2
      const a = fr.pt(s, fr.t1 + 5)
      const c = fr.pt(s, fr.t0 - 5)
      const room = roomAt(planC, a.x, a.z) ?? roomAt(planC, c.x, c.z)
      out.push({ key: `th_${o.id}`, roomId: room?.id ?? 'hall', rect, mat: 'stoneTop', y: 0 })
    }
  }
  return out
}

function FloorPatchMesh({ p }: { p: FloorPatch }) {
  const mats = getMaterials()
  const built = useBuilt(
    (b) => b.box([p.rect.x1, p.y - 1, p.rect.z1], [p.rect.x2, p.y, p.rect.z2], (f) => (f === 'py' ? mats[p.mat] : null)),
    Infinity,
    [p],
  )
  return <BMesh built={built} tag={{ kind: 'floor', roomId: p.roomId }} />
}

/** All floor patches plus the slab. */
export default function Floors() {
  const patches = useMemo(floorPatches, [])
  const mats = getMaterials()
  const slab = useBuilt(
    (b) => {
      const pb = planBounds(planC)
      const fx = planC.fixtures.map((f) => f.rect)
      const x1 = Math.min(pb.x1, ...fx.map((r) => r.x1))
      const x2 = Math.max(pb.x2, ...fx.map((r) => r.x2))
      const z1 = Math.min(pb.z1, ...fx.map((r) => r.z1))
      const z2 = Math.max(pb.z2, ...fx.map((r) => r.z2))
      // top sits a hair below the finished floor so gaps under thresholds/walls never show the void
      b.box([x1, -18, z1], [x2, -0.4, z2], mats.exteriorWall)
    },
    Infinity,
    [],
  )
  return (
    <group name="floors">
      {patches.map((p) => (
        <FloorPatchMesh key={p.key} p={p} />
      ))}
      <BMesh built={slab} />
    </group>
  )
}
