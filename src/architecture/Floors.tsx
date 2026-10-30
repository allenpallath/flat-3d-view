// OWNER: Architecture agent (A1). Room floors, door thresholds and the base slab.
import { useMemo } from 'react'
import planC from '../data/planC'
import { planBounds, roomAt } from '../data/geometry'
import type { FloorMaterial, Rect } from '../data/schema'
import { getMaterials } from '../materials/materials'
import { BMesh, useBuilt, wallFrame } from './common'

interface FloorPatch {
  key: string
  roomId: string
  rect: Rect
  mat: FloorMaterial | 'stoneTop'
  y: number
}

/** Floor areas not covered by any room rect (open gap between hall and kitchen etc.). */
const FILLS: { roomId: string; rect: Rect }[] = [{ roomId: 'hall', rect: { x1: 76, z1: 622, x2: 330, z2: 634 } }]

function floorPatches(): FloorPatch[] {
  const out: FloorPatch[] = planC.rooms.map((r) => ({ key: r.id, roomId: r.id, rect: r.rect, mat: r.floor, y: 0 }))
  FILLS.forEach((f, i) => out.push({ key: `fill${i}`, roomId: f.roomId, rect: f.rect, mat: 'hallTile', y: 0 }))
  // Marble thresholds in every floor-level opening.
  for (const w of planC.walls) {
    const fr = wallFrame(w)
    for (const o of w.openings ?? []) {
      if (o.sill > 0 || o.kind === 'window' || o.kind === 'ventilator') continue
      const b = fr.box(o.from, o.to, 0, 0, fr.t0, fr.t1)
      const rect = { x1: b.min[0], z1: b.min[2], x2: b.max[0], z2: b.max[2] }
      const mid = fr.pt((o.from + o.to) / 2, fr.t1 + 5)
      const room = roomAt(planC, mid.x, mid.z) ?? roomAt(planC, fr.pt((o.from + o.to) / 2, fr.t0 - 5).x, fr.pt((o.from + o.to) / 2, fr.t0 - 5).z)
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
