// The furniture shown on the developer's drawing (public/floorplan-c.webp), positioned to match it.
// Drawing px -> plan cm: x = (px - 300) / 1.12, z = (py - 100) / 1.12. rot: 0 = front faces south (+z),
// 90 = faces east, 180 = faces north, -90 = faces west.
import type { PlacedItem } from '../data/schema'
import { newId, useStore } from '../store'
import { getEntry } from './catalog'

type Seed = Omit<PlacedItem, 'id' | 'y'> & { y?: number }

export const DEFAULT_LAYOUT: Seed[] = [
  // ---- Living (hall north part) ----
  { catalogId: 'rug', x: 125, z: 240, rot: 0, d: 240 },
  { catalogId: 'lsofaR', x: 105, z: 240, rot: 90 }, // back on the west wall, chaise to the south
  { catalogId: 'coffeeRound', x: 172, z: 205, rot: 0 },
  { catalogId: 'pouf', x: 150, z: 128, rot: 0 },
  { catalogId: 'pouf', x: 212, z: 130, rot: 0, color: '#c96a4a' },
  { catalogId: 'divider', x: 95, z: 373, rot: 0 },
  { catalogId: 'plantSmall', x: 125, z: 373, y: 90, rot: 0 },
  { catalogId: 'tvUnit', x: 310, z: 285, rot: -90 },
  { catalogId: 'tv55', x: 327, z: 285, rot: -90 },

  // ---- Dining ----
  { catalogId: 'dining6', x: 160, z: 490, rot: 0 },
  { catalogId: 'diningChair', x: 115, z: 431, rot: 0 },
  { catalogId: 'diningChair', x: 205, z: 431, rot: 0 },
  { catalogId: 'diningChair', x: 115, z: 549, rot: 180 },
  { catalogId: 'diningChair', x: 205, z: 549, rot: 180 },
  { catalogId: 'diningChair', x: 56, z: 490, rot: 90 },
  { catalogId: 'diningChair', x: 264, z: 490, rot: -90 },
  { catalogId: 'barStool', x: 170, z: 600, rot: 0 },
  { catalogId: 'barStool', x: 220, z: 600, rot: 0 },

  // ---- Kitchen / work area ----
  { catalogId: 'fridgeDD', x: 200, z: 865, rot: 180 },
  { catalogId: 'washingMachine', x: 462, z: 869, rot: 180 },

  // ---- Master bedroom + dress ----
  { catalogId: 'bedQueen', x: 478, z: 270, rot: 0 },
  { catalogId: 'bedside', x: 380, z: 190, rot: 0 },
  { catalogId: 'dressingTable', x: 593, z: 193, rot: 0, w: 75 },
  { catalogId: 'diningChair', x: 593, z: 245, rot: 180 },
  { catalogId: 'wardrobe3', x: 708, z: 200, rot: 0, w: 125 },

  // ---- Bedroom 2 + dress ----
  { catalogId: 'bedQueen', x: 510, z: 582, rot: 0 },
  { catalogId: 'bedside', x: 410, z: 502, rot: 0 },
  { catalogId: 'bedside', x: 610, z: 502, rot: 0 },
  { catalogId: 'desk', x: 585, z: 754, rot: 180, w: 95, d: 55 },
  { catalogId: 'studyChair', x: 585, z: 708, rot: 0 },
  { catalogId: 'wardrobe3', x: 708, z: 752, rot: 180, w: 125 },

  // ---- Balcony off the hall ----
  { catalogId: 'cafeTable', x: 433, z: 95, rot: 0, color: '#2f6f6a' },
  { catalogId: 'balconyChair', x: 452, z: 48, rot: -25 },
  { catalogId: 'balconyChair', x: 386, z: 108, rot: 104 },
]

/** The drawing's layout as new placed items (fresh ids, default elevations). */
export function buildDefaultLayout(): PlacedItem[] {
  return DEFAULT_LAYOUT.map((s) => ({ ...s, y: s.y ?? getEntry(s.catalogId)?.y ?? 0, id: newId('item') }))
}

/** Replace all furniture with the drawing's layout. */
export function loadDefaultLayout() {
  useStore.getState().replaceAll({ items: buildDefaultLayout() })
}

const SEED_KEY = 'flat-c-seeded'

/** Seed the drawing's furniture once: only when the store has no items and we never seeded before. */
export function seedIfFirstRun() {
  let seeded = false
  try {
    seeded = localStorage.getItem(SEED_KEY) === '1'
  } catch {
    /* storage unavailable */
  }
  if (seeded) return
  if (useStore.getState().items.length === 0) loadDefaultLayout()
  try {
    localStorage.setItem(SEED_KEY, '1')
  } catch {
    /* ignore */
  }
}
