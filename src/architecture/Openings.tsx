// Doors (animated, click to toggle), main door, sliding glass doors, windows and ventilators for every
// opening in planC. Open state comes from the store (doorsOpen); frames and leaves are tagged as their wall.
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import planC from '../data/planC'
import type { Opening, Wall } from '../data/schema'
import { toM } from '../data/schema'
import { getMaterials } from '../materials/materials'
import { isDoorOpen, useStore } from '../store'
import type { GeoBuilder } from './builder'
import { BMesh, localMaterials, useBuilt, useCut, wallFrame } from './common'

type Frame = ReturnType<typeof wallFrame>

/** Click handler that toggles a door/slider only for real clicks (not drags). */
function useToggle(id: string) {
  const toggleDoor = useStore((s) => s.toggleDoor)
  return (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 5) return
    e.stopPropagation()
    toggleDoor(id)
  }
}

/** Smoothly animated 0..1 open factor for an opening. */
function useOpenFactor(id: string) {
  const open = useStore((s) => isDoorOpen(s.doorsOpen, id))
  const k = useRef(open ? 1 : 0)
  return { open, k }
}

/** One animation step toward `target`: exponential ease plus a small constant so it actually arrives. */
const step = (cur: number, target: number, dt: number, speed = 3) => {
  const d = target - cur
  if (Math.abs(d) < 1e-4) return target
  return cur + d * Math.min(1, dt * speed + 0.02)
}

// --------------------------------------------------------------------------------------------
// Hinged doors

function DoorFrame({ w, o, fr, F, cut }: { w: Wall; o: Opening; fr: Frame; F: number; cut: number }) {
  const built = useBuilt(
    (b) => {
      const m = getMaterials()
      const t0 = fr.t0 - 1
      const t1 = fr.t1 + 1
      // jambs + head (frame lining the opening, 1 cm proud of both faces)
      b.b(fr.box(o.from, o.from + F, 0, o.head, t0, t1), m.darkWood)
      b.b(fr.box(o.to - F, o.to, 0, o.head, t0, t1), m.darkWood)
      b.b(fr.box(o.from + F, o.to - F, o.head - F, o.head, t0, t1), m.darkWood)
      // architraves on both faces
      const A = 6
      for (const [a, c] of [
        [fr.t0 - 1.6, fr.t0],
        [fr.t1, fr.t1 + 1.6],
      ]) {
        // overlap the jamb by 3 mm so the trim's inner face never coincides with tile/skirting end faces
        b.b(fr.box(o.from - A, o.from + 0.3, 0, o.head + A, a, c), m.darkWood)
        b.b(fr.box(o.to - 0.3, o.to + A, 0, o.head + A, a, c), m.darkWood)
        b.b(fr.box(o.from, o.to, o.head, o.head + A, a, c), m.darkWood)
      }
    },
    cut,
    [w, o],
  )
  return <BMesh built={built} tag={{ kind: 'wall', wallId: w.id }} />
}

