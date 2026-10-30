// Shared helpers for the architecture module: the plan-mode cut, a hook that builds and disposes merged
// box geometry, a mesh wrapper, wall-local coordinates, rect / interval subtraction and a few
// materials that getMaterials() does not list.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { MeshTag, Rect, Wall } from '../data/schema'
import { wallAxis } from '../data/geometry'
import { useStore } from '../store'
import { GeoBuilder, type Built } from './builder'

/** Height (cm) above which architecture is cut away in plan mode. */
export const PLAN_CUT = 120

/** Current cut height (cm): PLAN_CUT in plan mode, otherwise nothing is cut. */
export function useCut() {
  const mode = useStore((s) => s.mode)
  return mode === 'plan' ? PLAN_CUT : Infinity
}

/**
 * Run `fn` on a fresh GeoBuilder and return its merged opaque + transparent meshes. Rebuilt when
 * `cut` or `deps` change (`fn` itself is deliberately not a dependency: callers pass inline closures);
 * the previous geometry is disposed.
 */
export function useBuilt(fn: (b: GeoBuilder) => void, cut: number, deps: unknown[]) {
  const built = useMemo(() => {
    const b = new GeoBuilder(cut)
    fn(b)
    return { opaque: b.build('opaque'), transparent: b.build('transparent') }
  }, [cut, ...deps])
  useEffect(
    () => () => {
      built.opaque?.geometry.dispose()
      built.transparent?.geometry.dispose()
    },
    [built],
  )
  return built
}

/** The meshes of a useBuilt result: opaque (casts shadows) and transparent (drawn after, no shadow). */
export function BMesh({
  built,
  tag,
  shadows = true,
}: {
  built: { opaque: Built | null; transparent: Built | null }
  tag?: MeshTag
  shadows?: boolean
}) {
  return (
    <>
      {built.opaque && (
        <mesh
          geometry={built.opaque.geometry}
          material={built.opaque.materials}
          userData={tag ?? {}}
          castShadow={shadows}
          receiveShadow
        />
      )}
      {built.transparent && (
        <mesh geometry={built.transparent.geometry} material={built.transparent.materials} userData={tag ?? {}} renderOrder={1} />
      )}
    </>
  )
}

/**
 * Wall-local frame: s = along the wall's long axis (absolute world x or z, cm), t = across the
 * thickness (absolute z or x, from t0 to t1). Lets door / window code be written once for both axes.
 */
export function wallFrame(w: Wall) {
  const axis = wallAxis(w)
  const t0 = axis === 'x' ? w.rect.z1 : w.rect.x1
  const t1 = axis === 'x' ? w.rect.z2 : w.rect.x2
  /** box from along/up/across ranges (cm) to world min/max */
  const box = (s0: number, s1: number, y0: number, y1: number, a0: number, a1: number) => {
    const [sa, sb] = [Math.min(s0, s1), Math.max(s0, s1)]
    const [ta, tb] = [Math.min(a0, a1), Math.max(a0, a1)]
    const [ya, yb] = [Math.min(y0, y1), Math.max(y0, y1)]
    return axis === 'x'
      ? { min: [sa, ya, ta] as [number, number, number], max: [sb, yb, tb] as [number, number, number] }
      : { min: [ta, ya, sa] as [number, number, number], max: [tb, yb, sb] as [number, number, number] }
  }
  /** world xz (cm) of an along/across point */
  const pt = (s: number, t: number) => (axis === 'x' ? { x: s, z: t } : { x: t, z: s })
  /** unit world vector (x,z) of +s and +t */
  const sDir = axis === 'x' ? { x: 1, z: 0 } : { x: 0, z: 1 }
  const tDir = axis === 'x' ? { x: 0, z: 1 } : { x: 1, z: 0 }
  return { axis, t0, t1, tc: (t0 + t1) / 2, thick: t1 - t0, box, pt, sDir, tDir }
}

/** Subtract rect `h` from rect `r` (cm, xz) -> up to 4 rects. */
export function subtractRect(r: Rect, h: Rect): Rect[] {
  if (h.x2 <= r.x1 || h.x1 >= r.x2 || h.z2 <= r.z1 || h.z1 >= r.z2) return [r]
  const out: Rect[] = []
  if (h.z1 > r.z1) out.push({ x1: r.x1, z1: r.z1, x2: r.x2, z2: h.z1 })
  if (h.z2 < r.z2) out.push({ x1: r.x1, z1: h.z2, x2: r.x2, z2: r.z2 })
  const z1 = Math.max(r.z1, h.z1)
  const z2 = Math.min(r.z2, h.z2)
  if (h.x1 > r.x1) out.push({ x1: r.x1, z1, x2: h.x1, z2 })
  if (h.x2 < r.x2) out.push({ x1: h.x2, z1, x2: r.x2, z2 })
  return out
}

/** Subtract intervals from [a,b]. */
export function subtractIntervals(a: number, b: number, cuts: [number, number][]): [number, number][] {
  let segs: [number, number][] = [[a, b]]
  for (const [c0, c1] of cuts) {
    const next: [number, number][] = []
    for (const [s0, s1] of segs) {
      if (c1 <= s0 || c0 >= s1) next.push([s0, s1])
      else {
        if (c0 > s0) next.push([s0, c0])
        if (c1 < s1) next.push([c1, s1])
      }
    }
    segs = next
  }
  return segs.filter(([s0, s1]) => s1 - s0 > 0.5)
}

/**
 * Floor / ceiling areas that belong to a room but lie outside every room rect: the open strip between
 * the hall and the kitchen beside the short kitchen wall stub.
 */
export const GAP_FILLS: { roomId: string; rect: Rect }[] = [{ roomId: 'hall', rect: { x1: 76, z1: 622, x2: 330, z2: 634 } }]

// ---------------------------------------------------------------------------
// Fittings materials that getMaterials() does not list (shared singletons, never disposed).
let local: Record<'mirror' | 'blackGlass' | 'frosted' | 'chrome' | 'grout', THREE.Material> | null = null
/** Mirror, black glass, frosted glass, chrome and grout for fittings. */
export function localMaterials() {
  if (local) return local
  local = {
    mirror: new THREE.MeshStandardMaterial({ color: '#dfe6ea', roughness: 0.03, metalness: 1, envMapIntensity: 1.4 }),
    blackGlass: new THREE.MeshStandardMaterial({ color: '#0c0d0f', roughness: 0.06, metalness: 0.3 }),
    frosted: new THREE.MeshStandardMaterial({ color: '#eef3f4', roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e8eaec', roughness: 0.12, metalness: 1 }),
    grout: new THREE.MeshStandardMaterial({ color: '#3a3b3d', roughness: 0.6, metalness: 0.4 }),
  }
  return local
}
