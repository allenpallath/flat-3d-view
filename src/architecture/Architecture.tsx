// OWNER: Architecture agent (A1). Builds apartment type C from planC, to scale (cm -> m).
//   Floors   – room floors (UV 1 = 1 m), thresholds, base slab
//   Walls    – walls with holes, parapets, glass railings, glass walls, skirting, toilet tiling
//   Openings – hinged doors (animated, click to toggle), main door, sliding glass doors, windows, ventilators
//   Ceilings – per-room ceilings + hall false-ceiling cove (walk mode only)
//   Fixtures – kitchen, vanities, WCs, showers, planters
// In plan mode everything above 120 cm is cut away (see PLAN_CUT in common.tsx).
import Ceilings from './Ceilings'
import Fixtures from './Fixtures'
import Floors from './Floors'
import Openings from './Openings'
import Walls from './Walls'

export default function Architecture() {
  return (
    <group name="architecture">
      <Floors />
      <Walls />
      <Openings />
      <Ceilings />
      <Fixtures />
    </group>
  )
}