function buildLeaf(b: GeoBuilder, W: number, H: number, T: number, main: boolean, sz: number) {
  const m = getMaterials()
  const lm = localMaterials()
  b.box([0, 1, -T / 2], [W, H, T / 2], m.darkWood)
  const hy = 102
  if (main) {
    // coordinates below assume +z = inside (swing side); Z() mirrors when it isn't
    const Z = (a: number, c: number): [number, number] => (sz > 0 ? [a, c] : [-c, -a])
    const bz = (x0: number, x1: number, y0: number, y1: number, za: number, zb: number, mat: THREE.Material) => {
      const [z0, z1] = Z(za, zb)
      b.box([x0, y0, z0], [x1, y1, z1], mat)
    }
    // grooved panels: thin dark-metal inlays on both faces
    for (const [za, zb] of [
      [T / 2, T / 2 + 0.25],
      [-T / 2 - 0.25, -T / 2],
    ]) {
      for (const y of [40, 80, 120, 160]) bz(8, W - 8, y, y + 0.8, za, zb, m.blackMetal)
    }
    // long pull handle on the outside face
    bz(W - 12, W - 9, 70, 150, -T / 2 - 6, -T / 2 - 3, lm.chrome)
    bz(W - 12, W - 9, 76, 79, -T / 2 - 3, -T / 2, lm.chrome)
    bz(W - 12, W - 9, 141, 144, -T / 2 - 3, -T / 2, lm.chrome)
    // inside lever + lock plate
    bz(W - 9, W - 4, hy - 6, hy + 8, T / 2, T / 2 + 1, lm.chrome)
    bz(W - 19, W - 6, hy, hy + 2, T / 2 + 4, T / 2 + 6, lm.chrome)
    bz(W - 7.5, W - 5.5, hy, hy + 2, T / 2 + 1, T / 2 + 6, lm.chrome)
    // peephole
    bz(W / 2 - 1, W / 2 + 1, 155, 157, -T / 2 - 0.6, T / 2 + 0.6, lm.chrome)
  } else {
    for (const s of [1, -1]) {
      const z0 = s > 0 ? T / 2 : -T / 2
      b.box([W - 8, hy - 7, Math.min(z0, z0 + s)], [W - 4, hy + 9, Math.max(z0, z0 + s)], m.metal) // rose plate
      const za = z0 + s * 1
      const zb = z0 + s * 5.5
      b.box([W - 7, hy, Math.min(za, zb)], [W - 5, hy + 2, Math.max(za, zb)], m.metal) // neck
      const zc = z0 + s * 4
      b.box([W - 18, hy, Math.min(zc, zb)], [W - 5, hy + 2, Math.max(zc, zb)], m.metal) // lever
    }
  }
}

/**
 * Hinged door. The leaf is built in leaf-local cm (x along the leaf from the hinge, z across) inside a
 * group at the hinge that rotates about y. thC is the closed angle (leaf pointing along the wall away
 * from the hinge); `diff` the signed turn toward the swing side, wrapped to ±180° and stopped at 97 %.
 */
function HingedDoor({ w, o, cut }: { w: Wall; o: Opening; cut: number }) {
  const fr = wallFrame(w)
  const main = o.kind === 'mainDoor'
  const F = main ? 6 : 4
  const T = main ? 5 : 4
  const hingeAtFrom = (o.hinge ?? 'from') === 'from'
  const swing = o.swing ?? 1
  const sH = hingeAtFrom ? o.from + F + 0.3 : o.to - F - 0.3
  const W = o.to - o.from - 2 * F - 0.6
  const H = o.head - F - 0.3
  const swingFace = swing > 0 ? fr.t1 : fr.t0
  const tP = swingFace - swing * (T / 2 + 1.5)
  const p = fr.pt(sH, tP)
  const dir = hingeAtFrom ? 1 : -1
  const dClosed = { x: fr.sDir.x * dir, z: fr.sDir.z * dir }
  const dOpen = { x: fr.tDir.x * swing, z: fr.tDir.z * swing }
  const thC = Math.atan2(-dClosed.z, dClosed.x)
  let diff = Math.atan2(-dOpen.z, dOpen.x) - thC
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)) * 0.97 // stop just short of the wall
  // which leaf-local z side faces the swing side (inside for the main door)
  const sz = Math.sin(thC) * dOpen.x + Math.cos(thC) * dOpen.z >= 0 ? 1 : -1

  const { open, k } = useOpenFactor(o.id)
  const group = useRef<THREE.Group>(null)
  useFrame((state, dt) => {
    k.current = step(k.current, open ? 1 : 0, dt)
    if (group.current) group.current.rotation.y = thC + diff * k.current
    if (k.current !== (open ? 1 : 0)) state.invalidate() // on-demand rendering: keep animating
  })
  const onClick = useToggle(o.id)
  const leaf = useBuilt((b) => buildLeaf(b, W, H, T, main, sz), cut, [W, H, T, main, sz])
  return (
    <>
      <DoorFrame w={w} o={o} fr={fr} F={F} cut={cut} />
      <group ref={group} position={[toM(p.x), 0, toM(p.z)]} rotation-y={thC + diff * k.current} onClick={onClick}>
        <BMesh built={leaf} tag={{ kind: 'wall', wallId: w.id }} />
      </group>
    </>
  )
}

