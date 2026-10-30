// Static sun shadows: the shadow map is only re-rendered while something that casts shadows
// changes (furniture moved, door swinging, LOD swap, room visibility), not on every frame.
import { invalidate } from '@react-three/fiber'

let dirtyUntil = 0

/** Re-render the sun's shadow map on every frame for the next `ms` milliseconds. */
export function markShadowsDirty(ms = 1500) {
  dirtyUntil = Math.max(dirtyUntil, performance.now() + ms)
  invalidate()
}

export const shadowsDirty = () => performance.now() < dirtyUntil
