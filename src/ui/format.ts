// Pure UI helpers (no three/react imports, unit-tested): measure formatting and snapping, the drawing
// overlay extent, the Save/Load project file format and e2e room viewpoints.

export type Vec3 = [number, number, number]

/** Euclidean distance between two points (same units in, same units out). */
export function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
}

/** Distance in cm between two scene points given in metres. */
export function distCmFromMetres(a: Vec3, b: Vec3): number {
  return dist3(a, b) * 100
}

/** "312 cm" (rounded to 1 cm; below 10 cm one decimal). */
export function formatCm(cm: number): string {
  if (!Number.isFinite(cm)) return '—'
  const v = Math.abs(cm) < 10 ? Math.round(cm * 10) / 10 : Math.round(cm)
  return `${v} cm`
}

/** Feet and inches, rounded to the nearest inch: 10' 3". Under a foot: 7". */
export function formatFtIn(cm: number): string {
  if (!Number.isFinite(cm)) return '—'
  const sign = cm < 0 ? '-' : ''
  let totalIn = Math.round(Math.abs(cm) / 2.54)
  const ft = Math.floor(totalIn / 12)
  totalIn -= ft * 12
  return ft > 0 ? `${sign}${ft}' ${totalIn}"` : `${sign}${totalIn}"`
}

/** Both units, e.g. { cm: "312 cm", ftIn: "10' 3\"" }. */
export function formatDistance(cm: number) {
  return { cm: formatCm(cm), ftIn: formatFtIn(cm) }
}

/**
 * Axis lock: keep only the dominant component of (p - origin), so the
 * returned point lies on the X, Y or Z line through origin.
 */
export function axisLock(origin: Vec3, p: Vec3): { point: Vec3; axis: 'x' | 'y' | 'z' } {
  const d = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]]
  const ad = d.map(Math.abs)
  const i = ad[0] >= ad[1] && ad[0] >= ad[2] ? 0 : ad[1] >= ad[2] ? 1 : 2
  const point: Vec3 = [origin[0], origin[1], origin[2]]
  point[i] = p[i]
  return { point, axis: (['x', 'y', 'z'] as const)[i] }
}

/** Snap p to the nearest candidate within `radius`; returns null if none. */
export function snapToNearest(p: Vec3, candidates: Vec3[], radius: number): Vec3 | null {
  let best: Vec3 | null = null
  let bestD = radius
  for (const c of candidates) {
    const d = dist3(p, c)
    if (d <= bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

/** Round each component to a grid step (e.g. 0.01 m = 1 cm). */
export function roundVec(p: Vec3, step: number): Vec3 {
  return [Math.round(p[0] / step) * step, Math.round(p[1] / step) * step, Math.round(p[2] / step) * step]
}

/** Overlay plane for the reference drawing: drawing px = origin + cm * scale. */
export const PLAN_IMAGE = { width: 1600, height: 1200, originX: 300, originY: 100, pxPerCm: 1.12 }

/** Extent (cm) of the drawing image in plan coordinates. */
export function planImageExtentCm(img = PLAN_IMAGE) {
  return {
    x1: -img.originX / img.pxPerCm,
    x2: (img.width - img.originX) / img.pxPerCm,
    z1: -img.originY / img.pxPerCm,
    z2: (img.height - img.originY) / img.pxPerCm,
  }
}

/** Plan cm -> drawing px. */
export function cmToPlanPx(x: number, z: number, img = PLAN_IMAGE) {
  return { px: img.originX + x * img.pxPerCm, py: img.originY + z * img.pxPerCm }
}

/** Project file format for Save/Load. */
export const PROJECT_VERSION = 1

export interface ProjectFile<I = unknown, P = unknown> {
  version: number
  app?: string
  savedAt?: string
  items: I[]
  points: P[]
}

/** A project file (Save) for the given items and points. */
export function makeProject<I, P>(items: I[], points: P[]): ProjectFile<I, P> {
  return { version: PROJECT_VERSION, app: 'flat-3d-view', savedAt: new Date().toISOString(), items, points }
}

/** Parse + validate a project JSON string. Throws a readable Error on bad input. */
export function parseProject(text: string): { items: unknown[]; points: unknown[] } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('File is not valid JSON')
  }
  if (!data || typeof data !== 'object') throw new Error('Project file must be a JSON object')
  const d = data as Record<string, unknown>
  if (typeof d.version !== 'number') throw new Error('Missing project version')
  if (d.version > PROJECT_VERSION) throw new Error(`Project version ${d.version} is newer than this app supports`)
  const items = Array.isArray(d.items) ? d.items : []
  const points = Array.isArray(d.points) ? d.points : []
  const okItem = (i: unknown) => {
    const o = i as Record<string, unknown>
    return !!o && typeof o.id === 'string' && typeof o.catalogId === 'string' && typeof o.x === 'number' && typeof o.z === 'number'
  }
  const okPoint = (p: unknown) => {
    const o = p as Record<string, unknown>
    return !!o && typeof o.id === 'string' && typeof o.type === 'string' && typeof o.x === 'number' && typeof o.y === 'number' && typeof o.z === 'number'
  }
  if (!items.every(okItem)) throw new Error('Project has malformed furniture items')
  if (!points.every(okPoint)) throw new Error('Project has malformed electrical points')
  return { items, points }
}

/** Point a walker can stand at to see a room, plus a yaw looking across it (deg, 0 = north, + = left/CCW). */
export function roomViewpoint(rect: { x1: number; z1: number; x2: number; z2: number }) {
  const w = rect.x2 - rect.x1
  const d = rect.z2 - rect.z1
  const cx = (rect.x1 + rect.x2) / 2
  const cz = (rect.z1 + rect.z2) / 2
  if (w >= d) {
    const inset = Math.min(Math.max(w * 0.15, 25), w / 2)
    return { x: rect.x1 + inset, z: cz, yawDeg: -90 } // look east
  }
  const inset = Math.min(Math.max(d * 0.15, 25), d / 2)
  return { x: cx, z: rect.z1 + inset, yawDeg: 180 } // look south
}
