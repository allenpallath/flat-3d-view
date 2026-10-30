// Fixed fixtures from planC.fixtures, modelled from primitives and tagged {kind:'fixture', fixtureId}:
// kitchen counters + wall cabinets, hob, sink, chimney, breakfast counter, vanities with mirrors,
// wall-hung WCs, shower glass/drain/rain shower, balcony planters.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import planC from '../data/planC'
import { rectsOverlap, wallAxis } from '../data/geometry'
import type { Fixture, MeshTag, Rect, Room } from '../data/schema'
import { toM } from '../data/schema'
import { getMaterials } from '../materials/materials'
import type { GeoBuilder } from './builder'
import { BMesh, localMaterials, subtractIntervals, subtractRect, useBuilt, useCut } from './common'

type Edge = 'x1' | 'x2' | 'z1' | 'z2'
const TOL = 1.5 // cm: edges this close count as touching

const roomOf = (f: Fixture): Room => planC.rooms.find((r) => r.id === f.room) ?? planC.rooms[0]

/** Which edge of the fixture rect sits against a wall of its room (prefers the long sides). */
function wallEdge(rect: Rect, room: Room): Edge {
  const R = room.rect
  const longZ = rect.z2 - rect.z1 > rect.x2 - rect.x1
  const order: Edge[] = longZ ? ['x1', 'x2', 'z1', 'z2'] : ['z1', 'z2', 'x1', 'x2']
  for (const e of order) if (Math.abs(rect[e] - R[e]) <= TOL) return e
  return order[0]
}

/**
 * Fixture frame: u = along the wall (absolute world x or z, cm), v = distance from the wall into
 * the room (cm), y up.
 */
function fxFrame(rect: Rect, edge: Edge) {
  const alongX = edge === 'z1' || edge === 'z2'
  const u0 = alongX ? rect.x1 : rect.z1
  const u1 = alongX ? rect.x2 : rect.z2
  const D = alongX ? rect.z2 - rect.z1 : rect.x2 - rect.x1
  const w = (v: number) => (edge === 'x1' ? rect.x1 + v : edge === 'x2' ? rect.x2 - v : edge === 'z1' ? rect.z1 + v : rect.z2 - v)
  const box = (ua: number, ub: number, ya: number, yb: number, va: number, vb: number) => {
    const [wa, wb] = [Math.min(w(va), w(vb)), Math.max(w(va), w(vb))]
    const [a, b] = [Math.min(ua, ub), Math.max(ua, ub)]
    const [y0, y1] = [Math.min(ya, yb), Math.max(ya, yb)]
    return alongX
      ? { min: [a, y0, wa] as [number, number, number], max: [b, y1, wb] as [number, number, number] }
      : { min: [wa, y0, a] as [number, number, number], max: [wb, y1, b] as [number, number, number] }
  }
  /** world point in metres */
  const pos = (u: number, y: number, v: number): [number, number, number] =>
    alongX ? [toM(u), toM(y), toM(w(v))] : [toM(w(v)), toM(y), toM(u)]
  const n = { x: edge === 'x1' ? 1 : edge === 'x2' ? -1 : 0, z: edge === 'z1' ? 1 : edge === 'z2' ? -1 : 0 }
  /** rotation.y that turns local +z into the room (away from the wall) */
  const yaw = Math.atan2(n.x, n.z)
  /** world (x,z) half-extents for an ellipse with half-width hu along the wall and hv into the room */
  const scaleXZ = (hu: number, hv: number): [number, number] => (alongX ? [hu, hv] : [hv, hu])
  const uOf = (r: Rect): [number, number] => (alongX ? [r.x1, r.x2] : [r.z1, r.z2])
  const vOf = (r: Rect): [number, number] => {
    const a = alongX ? [r.z1, r.z2] : [r.x1, r.x2]
    const vs = a.map((c) => (edge === 'x1' || edge === 'z1' ? c - (alongX ? rect.z1 : rect.x1) : (alongX ? rect.z2 : rect.x2) - c))
    return [Math.min(vs[0], vs[1]), Math.max(vs[0], vs[1])]
  }
  return { alongX, u0, u1, D, box, pos, yaw, scaleXZ, uOf, vOf, wallLine: rect[edge] }
}

