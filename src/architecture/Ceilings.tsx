// Ceilings per room (+ gypsum false-ceiling border with an LED cove in the hall), tagged
// {kind:'ceiling', roomId}. Only mounted in walk mode with showCeilings on.
import planC from '../data/planC'
import type { Rect } from '../data/schema'
import { getMaterials } from '../materials/materials'
import { useStore } from '../store'
import { BMesh, GAP_FILLS, useBuilt } from './common'

/** Hall false ceiling: 55 cm wide gypsum border dropped 25 cm, with a cove lip along its inner edge. */
const COVE = { roomId: 'hall', band: 55, drop: 25 }

function CeilingPatch({ roomId, rect }: { roomId: string; rect: Rect }) {
  const H = planC.ceilingHeight
  const m = getMaterials()
  const built = useBuilt(
    (b) => {
      b.box([rect.x1, H, rect.z1], [rect.x2, H + 1, rect.z2], (f) => (f === 'ny' ? m.ceiling : null))
      if (roomId === COVE.roomId) {
        const { band, drop } = COVE
        const y0 = H - drop
        const R = rect
        const ring = (inset: number, ya: number, yb: number, t: number) => {
          b.box([R.x1 + inset, ya, R.z1 + inset], [R.x2 - inset, yb, R.z1 + inset + t], m.ceiling)
          b.box([R.x1 + inset, ya, R.z2 - inset - t], [R.x2 - inset, yb, R.z2 - inset], m.ceiling)
          b.box([R.x1 + inset, ya, R.z1 + inset], [R.x1 + inset + t, yb, R.z2 - inset], m.ceiling)
          b.box([R.x2 - inset - t, ya, R.z1 + inset], [R.x2 - inset, yb, R.z2 - inset], m.ceiling)
        }
        const slab = 10
        // border boards (12 cm gypsum + frame), then a recessed fascia up to the slab = LED cove slot
        ring(0, y0, y0 + slab, band)
        ring(band - 14, y0 + slab, H, 1.2)
        // lip on the inner edge of the board hides the LED strip
        ring(band - 1.2, y0 + slab, y0 + slab + 5, 1.2)
      }
    },
    Infinity,
    [roomId, rect],
  )
  return <BMesh built={built} tag={{ kind: 'ceiling', roomId }} />
}

/** Ceilings of every room (walk mode only). */
export default function Ceilings() {
  const visible = useStore((s) => s.mode === 'walk' && s.showCeilings)
  // unmounted (not just hidden) so raycasts from above never hit them
  if (!visible) return null
  return (
    <group name="ceilings">
      {planC.rooms.map((r) => (
        <CeilingPatch key={r.id} roomId={r.id} rect={r.rect} />
      ))}
      {GAP_FILLS.map((f, i) => (
        <CeilingPatch key={`fill${i}`} roomId={f.roomId} rect={f.rect} />
      ))}
    </group>
  )
}
