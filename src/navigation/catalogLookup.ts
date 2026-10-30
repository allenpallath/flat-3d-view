// OWNER: Navigation agent (A3). Soft dependency on the planner catalog (A4):
// resolves to undefined if src/planner/catalog.ts doesn't exist or has no getCatalogItem.
import type { CatalogItem } from '../data/schema'
import type { SizeLookup } from './collision'

const mods = import.meta.glob('../planner/catalog.ts', { eager: true }) as Record<
  string,
  { getCatalogItem?: (id: string) => CatalogItem | undefined }
>
const getCatalogItem = Object.values(mods)[0]?.getCatalogItem

export const catalogSize: SizeLookup | undefined = getCatalogItem
  ? (id) => {
      const c = getCatalogItem(id)
      return c ? { w: c.w, d: c.d, h: c.h, y: c.y } : undefined
    }
  : undefined