/** Openings of the wall whose face lies on `line` (absolute x or z) and that runs along the given axis. */
function wallOpeningsOnLine(edge: Edge, line: number) {
  const along = edge === 'z1' || edge === 'z2' ? 'x' : 'z'
  return planC.walls
    .filter((w) => wallAxis(w) === along)
    .filter((w) => {
      const r = w.rect
      if (edge === 'x1') return Math.abs(r.x2 - line) <= TOL
      if (edge === 'x2') return Math.abs(r.x1 - line) <= TOL
      if (edge === 'z1') return Math.abs(r.z2 - line) <= TOL
      return Math.abs(r.z1 - line) <= TOL
    })
    .flatMap((w) => w.openings ?? [])
}

const overlaps = rectsOverlap
const tagOf = (f: Fixture): MeshTag => ({ kind: 'fixture', fixtureId: f.id })

// ---------------------------------------------------------------------------------------------
// Kitchen counter (+ wall cabinets, backsplash)

function buildCounter(b: GeoBuilder, f: Fixture) {
  const m = getMaterials()
  const lm = localMaterials()
  const room = roomOf(f)
  const edge = wallEdge(f.rect, room)
  const F = fxFrame(f.rect, edge)
  const { u0, u1, D } = F
  const top = f.height
  const stoneT = 2
  const body = top - stoneT
  const sinks = planC.fixtures.filter((s) => s.type === 'sink' && overlaps(s.rect, f.rect))
  const holes = sinks.map((s) => ({ x1: s.rect.x1 + 2.5, z1: s.rect.z1 + 2.5, x2: s.rect.x2 - 2.5, z2: s.rect.z2 - 2.5 }))

  // plinth / toe kick
  b.b(F.box(u0, u1, 0, 10, 0, D - 7), m.blackMetal)
  // carcass, with the sink bowl volume removed from its upper part
  b.b(F.box(u0, u1, 10, body - 22, 0, D - 3), m.kitchenCabinet)
  let upper: Rect[] = [f.rect]
  for (const h of holes) upper = upper.flatMap((r) => subtractRect(r, { x1: h.x1 - 1, z1: h.z1 - 1, x2: h.x2 + 1, z2: h.z2 + 1 }))
  const D3 = F.box(u0, u1, 0, 1, 0, D - 3) // carcass footprint (world)
  const carcass: Rect = { x1: D3.min[0], z1: D3.min[2], x2: D3.max[0], z2: D3.max[2] }
  for (const r of upper) {
    const c = { x1: Math.max(r.x1, carcass.x1), z1: Math.max(r.z1, carcass.z1), x2: Math.min(r.x2, carcass.x2), z2: Math.min(r.z2, carcass.z2) }
    if (c.x2 > c.x1 && c.z2 > c.z1) b.box([c.x1, body - 22, c.z1], [c.x2, body, c.z2], m.kitchenCabinet)
  }
  // stone top with sink cut-outs
  let tops: Rect[] = [f.rect]
  for (const h of holes) tops = tops.flatMap((r) => subtractRect(r, h))
  for (const r of tops) b.box([r.x1, body, r.z1], [r.x2, top, r.z2], m.stoneTop)

  // shutters on the parts of the front not hidden by an adjoining counter
  const frontLine = (() => {
    const p = F.box(u0, u1, 0, 1, D, D)
    return F.alongX ? p.min[2] : p.min[0]
  })()
  const blocked: [number, number][] = planC.fixtures
    .filter((o) => o !== f && o.type === 'kitchenCounter')
    .filter((o) => (F.alongX ? o.rect.z1 - TOL <= frontLine && o.rect.z2 + TOL >= frontLine : o.rect.x1 - TOL <= frontLine && o.rect.x2 + TOL >= frontLine))
    .map((o) => F.uOf(o.rect))
  const segs = subtractIntervals(u0, u1, blocked)
  const g = 0.3
  for (const [a, c] of segs) {
    const n = Math.max(1, Math.round((c - a) / 55))
    const pw = (c - a) / n
    for (let i = 0; i < n; i++) {
      const pa = a + i * pw + g
      const pb = a + (i + 1) * pw - g
      // drawer + door
      b.b(F.box(pa, pb, body - 15, body - 0.5, D - 3, D - 1.2), m.kitchenCabinet)
      b.b(F.box(pa, pb, 10.5, body - 15 - 2 * g, D - 3, D - 1.2), m.kitchenCabinet)
      // handles: slim brushed profiles
      const mid = (pa + pb) / 2
      b.b(F.box(mid - 12, mid + 12, body - 4, body - 2.8, D - 1.2, D + 0.6), m.metal)
      b.b(F.box(mid - 12, mid + 12, body - 20, body - 18.8, D - 1.2, D + 0.6), m.metal)
    }
  }

  // backsplash (quartz, 1 cm) between counter and wall cabinets, cut around windows
  const ops = wallOpeningsOnLine(edge, F.wallLine).filter((o) => o.to > u0 && o.from < u1)
  const wins = ops.filter((o) => o.kind === 'window')
  for (const [a, c] of subtractIntervals(u0, u1, wins.map((o) => [o.from, o.to]))) b.b(F.box(a, c, top, 150, 0, 1), m.stoneTop)
  for (const o of wins) if (o.sill > top) b.b(F.box(Math.max(o.from, u0), Math.min(o.to, u1), top, o.sill - 2.5, 0, 1), m.stoneTop)

  // wall cabinets (60 cm above the top, 35 deep, 70 high), skipping the chimney and windows
  const chim = planC.fixtures.filter((c) => c.type === 'chimney' && c.room === f.room).map((c) => F.uOf(c.rect))
  const winU = wins.filter((o) => o.head > 150 && o.sill < 220).map((o) => [o.from, o.to] as [number, number])
  const wy0 = 150
  const wy1 = 220
  const wd = 35
  for (const [a, c] of subtractIntervals(u0, u1, [...chim, ...winU])) {
    if (c - a < 25) continue
    b.b(F.box(a, c, wy0, wy1, 1, wd - 1.8), m.kitchenCabinet)
    const n = Math.max(1, Math.round((c - a) / 50))
    const pw = (c - a) / n
    for (let i = 0; i < n; i++) {
      const pa = a + i * pw + g
      const pb = a + (i + 1) * pw - g
      b.b(F.box(pa, pb, wy0 + g, wy1 - g, wd - 1.8, wd), m.kitchenCabinet)
      const hx = i % 2 === 0 ? pb - 6 : pa + 3
      b.b(F.box(hx, hx + 3, wy0 + 2, wy0 + 3.2, wd, wd + 1.6), m.metal)
    }
    // LED strip under the cabinets
    b.b(F.box(a + 2, c - 2, wy0 - 0.4, wy0, wd - 6, wd - 4), lm.chrome)
  }
}

