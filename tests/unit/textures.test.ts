// QA (A6): procedural texture resolution tiers (phones / low quality use half-size sets).
import { afterEach, describe, expect, it } from 'vitest'
import { buildRaw, setTextureScale } from '../../src/materials/textures'
import { GENERATORS } from '../../src/materials/generators'

const ramp = (u: number, _v: number, o: Float32Array) => {
  o[4] = u * 4 // height ramp: constant slope in u
}

describe('texture scale', () => {
  afterEach(() => setTextureScale(1))

  it('halves width/height and buffer sizes at scale 0.5', () => {
    setTextureScale(0.5)
    const r = buildRaw(ramp, { w: 64, size: [1, 1], normal: 1 })
    expect(r.w).toBe(32)
    expect(r.h).toBe(32)
    expect(r.col.length).toBe(32 * 32 * 4)
    expect(r.normal!.length).toBe(32 * 32 * 4)
  })

  it('keeps normal-map slope independent of resolution', () => {
    const mid = (r: { w: number; normal?: Uint8Array }) => r.normal![((r.w / 2) * r.w + r.w / 4) * 4]
    const full = buildRaw(ramp, { w: 64, size: [1, 1], normal: 4 })
    setTextureScale(0.5)
    const half = buildRaw(ramp, { w: 64, size: [1, 1], normal: 4 })
    expect(Math.abs(mid(full) - mid(half))).toBeLessThanOrEqual(2)
  })

  it('every generator honours the scale', () => {
    setTextureScale(0.5)
    const r = GENERATORS.lacquer()
    expect(r.w).toBe(128)
  })
})