// --------------------------------------------------------------------------------------------
// Sliding glass doors

/** Two-panel sliding glass door: panel A slides over panel B along the wall when opened. */
function SlidingDoor({ w, o, cut }: { w: Wall; o: Opening; cut: number }) {
  const fr = wallFrame(w)
  const F = 5
  const W = o.to - o.from
  const PW = (W - 2 * F) / 2 + 4 // panel width incl. overlap
  const travel = W - 2 * F - PW - 2
  const tc = fr.tc
  const depth = Math.min(fr.thick, 12) / 2

  const frame = useBuilt(
    (b) => {
      const m = getMaterials()
      b.b(fr.box(o.from, o.from + F, 0, o.head, tc - depth, tc + depth), m.blackMetal)
      b.b(fr.box(o.to - F, o.to, 0, o.head, tc - depth, tc + depth), m.blackMetal)
      b.b(fr.box(o.from + F, o.to - F, o.head - F, o.head, tc - depth, tc + depth), m.blackMetal)
      b.b(fr.box(o.from + F, o.to - F, 0, 1.2, tc - depth, tc + depth), m.blackMetal) // bottom track
    },
    cut,
    [w, o],
  )

  const panel = (b: GeoBuilder, s0: number, tMid: number) => {
    const m = getMaterials()
    const lm = localMaterials()
    const P = 5
    const y0 = 1.2
    const y1 = o.head - F
    const s1 = s0 + PW
    const [ta, tb] = [tMid - 1.6, tMid + 1.6]
    b.b(fr.box(s0, s0 + P, y0, y1, ta, tb), m.blackMetal)
    b.b(fr.box(s1 - P, s1, y0, y1, ta, tb), m.blackMetal)
    b.b(fr.box(s0 + P, s1 - P, y0, y0 + 8, ta, tb), m.blackMetal)
    b.b(fr.box(s0 + P, s1 - P, y1 - P, y1, ta, tb), m.blackMetal)
    b.b(fr.box(s0 + P, s1 - P, y0 + 8, y1 - P, tMid - 0.4, tMid + 0.4), m.glass)
    // slim pull handles on the meeting stile side
    b.b(fr.box(s0 + 1.5, s0 + 3.5, 90, 130, ta - 2.5, ta), lm.chrome)
    b.b(fr.box(s0 + 1.5, s0 + 3.5, 90, 130, tb, tb + 2.5), lm.chrome)
  }
  // Panel A (from side, slides toward `to`, inner track) and panel B (fixed-ish, outer track)
  const pa = useBuilt((b) => panel(b, o.from + F, tc - 2), cut, [w, o])
  const pb = useBuilt((b) => panel(b, o.to - F - PW, tc + 2), cut, [w, o])

  const { open, k } = useOpenFactor(o.id)
  const ga = useRef<THREE.Group>(null)
  useFrame((state, dt) => {
    k.current = step(k.current, open ? 1 : 0, dt, 2.5)
    if (k.current !== (open ? 1 : 0)) state.invalidate() // on-demand rendering: keep animating
    if (ga.current) {
      const d = toM(travel * k.current)
      ga.current.position.set(fr.sDir.x * d, 0, fr.sDir.z * d)
    }
  })
  const onClick = useToggle(o.id)
  return (
    <>
      <BMesh built={frame} tag={{ kind: 'wall', wallId: w.id }} />
      <group ref={ga} onClick={onClick}>
        <BMesh built={pa} tag={{ kind: 'wall', wallId: w.id }} />
      </group>
      <group onClick={onClick}>
        <BMesh built={pb} tag={{ kind: 'wall', wallId: w.id }} />
      </group>
    </>
  )
}

// --------------------------------------------------------------------------------------------
// Windows / ventilators

