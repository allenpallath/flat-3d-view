// Static sun shadows: the shadow map is only re-rendered while something that casts shadows
// changes (furniture moved, door swinging, LOD swap, room visibility), not on every frame.
// Anything that changes a shadow caster calls markShadowsDirty(); <Lighting/> sets
// shadowMap.needsUpdate and keeps invalidating while shadowsDirty() is true.
import { invalidate } from '@react-three/fiber'

let dirtyUntil = 0

/** Re-render the sun's shadow map on every frame for the next `ms` milliseconds. */
export function markShadowsDirty(ms = 1500) {
  dirtyUntil = Math.max(dirtyUntil, performance.now() + ms)
  invalidate()
}

/** True while the shadow map must be re-rendered every frame. */
export const shadowsDirty = () => performance.now() < dirtyUntil
