// OWNER: Electrical Planner agent (A5).
// A sensible starter set of points for flat type C. Positions are computed from the
// room rects (each room rect side coincides with the interior face of its wall).
import type { ElectricalPoint, Plan, PointType } from '../data/schema'
import { findWallFace } from './wallMath'

type NewPoint = Omit<ElectricalPoint, 'id'>
type RoomSide = 'N' | 'S' | 'E' | 'W'

export function suggestedPoints(plan: Plan): NewPoint[] {
  const out: NewPoint[] = []
  const room = (id: string) => {
    const r = plan.rooms.find((r) => r.id === id)
    if (!r) throw new Error(`room ${id} missing`)
    return r
  }

  /** Point on the interior face of a room side. `along` = absolute x (N/S) or z (E/W). */
  const wall = (roomId: string, side: RoomSide, along: number, y: number, type: PointType, note?: string) => {
    const r = room(roomId).rect
    let x = 0
    let z = 0
    let nx = 0
    let nz = 0
    if (side === 'W') { x = r.x1; z = along; nx = 1 }
    if (side === 'E') { x = r.x2; z = along; nx = -1 }
    if (side === 'N') { z = r.z1; x = along; nz = 1 }
    if (side === 'S') { z = r.z2; x = along; nz = -1 }
    const w = findWallFace(plan, x, z, nx, nz)
    out.push({ type, x, y, z, nx, nz, roomId, wallId: w?.id, ...(note ? { note } : {}) })
  }

  /** Ceiling point; x/z default to the room centre. */
  const ceil = (roomId: string, type: PointType, note?: string, x?: number, z?: number) => {
    const r = room(roomId).rect
    out.push({
      type,
      x: x ?? Math.round((r.x1 + r.x2) / 2),
      z: z ?? Math.round((r.z1 + r.z2) / 2),
      y: plan.ceilingHeight,
      nx: 0,
      nz: 0,
      roomId,
      ...(note ? { note } : {}),
    })
  }

  // ---------------- Hall (living + dining) ----------------
  wall('hall', 'W', 135, 120, 'switchboard', 'Main switchboard beside main door (latch side)')
  wall('hall', 'E', 285, 120, 'tvPoint', 'Wall-TV point: power + HDMI + coax behind the TV')
  wall('hall', 'E', 230, 60, 'socket6A', 'TV unit: set-top box')
  wall('hall', 'E', 340, 60, 'socket6A', 'TV unit: soundbar / console')
  wall('hall', 'E', 285, 60, 'dataPoint', 'TV unit: LAN for smart TV')
  wall('hall', 'W', 370, 30, 'socket6A', 'Sofa end: lamp / phone charger')
  wall('hall', 'N', 40, 30, 'socket6A', 'Sofa corner: floor lamp')
  wall('hall', 'W', 240, 220, 'acPoint', 'Living AC (above sofa)')
  ceil('hall', 'fanPoint', 'Living fan', 165, 185)
  ceil('hall', 'lightPoint', 'Living ceiling light', 165, 75)
  ceil('hall', 'fanPoint', 'Dining fan', 165, 496)
  ceil('hall', 'lightPoint', 'Dining pendant over table', 165, 560)
  wall('hall', 'W', 470, 120, 'switchboard', 'Dining switchboard')
  wall('hall', 'E', 605, 30, 'socket6A', 'Dining: general use')
  wall('washNiche', 'W', 560, 200, 'lightPoint', 'Mirror light over wash basin')

  // ---------------- Kitchen ----------------
  wall('kitchen', 'E', 790, 120, 'switchboard', 'Kitchen switchboard')
  wall('kitchen', 'S', 200, 30, 'socket16A', 'Fridge (behind, 30 cm)')
  wall('kitchen', 'W', 675, 110, 'socket16A', 'Hob: induction / auto-ignition')
  wall('kitchen', 'W', 700, 220, 'socket6A', 'Chimney (hidden by duct cover)')
  wall('kitchen', 'W', 645, 110, 'socket6A', 'Counter socket')
  wall('kitchen', 'W', 885, 110, 'socket6A', 'Counter socket: mixer')
  wall('kitchen', 'S', 75, 110, 'socket6A', 'Counter socket: RO / kettle')
  wall('kitchen', 'S', 160, 110, 'socket6A', 'Counter socket: toaster')
  wall('kitchen', 'S', 275, 110, 'socket16A', 'Microwave / OTG')
  ceil('kitchen', 'lightPoint', 'Kitchen ceiling light')

  // ---------------- Work area ----------------
  wall('workArea', 'S', 465, 110, 'socket16A', 'Washing machine')
  wall('workArea', 'S', 365, 120, 'switchboard', 'Work-area light switch')
  ceil('workArea', 'lightPoint', 'Work-area light')

  // ---------------- Balconies ----------------
  wall('balcony1', 'N', 418, 200, 'lightPoint', 'Balcony wall light')
  wall('balcony1', 'N', 470, 30, 'socket6A', 'Balcony socket (weather-proof)')
  wall('balcony2', 'S', 842, 200, 'lightPoint', 'Balcony wall light')
  wall('balcony3', 'N', 842, 200, 'lightPoint', 'Balcony wall light')

  // ---------------- Master bedroom (bed head on the north wall) ----------------
  wall('master', 'W', 360, 120, 'switchboard', 'Room switchboard beside door (latch side)')
  wall('master', 'N', 385, 60, 'socket6A', 'Bedside left')
  wall('master', 'N', 570, 60, 'socket6A', 'Bedside right')
  wall('master', 'N', 555, 60, 'usbSocket', 'Bedside USB charger')
  wall('master', 'N', 620, 90, 'socket6A', 'Study desk')
  wall('master', 'W', 260, 220, 'acPoint', 'Split AC')
  wall('master', 'S', 493, 120, 'tvPoint', 'Optional wall TV facing the bed')
  ceil('master', 'fanPoint', 'Bedroom fan')
  ceil('master', 'lightPoint', 'Bedroom light', 493, 410)
  ceil('dress1', 'lightPoint', 'Dress light')
  wall('dress1', 'S', 755, 120, 'switchboard', 'Toilet switches (outside toilet door)')

  // ---------------- Toilet (master) ----------------
  wall('toilet1', 'N', 860, 200, 'socket16A', 'Geyser (above shower)')
  wall('toilet1', 'E', 450, 215, 'socket6A', 'Exhaust fan (ventilator)')
  wall('toilet1', 'S', 687, 190, 'lightPoint', 'Mirror light over vanity')
  ceil('toilet1', 'lightPoint', 'Toilet ceiling light')

  // ---------------- Bedroom 2 (bed head on the north wall) ----------------
  wall('bedroom', 'W', 597, 120, 'switchboard', 'Room switchboard beside door (latch side)')
  wall('bedroom', 'N', 410, 60, 'socket6A', 'Bedside left')
  wall('bedroom', 'N', 608, 60, 'socket6A', 'Bedside right')
  wall('bedroom', 'S', 632, 90, 'socket6A', 'Study desk')
  wall('bedroom', 'W', 700, 220, 'acPoint', 'Split AC')
  ceil('bedroom', 'fanPoint', 'Bedroom fan')
  ceil('bedroom', 'lightPoint', 'Bedroom light', 493, 720)
  ceil('dress2', 'lightPoint', 'Dress light')
  wall('dress2', 'N', 755, 120, 'switchboard', 'Toilet switches (outside toilet door)')

  // ---------------- Toilet (bedroom 2) ----------------
  wall('toilet2', 'S', 860, 200, 'socket16A', 'Geyser (above shower)')
  wall('toilet2', 'E', 505, 215, 'socket6A', 'Exhaust fan (ventilator)')
  wall('toilet2', 'N', 687, 190, 'lightPoint', 'Mirror light over vanity')
  ceil('toilet2', 'lightPoint', 'Toilet ceiling light')

  return out
}
