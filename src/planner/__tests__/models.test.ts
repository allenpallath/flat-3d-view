// Every catalog model builds one merged geometry (and LOD proxy) that fits its footprint.
import { describe, expect, it } from 'vitest'
import { CATALOG } from '../catalog'
import { buildFurniture } from '../models'

describe('merged furniture geometry', () => {
  for (const e of CATALOG) {
    it(`${e.id}: one geometry, groups = materials, inside the footprint`, () => {
      const p = { catalogId: e.id, w: e.w, d: e.d, h: e.h }
      for (const lod of [false, true]) {
        const { geometry, materials } = buildFurniture(p, lod)
        expect(geometry.attributes.position.count).toBeGreaterThan(0)
        expect(geometry.groups.length).toBe(materials.length)
        const bb = geometry.boundingBox!
        const tol = 0.002 // m (tilted cushions / pillows)
        expect(bb.max.x - bb.min.x).toBeLessThanOrEqual(e.w / 100 + tol)
        expect(bb.max.z - bb.min.z).toBeLessThanOrEqual(e.d / 100 + 0.02)
        expect(bb.max.y).toBeLessThanOrEqual(e.h / 100 + tol)
        expect(bb.min.y).toBeGreaterThanOrEqual(-tol)
        geometry.dispose()
      }
    })
  }
})