// ---------------------------------------------------------------------------------------------
// Sink (bowl + tap), hob, chimney

/** The kitchen counter a sink / hob sits in. */
function hostCounter(f: Fixture) {
  return planC.fixtures.find((c) => c.type === 'kitchenCounter' && overlaps(c.rect, f.rect))
}

function buildSink(b: GeoBuilder, f: Fixture) {
  const m = getMaterials()
  const lm = localMaterials()
  const host = hostCounter(f)
  const top = f.y ?? 90
  const R = f.rect
  const h = { x1: R.x1 + 2.5, z1: R.z1 + 2.5, x2: R.x2 - 2.5, z2: R.z2 - 2.5 }
  const depth = 20
  const t = 0.8
  // rim
  for (const r of subtractRect(R, h)) b.box([r.x1, top, r.z1], [r.x2, top + 0.25, r.z2], m.metal)
  // bowl walls + floor
  const yb = top - depth
  b.box([h.x1, yb, h.z1], [h.x2, top, h.z1 + t], m.metal)
  b.box([h.x1, yb, h.z2 - t], [h.x2, top, h.z2], m.metal)
  b.box([h.x1, yb, h.z1], [h.x1 + t, top, h.z2], m.metal)
  b.box([h.x2 - t, yb, h.z1], [h.x2, top, h.z2], m.metal)
  b.box([h.x1, yb - t, h.z1], [h.x2, yb, h.z2], m.metal)
  const cx = (h.x1 + h.x2) / 2
  const cz = (h.z1 + h.z2) / 2
  b.box([cx - 4, yb, cz - 4], [cx + 4, yb + 0.3, cz + 4], lm.grout) // drain
  // tap at the back (wall side)
  if (host) {
    const F = fxFrame(R, wallEdge(host.rect, roomOf(host)))
    const uc = (F.u0 + F.u1) / 2
    const vb = -2 // just behind the sink rim, on the stone top
    b.b(F.box(uc - 2.5, uc + 2.5, top, top + 3, vb - 2.5, vb + 2.5), lm.chrome)
    b.b(F.box(uc - 1.3, uc + 1.3, top + 3, top + 32, vb - 1.3, vb + 1.3), lm.chrome)
    b.b(F.box(uc - 1.3, uc + 1.3, top + 29.5, top + 32, vb, vb + 20), lm.chrome)
    b.b(F.box(uc - 1.3, uc + 1.3, top + 25, top + 32, vb + 17.5, vb + 20), lm.chrome)
    b.b(F.box(uc + 1.3, uc + 9, top + 16, top + 17.5, vb - 0.8, vb + 0.8), lm.chrome) // lever
  }
}

