// Shared, reference-counted cache of merged furniture geometry. Identical items (same catalog entry,
// size and colour, e.g. the six dining chairs) share ONE BufferGeometry. The geometry is disposed
// when the last user releases it (deferred by a tick, so a remount in the same commit reuses it).
// Materials are shared singletons (getMaterials() / models.tsx caches) and are never disposed here.
import { useLayoutEffect, useMemo } from 'react'
import type { BufferGeometry, Material } from 'three'
import { getEntry } from './catalog'
import { buildFurniture, type FurnitureModelProps } from './models'

export interface CacheEntry {
  key: string
  geometry: BufferGeometry
  materials: Material[]
  refs: number
  disposed: boolean
}

const cache = new Map<string, CacheEntry>()

/** Cache key: everything that changes the built geometry (LOD level, model, size, colour, TV size). */
export function geoKey(p: FurnitureModelProps, lod: boolean) {
  const inches = getEntry(p.catalogId)?.inches ?? ''
  return `${lod ? 'lod' : 'hi'}|${p.catalogId}|${p.w}|${p.d}|${p.h}|${p.color ?? ''}|${inches}`
}

/** Get (building on a miss) the entry for a model. Does not take a reference. */
export function peekFurnitureGeometry(p: FurnitureModelProps, lod: boolean): CacheEntry {
  const key = geoKey(p, lod)
  let e = cache.get(key)
  if (!e || e.disposed) {
    const built = buildFurniture(p, lod)
    e = { key, ...built, refs: 0, disposed: false }
    cache.set(key, e)
    // nobody may ever retain an entry built during an aborted render: collect it if still unused
    scheduleCollect(e)
  }
  return e
}

function scheduleCollect(e: CacheEntry) {
  setTimeout(() => {
    if (e.refs > 0 || e.disposed) return
    e.disposed = true
    e.geometry.dispose()
    if (cache.get(e.key) === e) cache.delete(e.key)
  }, 0)
}

/** Take a reference to an entry (resurrecting it if it was just collected). */
export function retain(e: CacheEntry) {
  if (e.disposed) {
    // collected in between (shouldn't happen): resurrect; three re-uploads the CPU-side data
    e.disposed = false
    if (!cache.has(e.key)) cache.set(e.key, e)
  }
  e.refs++
}

/** Drop a reference; the last one schedules disposal. */
export function release(e: CacheEntry) {
  e.refs--
  if (e.refs <= 0) {
    e.refs = 0
    scheduleCollect(e)
  }
}

/** React hook: the shared merged geometry for a model, reference-counted for the component's lifetime. */
export function useFurnitureGeometry(p: FurnitureModelProps, lod = false): CacheEntry {
  const { catalogId, w, d, h, color } = p
  const entry = useMemo(() => peekFurnitureGeometry({ catalogId, w, d, h, color }, lod), [catalogId, w, d, h, color, lod])
  useLayoutEffect(() => {
    retain(entry)
    return () => release(entry)
  }, [entry])
  return entry
}

