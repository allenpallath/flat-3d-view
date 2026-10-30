// OWNER: Electrical Planner agent (A5). Pure import/export helpers (unit tested).
import type { ElectricalPoint, Plan, PointType } from '../data/schema'
import { PRESETS } from './presets'
import { alongInfo, ceilingInfo, isCeilingPoint, roomForPoint, sideLabel, wallSide } from './wallMath'

export const CSV_COLUMNS = ['Room', 'Type', 'Wall', 'Height_cm', 'Distance_from_left_corner_cm', 'X_cm', 'Z_cm', 'Note'] as const

export function csvEscape(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const r1 = (n: number) => Math.round(n * 10) / 10

export interface PointRow {
  room: string
  type: string
  wall: string
  height: number
  fromLeft: number | ''
  x: number
  z: number
  note: string
}

/** One row per point, sorted by room (plan order), then type, then position. */
export function pointRows(points: ElectricalPoint[], plan: Plan): PointRow[] {
  const roomIndex = (id?: string) => {
    const i = plan.rooms.findIndex((r) => r.id === id)
    return i < 0 ? 999 : i
  }
  const typeIndex = (t: PointType) => Object.keys(PRESETS).indexOf(t)
  const withRoom = points.map((p) => ({ p, room: roomForPoint(plan, p) }))
  withRoom.sort(
    (a, b) =>
      roomIndex(a.room?.id) - roomIndex(b.room?.id) ||
      typeIndex(a.p.type) - typeIndex(b.p.type) ||
      a.p.x - b.p.x ||
      a.p.z - b.p.z,
  )
  return withRoom.map(({ p, room }) => {
    const side = wallSide(p.nx, p.nz)
    const info = alongInfo(plan, p)
    let wall = sideLabel(side)
    if (p.wallId) wall += ` (${p.wallId})`
    let fromLeft: number | '' = info ? r1(info.left) : ''
    if (isCeilingPoint(p)) {
      const c = ceilingInfo(plan, p)
      if (c) wall = `Ceiling (${r1(c.west)} from W, ${r1(c.north)} from N)`
      fromLeft = ''
    }
    return {
      room: room?.name ?? p.roomId ?? '',
      type: PRESETS[p.type]?.label ?? p.type,
      wall,
      height: r1(p.y),
      fromLeft,
      x: r1(p.x),
      z: r1(p.z),
      note: p.note ?? '',
    }
  })
}

export function pointsToCsv(points: ElectricalPoint[], plan: Plan): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const r of pointRows(points, plan)) {
    lines.push([r.room, r.type, r.wall, r.height, r.fromLeft, r.x, r.z, r.note].map(csvEscape).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

export interface PointsFile {
  format: 'flat-c-electrical'
  version: 1
  exportedAt: string
  points: ElectricalPoint[]
}

export function pointsToJson(points: ElectricalPoint[], now = new Date()): string {
  const f: PointsFile = { format: 'flat-c-electrical', version: 1, exportedAt: now.toISOString(), points }
  return JSON.stringify(f, null, 2)
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Parse an exported JSON file (or a bare array / a whole-project file with a `points` key).
 * Invalid entries are dropped; throws if nothing usable is found.
 */
export function parsePointsJson(text: string): ElectricalPoint[] {
  const data = JSON.parse(text) as unknown
  const arr: unknown = Array.isArray(data) ? data : (data as { points?: unknown })?.points
  if (!Array.isArray(arr)) throw new Error('No "points" array in file')
  const out: ElectricalPoint[] = []
  arr.forEach((raw, i) => {
    const o = raw as Partial<ElectricalPoint>
    if (!o || typeof o !== 'object' || !o.type || !(o.type in PRESETS)) return
    if (!isNum(o.x) || !isNum(o.y) || !isNum(o.z)) return
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id : `pt_import_${i}`,
      type: o.type,
      x: o.x,
      y: o.y,
      z: o.z,
      nx: isNum(o.nx) ? o.nx : 0,
      nz: isNum(o.nz) ? o.nz : 0,
      ...(typeof o.wallId === 'string' ? { wallId: o.wallId } : {}),
      ...(typeof o.roomId === 'string' ? { roomId: o.roomId } : {}),
      ...(typeof o.note === 'string' && o.note ? { note: o.note } : {}),
    })
  })
  if (!out.length && arr.length) throw new Error('No valid points in file')
  // ensure unique ids
  const seen = new Set<string>()
  for (const p of out) {
    while (seen.has(p.id)) p.id += '_'
    seen.add(p.id)
  }
  return out
}

/** Count of points per type (for summaries). */
export function countByType(points: ElectricalPoint[]): Partial<Record<PointType, number>> {
  const c: Partial<Record<PointType, number>> = {}
  for (const p of points) c[p.type] = (c[p.type] ?? 0) + 1
  return c
}
