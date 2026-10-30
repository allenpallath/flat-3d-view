// Furniture catalog with real Indian-market sizes (cm). w = width (local x), d = depth (local z,
// front of the item faces local +z), h = height. Origin of every model = footprint centre at its bottom.
// Used by the planner (models, placement, panel) and by navigation (furniture colliders).
// Note: tests/e2e/memory.mjs scans this file for `id: '...'` literals, so keep entries written out.
import type { CatalogItem, PlacedItem } from '../data/schema'
import { TV_CENTRE_CM, TV_SIZES, tvPanelCm } from '../data/tv'

export type ModelKind =
  | 'sofa'
  | 'lsofa'
  | 'armchair'
  | 'roundTable'
  | 'centreTable'
  | 'pouf'
  | 'rug'
  | 'tvUnit'
  | 'tv'
  | 'divider'
  | 'diningTable'
  | 'diningChair'
  | 'balconyChair'
  | 'barStool'
  | 'bed'
  | 'bedside'
  | 'wardrobe'
  | 'dressingTable'
  | 'desk'
  | 'studyChair'
  | 'bookshelf'
  | 'shoeRack'
  | 'fridge'
  | 'washingMachine'
  | 'microwave'
  | 'dishwasher'
  | 'ac'
  | 'ceilingFan'
  | 'floorLamp'
  | 'plant'
  | 'mirror'

export interface CatalogEntry extends CatalogItem {
  model: ModelKind
  /** model variant, e.g. chaise side of an L-sofa */
  variant?: string
  /** TV diagonal in inches (TV entries only) */
  inches?: number
}

export { TV_SIZES }

/** 16:9 panel size (cm, rounded) for a diagonal in inches, incl. a ~1 cm bezel. */
export function tvSize(inches: number) {
  const p = tvPanelCm(inches)
  return { w: Math.round(p.w), h: Math.round(p.h) }
}

const tvs: CatalogEntry[] = TV_SIZES.map((inches) => {
  const { w, h } = tvSize(inches)
  return {
    id: `tv${inches}`,
    name: `Wall TV ${inches}"`,
    category: 'living',
    model: 'tv',
    inches,
    w,
    d: 6,
    h,
    y: Math.round(TV_CENTRE_CM - h / 2),
    color: '#111214',
    wallMounted: true,
  }
})