function Hob({ f, cut }: { f: Fixture; cut: number }) {
  const lm = localMaterials()
  const m = getMaterials()
  const y = f.y ?? 90
  const built = useBuilt((b) => b.box([f.rect.x1, y, f.rect.z1], [f.rect.x2, y + 0.8, f.rect.z2], lm.blackGlass), cut, [f])
  // memoised so the burner layout below is not recomputed on every render
  const F = useMemo(() => {
    const host = hostCounter(f)
    return fxFrame(f.rect, host ? wallEdge(host.rect, roomOf(host)) : 'x1')
  }, [f])
  const burners = useMemo(() => {
    const out: { p: [number, number, number]; r: number }[] = []
    const us = [F.u0 + (F.u1 - F.u0) * 0.28, F.u0 + (F.u1 - F.u0) * 0.72]
    const vs = [F.D * 0.3, F.D * 0.68]
    us.forEach((u, i) => vs.forEach((v, j) => out.push({ p: F.pos(u, y + 0.8, v), r: (i + j) % 2 ? 5.5 : 4 })))
    return out
  }, [F, y])
  const tag = tagOf(f)
  if (y >= cut) return null
  return (
    <group>
      <BMesh built={built} tag={tag} />
      {burners.map((bn, i) => (
        <group key={i} position={bn.p}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.006} material={lm.grout} userData={tag} castShadow>
            <torusGeometry args={[toM(bn.r), toM(0.9), 8, 32]} />
          </mesh>
          <mesh position-y={0.008} material={lm.blackGlass} userData={tag}>
            <cylinderGeometry args={[toM(bn.r * 0.55), toM(bn.r * 0.6), toM(1.6), 24]} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position-y={0.018} rotation-y={(k * Math.PI) / 2} material={lm.grout} userData={tag}>
              <boxGeometry args={[toM(bn.r * 2.6), toM(0.8), toM(0.8)]} />
            </mesh>
          ))}
        </group>
      ))}
      {[0.2, 0.4, 0.6, 0.8].map((k, i) => (
        <mesh key={i} position={F.pos(F.u0 + (F.u1 - F.u0) * k, y + 1.4, F.D - 4)} material={m.metal} userData={tag}>
          <cylinderGeometry args={[toM(1.6), toM(1.8), toM(1.4), 16]} />
        </mesh>
      ))}
    </group>
  )
}