/** Two-sash sliding window with a marble sill, or a louvred ventilator. */
function Window({ w, o, cut }: { w: Wall; o: Opening; cut: number }) {
  const fr = wallFrame(w)
  const built = useBuilt(
    (b) => {
      const m = getMaterials()
      const lm = localMaterials()
      const tc = fr.tc
      if (o.kind === 'window') {
        const F = 5
        const d = 4.5
        // outer frame
        b.b(fr.box(o.from, o.from + F, o.sill, o.head, tc - d, tc + d), m.blackMetal)
        b.b(fr.box(o.to - F, o.to, o.sill, o.head, tc - d, tc + d), m.blackMetal)
        b.b(fr.box(o.from + F, o.to - F, o.sill, o.sill + F, tc - d, tc + d), m.blackMetal)
        b.b(fr.box(o.from + F, o.to - F, o.head - F, o.head, tc - d, tc + d), m.blackMetal)
        // two sliding sashes on two tracks
        const inner = o.to - o.from - 2 * F
        const SW = inner / 2 + 3
        const S = 4
        const sash = (s0: number, t: number) => {
          const s1 = s0 + SW
          const y0 = o.sill + F
          const y1 = o.head - F
          b.b(fr.box(s0, s0 + S, y0, y1, t - 1.4, t + 1.4), m.blackMetal)
          b.b(fr.box(s1 - S, s1, y0, y1, t - 1.4, t + 1.4), m.blackMetal)
          b.b(fr.box(s0 + S, s1 - S, y0, y0 + S, t - 1.4, t + 1.4), m.blackMetal)
          b.b(fr.box(s0 + S, s1 - S, y1 - S, y1, t - 1.4, t + 1.4), m.blackMetal)
          b.b(fr.box(s0 + S, s1 - S, y0 + S, y1 - S, t - 0.3, t + 0.3), m.glass)
        }
        sash(o.from + F, tc - 1.6)
        sash(o.to - F - SW, tc + 1.6)
        // marble sill, proud of both faces
        if (o.sill > 0) b.b(fr.box(o.from - 3, o.to + 3, o.sill - 2, o.sill + 0.5, fr.t0 - 3, fr.t1 + 3), m.stoneTop)
      } else {
        // ventilator: aluminium frame, frosted louvres
        const F = 3
        const d = 3
        b.b(fr.box(o.from, o.from + F, o.sill, o.head, tc - d, tc + d), m.blackMetal)
        b.b(fr.box(o.to - F, o.to, o.sill, o.head, tc - d, tc + d), m.blackMetal)
        b.b(fr.box(o.from + F, o.to - F, o.sill, o.sill + F, tc - d, tc + d), m.blackMetal)
        b.b(fr.box(o.from + F, o.to - F, o.head - F, o.head, tc - d, tc + d), m.blackMetal)
        const n = 5
        const h = (o.head - o.sill - 2 * F) / n
        for (let i = 0; i < n; i++) {
          const y = o.sill + F + i * h
          // stepped slats approximate tilted louvres
          b.b(fr.box(o.from + F, o.to - F, y + 0.5, y + h, tc - 0.3 - 1.2, tc + 0.3 - 1.2), lm.frosted)
          b.b(fr.box(o.from + F, o.to - F, y, y + 0.6, tc - 2.5, tc + 2.5), m.blackMetal)
        }
      }
    },
    cut,
    [w, o],
  )
  return <BMesh built={built} tag={{ kind: 'wall', wallId: w.id }} />
}

/** The leaf / frame / glazing of every opening in the plan. */
export default function Openings() {
  const cut = useCut()
  return (
    <group name="openings">
      {planC.walls.flatMap((w) =>
        (w.openings ?? []).map((o) => {
          switch (o.kind) {
            case 'door':
            case 'mainDoor':
              return <HingedDoor key={o.id} w={w} o={o} cut={cut} />
            case 'sliding':
              return <SlidingDoor key={o.id} w={w} o={o} cut={cut} />
            case 'window':
            case 'ventilator':
              return <Window key={o.id} w={w} o={o} cut={cut} />
            default:
              return null
          }
        }),
      )}
    </group>
  )
}