export const CATALOG: CatalogEntry[] = [
  // ---------- Living ----------
  { id: 'sofa3', name: '3-seater sofa', category: 'living', model: 'sofa', w: 210, d: 90, h: 85, color: '#2f5370' },
  { id: 'sofa2', name: '2-seater sofa', category: 'living', model: 'sofa', w: 150, d: 88, h: 85, color: '#2f5370' },
  { id: 'lsofaR', name: 'L-shaped sofa (chaise right)', category: 'living', model: 'lsofa', variant: 'right', w: 240, d: 160, h: 85, color: '#2f5370' },
  { id: 'lsofaL', name: 'L-shaped sofa (chaise left)', category: 'living', model: 'lsofa', variant: 'left', w: 240, d: 160, h: 85, color: '#2f5370' },
  { id: 'armchair', name: 'Armchair', category: 'living', model: 'armchair', w: 80, d: 82, h: 85, color: '#2f5370' },
  { id: 'coffeeRound', name: 'Round coffee table Ø60', category: 'living', model: 'roundTable', w: 60, d: 60, h: 42, color: '#6b4a32' },
  { id: 'centreTable', name: 'Centre table', category: 'living', model: 'centreTable', w: 110, d: 60, h: 42, color: '#6b4a32' },
  { id: 'sideTable', name: 'Side table Ø45', category: 'living', model: 'roundTable', w: 45, d: 45, h: 55, color: '#6b4a32' },
  { id: 'pouf', name: 'Pouf Ø45', category: 'living', model: 'pouf', w: 45, d: 45, h: 42, color: '#e8e2d6' },
  { id: 'rug', name: 'Rug 200×300', category: 'living', model: 'rug', w: 200, d: 300, h: 1, color: '#cfc6b8' },
  { id: 'rugSmall', name: 'Rug 160×230', category: 'living', model: 'rug', w: 160, d: 230, h: 1, color: '#cfc6b8' },
  { id: 'tvUnit', name: 'TV unit 180', category: 'living', model: 'tvUnit', w: 180, d: 40, h: 45, color: '#c8a273' },
  { id: 'tvUnitSmall', name: 'TV unit 120', category: 'living', model: 'tvUnit', w: 120, d: 40, h: 45, color: '#c8a273' },
  ...tvs,
  { id: 'balconyChair', name: 'Balcony / lounge chair', category: 'living', model: 'balconyChair', w: 55, d: 55, h: 80, color: '#c8a273' },

  // ---------- Dining ----------
  { id: 'dining6', name: '6-seater dining table', category: 'dining', model: 'diningTable', w: 180, d: 90, h: 75, color: '#ece8e1' },
  { id: 'dining4', name: '4-seater dining table', category: 'dining', model: 'diningTable', w: 120, d: 80, h: 75, color: '#ece8e1' },
  { id: 'diningChair', name: 'Dining chair', category: 'dining', model: 'diningChair', w: 45, d: 52, h: 90, color: '#d9d4cc' },
  { id: 'barStool', name: 'Bar stool', category: 'dining', model: 'barStool', w: 40, d: 40, h: 75, color: '#6b4a32' },
  { id: 'cafeTable', name: 'Round café table Ø50', category: 'dining', model: 'roundTable', w: 50, d: 50, h: 70, color: '#2f6f6a' },

  // ---------- Bedroom ----------
  { id: 'bedKing', name: 'King bed 180×200', category: 'bedroom', model: 'bed', w: 180, d: 200, h: 105, color: '#d9d4cc' },
  { id: 'bedQueen', name: 'Queen bed 150×200', category: 'bedroom', model: 'bed', w: 150, d: 200, h: 105, color: '#d9d4cc' },
  { id: 'bedSingle', name: 'Single bed 90×190', category: 'bedroom', model: 'bed', w: 90, d: 190, h: 90, color: '#d9d4cc' },
  { id: 'bedside', name: 'Bedside table', category: 'bedroom', model: 'bedside', w: 45, d: 40, h: 55, color: '#c8a273' },
  { id: 'dressingTable', name: 'Dressing table + mirror', category: 'bedroom', model: 'dressingTable', w: 80, d: 45, h: 150, color: '#c8a273' },

  // ---------- Storage ----------
  { id: 'wardrobe2', name: 'Wardrobe 2-door', category: 'storage', model: 'wardrobe', w: 90, d: 60, h: 210, color: '#c8a273' },
  { id: 'wardrobe3', name: 'Wardrobe 3-door', category: 'storage', model: 'wardrobe', w: 135, d: 60, h: 210, color: '#c8a273' },
  { id: 'wardrobe4', name: 'Wardrobe 4-door', category: 'storage', model: 'wardrobe', w: 180, d: 60, h: 210, color: '#c8a273' },
  { id: 'bookshelf', name: 'Bookshelf', category: 'storage', model: 'bookshelf', w: 80, d: 30, h: 180, color: '#6b4a32' },
  { id: 'shoeRack', name: 'Shoe rack', category: 'storage', model: 'shoeRack', w: 80, d: 35, h: 100, color: '#c8a273' },
  { id: 'divider', name: 'Low divider shelf', category: 'storage', model: 'divider', w: 190, d: 25, h: 90, color: '#6b4a32' },

  // ---------- Study ----------
  { id: 'desk', name: 'Study desk 120', category: 'study', model: 'desk', w: 120, d: 60, h: 75, color: '#c8a273' },
  { id: 'deskSmall', name: 'Study desk 90', category: 'study', model: 'desk', w: 90, d: 50, h: 75, color: '#c8a273' },
  { id: 'studyChair', name: 'Study / office chair', category: 'study', model: 'studyChair', w: 55, d: 55, h: 95, color: '#2b2d31' },

  // ---------- Kitchen ----------
  { id: 'microwave', name: 'Microwave (on counter)', category: 'kitchen', model: 'microwave', w: 50, d: 40, h: 30, y: 90, color: '#1d1e20' },
  { id: 'dishwasher', name: 'Dishwasher', category: 'kitchen', model: 'dishwasher', w: 60, d: 60, h: 85, color: '#c9ccd0' },

  // ---------- Appliances ----------
  { id: 'fridgeDD', name: 'Fridge double-door', category: 'appliance', model: 'fridge', w: 70, d: 70, h: 175, color: '#c9ccd0' },
  { id: 'fridgeSD', name: 'Fridge single-door', category: 'appliance', model: 'fridge', variant: 'single', w: 60, d: 65, h: 150, color: '#8a2f35' },
  { id: 'washingMachine', name: 'Washing machine (front load)', category: 'appliance', model: 'washingMachine', w: 60, d: 60, h: 85, color: '#f2f2f0' },
  { id: 'ac', name: 'AC indoor unit (split)', category: 'appliance', model: 'ac', w: 100, d: 22, h: 30, y: 220, color: '#f4f4f2', wallMounted: true },
  { id: 'ceilingFan', name: 'Ceiling fan Ø120', category: 'appliance', model: 'ceilingFan', w: 120, d: 120, h: 35, y: 250, color: '#e9e6df' },

  // ---------- Decor ----------
  { id: 'floorLamp', name: 'Floor lamp', category: 'decor', model: 'floorLamp', w: 40, d: 40, h: 160, color: '#f3e7cf' },
  { id: 'plant', name: 'Plant pot (large)', category: 'decor', model: 'plant', w: 45, d: 45, h: 110, color: '#b5643c' },
  { id: 'plantSmall', name: 'Plant pot (small)', category: 'decor', model: 'plant', w: 25, d: 25, h: 40, color: '#e8e4dc' },
  { id: 'mirror', name: 'Wall mirror', category: 'decor', model: 'mirror', w: 60, d: 3, h: 90, y: 100, color: '#6b4a32', wallMounted: true },
]