function buildChimney(b: GeoBuilder, f: Fixture) {
  const m = getMaterials()
  const lm = localMaterials()
  const F = fxFrame(f.rect, wallEdge(f.rect, roomOf(f)))
  const y0 = f.y ?? 165
  const y1 = y0 + f.height
  const uc = (F.u0 + F.u1) / 2
  const L = F.u1 - F.u0
  // hood canopy, black-glass front visor, body and duct to the ceiling
  b.b(F.box(F.u0, F.u1, y0, y0 + 8, 0, F.D), m.metal)
  b.b(F.box(F.u0 + 1, F.u1 - 1, y0 + 8, y0 + 30, F.D - 18, F.D - 2), lm.blackGlass)
  b.b(F.box(uc - L * 0.28, uc + L * 0.28, y0 + 8, y1, 0, 30), m.metal)
  b.b(F.box(uc - 13, uc + 13, y1, planC.ceilingHeight, 0, 25), m.metal)
  b.b(F.box(F.u0 + 2, F.u1 - 2, y0 - 0.3, y0, 4, F.D - 4), lm.grout) // filter
  for (let i = 0; i < 3; i++) b.b(F.box(uc - 9 + i * 7, uc - 5 + i * 7, y0 + 2, y0 + 5, F.D, F.D + 0.5), lm.chrome)
}

// ---------------------------------------------------------------------------------------------
// Breakfast counter

function buildBreakfast(b: GeoBuilder, f: Fixture) {
  const m = getMaterials()
  const R = f.rect
  const top = f.height
  const st = 3
  // body sits on the kitchen side; stone top overhangs 18 cm toward the hall for knee space
  const zb = R.z1 + 18
  b.box([R.x1, 0, zb + 3], [R.x2 - 4, 8, R.z2 - 3], m.blackMetal)
  b.box([R.x1, 8, zb], [R.x2 - 4, top - st, R.z2], m.woodVeneer)
  // fluted veneer battens on the hall face
  for (let x = R.x1 + 6; x < R.x2 - 8; x += 9) b.box([x, 10, zb - 1], [x + 5, top - st - 2, zb], m.woodVeneer)
  // waterfall end panel
  b.box([R.x2 - 4, 0, R.z1], [R.x2, top - st, R.z2], m.woodVeneer)
  b.box([R.x1, top - st, R.z1], [R.x2, top, R.z2], m.stoneTop)
}

// ---------------------------------------------------------------------------------------------
// Vanity + mirror

function Vanity({ f, cut }: { f: Fixture; cut: number }) {
  const room = roomOf(f)
  const edge = wallEdge(f.rect, room)
  const F = fxFrame(f.rect, edge)
  const tiled = room.floor === 'toiletTile'
  const v0 = tiled ? 1 : 0
  const top = f.height
  const built = useBuilt(
    (b) => {
      const m = getMaterials()
      const lm = localMaterials()
      const { u0, u1, D } = F
      // wall-hung cabinet with a drawer line
      b.b(F.box(u0 + 0.5, u1 - 0.5, 45, top - 3, v0, D - 2), m.woodVeneer)
      b.b(F.box(u0 + 0.5, u1 - 0.5, top - 17, top - 16.6, D - 2, D - 1.8), m.darkWood)
      b.b(F.box(u0, u1, top - 3, top, v0, D), m.stoneTop)
      // tall vessel mixer at the back
      const uc = (u0 + u1) / 2
      const vb = v0 + 6
      b.b(F.box(uc - 2, uc + 2, top, top + 2, vb - 2, vb + 2), lm.chrome)
      b.b(F.box(uc - 1.2, uc + 1.2, top + 2, top + 30, vb - 1.2, vb + 1.2), lm.chrome)
      b.b(F.box(uc - 1.2, uc + 1.2, top + 27.5, top + 30, vb, vb + 13), lm.chrome)
      b.b(F.box(uc - 1.2, uc + 1.2, top + 25, top + 30, vb + 11, vb + 13), lm.chrome)
      b.b(F.box(uc - 0.6, uc + 0.6, top + 30, top + 37, vb - 0.6, vb + 0.6), lm.chrome)
      // mirror with a slim black frame
      const mw = Math.max(45, Math.min(70, u1 - u0 + 10)) / 2
      b.b(F.box(uc - mw, uc + mw, 112, 192, v0, v0 + 1.6), m.blackMetal)
      b.b(F.box(uc - mw + 1.2, uc + mw - 1.2, 113.2, 190.8, v0 + 1.6, v0 + 2), lm.mirror)
    },
    cut,
    [f],
  )
  // vessel basin (lathe)
  const r = Math.min(F.u1 - F.u0, F.D) * 0.36
  const lathe = useMemo(() => {
    const pts = [
      [0, 0],
      [r * 0.55, 0],
      [r * 0.92, 6],
      [r, 14],
      [r - 0.8, 14],
      [r * 0.92 - 0.8, 6],
      [r * 0.55 - 0.6, 1.2],
      [0, 1.2],
    ].map(([x, y]) => new THREE.Vector2(toM(x), toM(y)))
    return new THREE.LatheGeometry(pts, 40)
  }, [r])
  useEffect(() => () => lathe.dispose(), [lathe])
  const uc = (F.u0 + F.u1) / 2
  const tag = tagOf(f)
  return (
    <group>
      <BMesh built={built} tag={tag} />
      {top < cut && (
        <mesh geometry={lathe} position={F.pos(uc, top, v0 + F.D * 0.55)} material={getMaterials().ceramic} userData={tag} castShadow receiveShadow />
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Wall-hung WC with concealed cistern

function Wc({ f, cut }: { f: Fixture; cut: number }) {
  const room = roomOf(f)
  const F = fxFrame(f.rect, wallEdge(f.rect, room))
  const ledge = 16
  const built = useBuilt(
    (b) => {
      const m = getMaterials()
      const lm = localMaterials()
      const { u0, u1 } = F
      const uc = (u0 + u1) / 2
      // tiled ledge hiding the cistern, quartz cap, flush plate
      b.b(F.box(u0 - 12, u1 + 12, 0, 105, 0, ledge), (fc) => (fc === 'ny' ? null : m.toiletTile))
      b.b(F.box(u0 - 12.5, u1 + 12.5, 105, 107, 0, ledge + 1), m.stoneTop)
      b.b(F.box(uc - 12, uc + 12, 84, 100, ledge, ledge + 0.6), lm.chrome)
      b.b(F.box(uc - 11, uc - 0.5, 85, 99, ledge + 0.6, ledge + 0.9), m.ceramic)
      b.b(F.box(uc + 0.5, uc + 11, 85, 99, ledge + 0.6, ledge + 0.9), m.ceramic)
      // bowl back block
      b.b(F.box(uc - 13, uc + 13, 22, 40, ledge, ledge + 14), m.ceramic)
    },
    cut,
    [f],
  )
  const uc = (F.u0 + F.u1) / 2
  const hv = (F.D - ledge) / 2 - 0.5
  const hu = (F.u1 - F.u0) / 2 - 1
  const [sx, sz] = F.scaleXZ(toM(hu), toM(hv))
  const c = F.pos(uc, 0, ledge + hv)
  const tag = tagOf(f)
  const m = getMaterials()
  return (
    <group>
      <BMesh built={built} tag={tag} />
      {0 < cut && (
        <>
          <mesh position={[c[0], toM(30), c[2]]} scale={[sx, toM(20), sz]} material={m.ceramic} userData={tag} castShadow receiveShadow>
            <cylinderGeometry args={[1, 0.78, 1, 40]} />
          </mesh>
          <mesh position={[c[0], toM(41.5), c[2]]} scale={[sx * 1.02, toM(3), sz * 1.02]} material={m.ceramic} userData={tag} castShadow>
            <cylinderGeometry args={[0.97, 1, 1, 40]} />
          </mesh>
        </>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Shower: glass partition, drain, rain shower

function buildShowerGlass(b: GeoBuilder, f: Fixture) {
  const m = getMaterials()
  const lm = localMaterials()
  const R = f.rect
  const room = roomOf(f).rect
  const alongZ = R.z2 - R.z1 > R.x2 - R.x1
  const H = f.height
  if (alongZ) {
    const cx = (R.x1 + R.x2) / 2
    b.box([cx - 0.5, 2, R.z1], [cx + 0.5, H, R.z2], m.glass)
    const wallEnd = Math.abs(R.z1 - room.z1) <= TOL ? R.z1 : R.z2
    const s = wallEnd === R.z1 ? 1 : -1
    b.box([cx - 1.5, 0, Math.min(wallEnd, wallEnd + s * 2.5)], [cx + 1.5, H, Math.max(wallEnd, wallEnd + s * 2.5)], lm.chrome)
    b.box([cx - 1.2, 0, R.z1], [cx + 1.2, 2, R.z2], lm.chrome) // floor channel
  } else {
    const cz = (R.z1 + R.z2) / 2
    b.box([R.x1, 2, cz - 0.5], [R.x2, H, cz + 0.5], m.glass)
    const wallEnd = Math.abs(R.x1 - room.x1) <= TOL ? R.x1 : R.x2
    const s = wallEnd === R.x1 ? 1 : -1
    b.box([Math.min(wallEnd, wallEnd + s * 2.5), 0, cz - 1.5], [Math.max(wallEnd, wallEnd + s * 2.5), H, cz + 1.5], lm.chrome)
    b.box([R.x1, 0, cz - 1.2], [R.x2, 2, cz + 1.2], lm.chrome)
  }
}

function ShowerDrain({ f, cut }: { f: Fixture; cut: number }) {
  const room = roomOf(f)
  const glass = planC.fixtures.find((g) => g.type === 'showerGlass' && g.room === f.room)
  // shower wall = the room edge the glass partition starts from
  const edge: Edge = (() => {
    if (!glass) return 'z1'
    const R = room.rect
    const G = glass.rect
    for (const e of ['z1', 'z2', 'x1', 'x2'] as Edge[]) if (Math.abs(G[e] - R[e]) <= TOL) return e
    return 'z1'
  })()
  const F = fxFrame(room.rect, edge)
  const uc = edge === 'z1' || edge === 'z2' ? (f.rect.x1 + f.rect.x2) / 2 : (f.rect.z1 + f.rect.z2) / 2
  const built = useBuilt(
    (b) => {
      const m = getMaterials()
      const lm = localMaterials()
      const R = f.rect
      const h = f.height
      b.box([R.x1, 0, R.z1], [R.x2, h, R.z2], m.metal)
      const n = 5
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n
        const x = R.x1 + 2 + (R.x2 - R.x1 - 4) * t
        b.box([x - 0.4, h, R.z1 + 2], [x + 0.4, h + 0.05, R.z2 - 2], lm.grout)
      }
      // concealed mixer + riser + rain-shower arm on the shower wall (1 cm tile skin)
      const v = 1
      b.b(F.box(uc - 8, uc + 8, 102, 118, v, v + 0.8), lm.chrome)
      b.b(F.box(uc - 1, uc + 1, 109, 111, v + 0.8, v + 6), lm.chrome)
      b.b(F.box(uc + 1, uc + 9, 109, 111, v + 4.5, v + 6.5), lm.chrome)
      b.b(F.box(uc - 1.1, uc + 1.1, 118, 214, v + 3, v + 5.2), lm.chrome)
      b.b(F.box(uc - 1.1, uc + 1.1, 212, 214.2, v + 3, v + 40), lm.chrome)
      // hand shower holder
      b.b(F.box(uc + 6, uc + 9, 125, 150, v, v + 4), lm.chrome)
    },
    cut,
    [f, edge],
  )
  const tag = tagOf(f)
  return (
    <group>
      <BMesh built={built} tag={tag} />
      {212 < cut && (
        <mesh position={F.pos(uc, 211, 1 + 40)} material={localMaterials().chrome} userData={tag} castShadow>
          <cylinderGeometry args={[toM(12), toM(12), toM(1.2), 40]} />
        </mesh>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Planter with stylised shrubs

function Planter({ f, cut }: { f: Fixture; cut: number }) {
  const R = f.rect
  const H = f.height
  const built = useBuilt(
    (b) => {
      const m = getMaterials()
      const t = 5
      b.box([R.x1, 0, R.z1], [R.x2, H, R.z1 + t], m.wallPaint)
      b.box([R.x1, 0, R.z2 - t], [R.x2, H, R.z2], m.wallPaint)
      b.box([R.x1, 0, R.z1 + t], [R.x1 + t, H, R.z2 - t], m.wallPaint)
      b.box([R.x2 - t, 0, R.z1 + t], [R.x2, H, R.z2 - t], m.wallPaint)
      b.box([R.x1 + t, 0, R.z1 + t], [R.x2 - t, H - 6, R.z2 - t], m.soil)
    },
    cut,
    [f],
  )
  const spheres = useMemo(() => {
    let seed = f.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    const out: { p: THREE.Vector3; s: number }[] = []
    const alongZ = R.z2 - R.z1 > R.x2 - R.x1
    const L = alongZ ? R.z2 - R.z1 : R.x2 - R.x1
    const n = Math.max(2, Math.round(L / 34))
    for (let i = 0; i < n; i++) {
      const a = (alongZ ? R.z1 : R.x1) + ((i + 0.5) * L) / n
      const c = alongZ ? (R.x1 + R.x2) / 2 : (R.z1 + R.z2) / 2
      const big = 13 + rnd() * 6
      for (let k = 0; k < 6; k++) {
        const s = big * (k === 0 ? 1 : 0.55 + rnd() * 0.35)
        const da = (rnd() - 0.5) * 22
        const dc = (rnd() - 0.5) * 22
        const y = H - 4 + s * 0.7 + (k === 0 ? 8 : rnd() * 18)
        const pa = a + da
        const pc = c + dc
        out.push({ p: new THREE.Vector3(toM(alongZ ? pc : pa), toM(y), toM(alongZ ? pa : pc)), s: toM(s) })
      }
    }
    return out
  }, [f, R, H])
  const inst = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 2)
    const mesh = new THREE.InstancedMesh(geo, getMaterials().plant, spheres.length)
    const mtx = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    spheres.forEach((sp, i) => {
      mtx.compose(sp.p, q, new THREE.Vector3(sp.s, sp.s * 0.85, sp.s))
      mesh.setMatrixAt(i, mtx)
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData = tagOf(f)
    return mesh
  }, [spheres, f])
  // the plant material is a shared getMaterials() singleton: only the geometry is ours to dispose
  useEffect(() => () => inst.geometry.dispose(), [inst])
  return (
    <group>
      <BMesh built={built} tag={tagOf(f)} />
      {cut > H && <primitive object={inst} />}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------

/** A fixture that is just one useBuilt mesh from a build function. */
function Generic({ f, cut, fn }: { f: Fixture; cut: number; fn: (b: GeoBuilder, f: Fixture) => void }) {
  const built = useBuilt((b) => fn(b, f), cut, [f, fn])
  return <BMesh built={built} tag={tagOf(f)} />
}

/** Every fixture of the plan. */
export default function Fixtures() {
  const cut = useCut()
  return (
    <group name="fixtures">
      {planC.fixtures.map((f) => {
        switch (f.type) {
          case 'kitchenCounter':
            return <Generic key={f.id} f={f} cut={cut} fn={buildCounter} />
          case 'sink':
            return <Generic key={f.id} f={f} cut={cut} fn={buildSink} />
          case 'chimney':
            return <Generic key={f.id} f={f} cut={cut} fn={buildChimney} />
          case 'breakfastCounter':
            return <Generic key={f.id} f={f} cut={cut} fn={buildBreakfast} />
          case 'showerGlass':
            return <Generic key={f.id} f={f} cut={cut} fn={buildShowerGlass} />
          case 'hob':
            return <Hob key={f.id} f={f} cut={cut} />
          case 'vanity':
            return <Vanity key={f.id} f={f} cut={cut} />
          case 'wc':
            return <Wc key={f.id} f={f} cut={cut} />
          case 'showerDrain':
            return <ShowerDrain key={f.id} f={f} cut={cut} />
          case 'planter':
            return <Planter key={f.id} f={f} cut={cut} />
          default:
            return null
        }
      })}
    </group>
  )
}