const byId = new Map(CATALOG.map((c) => [c.id, c]))

/** Catalog entry by id (shared CatalogItem fields only). */
export function getCatalogItem(id: string): CatalogItem | undefined {
  return byId.get(id)
}

/** Same as getCatalogItem but with planner-only fields (model kind, variant). */
export function getEntry(id: string): CatalogEntry | undefined {
  return byId.get(id)
}

/** Display names of the catalog categories, in panel order. */
export const CATEGORY_LABELS: Record<CatalogItem['category'], string> = {
  living: 'Living',
  dining: 'Dining',
  bedroom: 'Bedroom',
  storage: 'Storage',
  study: 'Study',
  kitchen: 'Kitchen',
  appliance: 'Appliances',
  decor: 'Decor',
}

/** Effective size of a placed item (overrides win over catalog). */
export function itemDims(it: PlacedItem) {
  const c = byId.get(it.catalogId)
  return { w: it.w ?? c?.w ?? 50, d: it.d ?? c?.d ?? 50, h: it.h ?? c?.h ?? 50 }
}

/**
 * Local footprint rectangles (cm, centred on the item origin, before rotation) used for overlap checks.
 * Most items are one rectangle; L-sofas are two.
 */
export function footprintRects(catalogId: string, w: number, d: number): { x1: number; z1: number; x2: number; z2: number }[] {
  const c = byId.get(catalogId)
  if (c?.model === 'lsofa') {
    const seatD = Math.min(90, d)
    const chaiseW = Math.min(90, w)
    const back = { x1: -w / 2, z1: -d / 2, x2: w / 2, z2: -d / 2 + seatD }
    const chaise =
      c.variant === 'left'
        ? { x1: w / 2 - chaiseW, z1: -d / 2 + seatD, x2: w / 2, z2: d / 2 }
        : { x1: -w / 2, z1: -d / 2 + seatD, x2: -w / 2 + chaiseW, z2: d / 2 }
    return [back, chaise]
  }
  return [{ x1: -w / 2, z1: -d / 2, x2: w / 2, z2: d / 2 }]
}
