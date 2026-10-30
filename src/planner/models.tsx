// OWNER: Furniture Planner agent (A4).
// Procedural furniture models built from primitives. Everything here is modelled in CENTIMETRES with
// the origin at the footprint centre on the floor; <FurnitureModel> wraps it in a 0.01 scale group so
// the result is in metres. Front of every item faces local +z. Parts stay inside w × d × h exactly.
import { memo, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { getMaterials, type MaterialKey } from '../materials/materials'
import { getEntry, type ModelKind } from './catalog'

type V3 = [number, number, number]
type Mat = THREE.Material

// ---------------------------------------------------------------- materials
const localCache = new Map<string, Mat>()
const cached = (key: string, make: () => Mat) => {
  let m = localCache.get(key)
  if (!m) {
    m = make()
    localCache.set(key, m)
  }
  return m
}
const M = (k: MaterialKey) => getMaterials()[k]

/** A2 material, optionally re-coloured (clone cached per colour). */
export function tint(base: MaterialKey, color?: string): Mat {
  if (!color) return M(base)
  return cached(`tint|${base}|${color}`, () => {
    const m = M(base).clone() as THREE.MeshStandardMaterial
    m.color = new THREE.Color(color)
    return m
  })
}
const paint = (color: string, roughness = 0.5, metalness = 0) =>
  cached(`paint|${color}|${roughness}|${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }))

const L = {
  screen: () =>
    cached('screen', () => new THREE.MeshPhysicalMaterial({ color: '#06070a', roughness: 0.06, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 })),
  white: () => paint('#f4f3ef', 0.35),
  linen: () => paint('#fbfaf6', 0.9),
  steel: () => paint('#c9ccd0', 0.32, 0.75),
  dark: () => paint('#1b1c1f', 0.5, 0.2),
  grey: () => paint('#8c8f94', 0.45, 0.3),
  porthole: () =>
    cached('porthole', () => new THREE.MeshPhysicalMaterial({ color: '#2a3036', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1 })),
  mirror: () => cached('mirror', () => new THREE.MeshStandardMaterial({ color: '#dfe7ea', roughness: 0.03, metalness: 1 })),
  bulb: () => cached('bulb', () => new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffe7b0', emissiveIntensity: 2 })),
  rugBorder: () => paint('#8d8172', 0.95),
}
const shade = (color: string) =>
  cached(`shade|${color}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.9, side: THREE.DoubleSide }))

// ---------------------------------------------------------------- primitives
/** Box with p = [centre x, BOTTOM y, centre z], s = [w, h, d]. Rounded when r > 0. */
// Every box is shrunk by 0.1 % of its own size about its centre. Parts that share a face
// plane (a top board on a cabinet body, a front on a carcass) then sit a fraction of a mm
// apart, with the smaller part in front, instead of z-fighting (flickering) while moving.
const INSET = 0.999

function Bx({ p, s, m, r = 0, rot }: { p: V3; s: V3; m: Mat; r?: number; rot?: V3 }) {
  const [w, h, d] = s.map((v) => v * INSET) as V3
  const pos: V3 = [p[0], p[1] + s[1] / 2, p[2]]
  const rr = Math.min(r, Math.min(w, h, d) / 2 - 0.01)
  if (rr > 0.2)
    return <RoundedBox args={[w, h, d]} radius={rr} smoothness={3} position={pos} rotation={rot} material={m} />
  return (
    <mesh position={pos} rotation={rot} material={m}>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  )
}
/** Cylinder with p = [centre x, BOTTOM y, centre z]. */
function Cy({ p, r, rt, h, m, seg = 28, open = false }: { p: V3; r: number; rt?: number; h: number; m: Mat; seg?: number; open?: boolean }) {
  return (
    <mesh position={[p[0], p[1] + h / 2, p[2]]} material={m}>
      <cylinderGeometry args={[rt ?? r, r, h, seg, 1, open]} />
    </mesh>
  )
}
/** Cylinder whose axis points along +z (knobs, portholes). p = centre. */
function CyZ({ p, r, h, m, seg = 28 }: { p: V3; r: number; h: number; m: Mat; seg?: number }) {
  return (
    <mesh position={p} rotation={[Math.PI / 2, 0, 0]} material={m}>
      <cylinderGeometry args={[r, r, h, seg]} />
    </mesh>
  )
}
const legs4 = (w: number, d: number, inset: number, size: number, h: number, m: Mat, round = false, y = 0): ReactNode[] =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sz], i) => {
    const x = sx * (w / 2 - inset)
    const z = sz * (d / 2 - inset)
    return round ? (
      <Cy key={`leg${i}`} p={[x, y, z]} r={size / 2} rt={size / 2.6} h={h} m={m} seg={12} />
    ) : (
      <Bx key={`leg${i}`} p={[x, y, z]} s={[size, h, size]} m={m} />
    )
  })

interface MP {
  w: number
  d: number
  h: number
  main: Mat
  variant?: string
}

// ---------------------------------------------------------------- living
function Sofa({ w, d, h, main }: MP) {
  const legH = 8
  const baseTop = Math.min(40, h * 0.47)
  const armW = Math.min(18, w * 0.14)
  const armH = Math.min(64, h * 0.76)
  const backT = Math.min(20, d * 0.22)
  const seatTop = Math.min(52, h * 0.62)
  const iw = w - 2 * armW
  const n = Math.max(1, Math.round(iw / 65))
  const cw = iw / n
  const sd = d - backT - 2
  const out: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const cx = -iw / 2 + cw * (i + 0.5)
    out.push(<Bx key={`s${i}`} p={[cx, baseTop - 1, -d / 2 + backT + sd / 2]} s={[cw - 1.2, seatTop - baseTop + 1, sd]} m={main} r={5} />)
    out.push(<Bx key={`b${i}`} p={[cx, seatTop - 1, -d / 2 + backT + 7]} s={[cw - 2, h - 5 - seatTop, 15]} m={main} r={6} />)
  }
  return (
    <>
      {legs4(w, d, 7, 4.5, legH, M('darkWood'), true)}
      <Bx p={[0, legH, 0]} s={[w, baseTop - legH, d]} m={main} r={3} />
      <Bx p={[-w / 2 + armW / 2, legH, 0]} s={[armW, armH - legH, d]} m={main} r={6} />
      <Bx p={[w / 2 - armW / 2, legH, 0]} s={[armW, armH - legH, d]} m={main} r={6} />
      <Bx p={[0, legH, -d / 2 + backT / 2]} s={[iw + 2, h - legH, backT]} m={main} r={5} />
      {out}
    </>
  )
}

function LSofa({ w, d, h, main, variant }: MP) {
  const s = variant === 'left' ? 1 : -1 // x side of the chaise
  const legH = 8
  const baseTop = 40
  const armW = 16
  const armH = Math.min(62, h * 0.75)
  const backT = 20
  const seatD = Math.min(90, d)
  const chaiseW = Math.min(90, w)
  const seatTop = 52
  const chaiseL = d - seatD
  const iw = w - 2 * armW
  const n = Math.max(1, Math.round(iw / 65))
  const cw = iw / n
  const out: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const cx = -iw / 2 + cw * (i + 0.5)
    out.push(<Bx key={`s${i}`} p={[cx, baseTop - 1, -d / 2 + backT + (seatD - backT) / 2]} s={[cw - 1.2, seatTop - baseTop + 1, seatD - backT - 1]} m={main} r={5} />)
    out.push(<Bx key={`b${i}`} p={[cx, seatTop - 1, -d / 2 + backT + 7]} s={[cw - 2, h - 5 - seatTop, 15]} m={main} r={6} />)
  }
  const chaiseInnerW = chaiseW - armW
  const ccx = s * (w / 2 - armW - chaiseInnerW / 2)
  return (
    <>
      {legs4(w, seatD, 7, 4.5, legH, M('darkWood'), true, 0).map((l, i) => (
        <group key={`lg${i}`} position={[0, 0, -d / 2 + seatD / 2]}>
          {l}
        </group>
      ))}
      <Cy p={[s * (w / 2 - 7), 0, d / 2 - 7]} r={2.25} rt={1.7} h={legH} m={M('darkWood')} seg={12} />
      <Cy p={[s * (w / 2 - chaiseW + 7), 0, d / 2 - 7]} r={2.25} rt={1.7} h={legH} m={M('darkWood')} seg={12} />
      {/* bases */}
      <Bx p={[0, legH, -d / 2 + seatD / 2]} s={[w, baseTop - legH, seatD]} m={main} r={3} />
      {chaiseL > 0 && <Bx p={[s * (w / 2 - chaiseW / 2), legH, d / 2 - chaiseL / 2 - 0.5]} s={[chaiseW, baseTop - legH, chaiseL + 1]} m={main} r={3} />}
      {/* arms: plain end + along the outer side of the chaise */}
      <Bx p={[-s * (w / 2 - armW / 2), legH, -d / 2 + seatD / 2]} s={[armW, armH - legH, seatD]} m={main} r={6} />
      <Bx p={[s * (w / 2 - armW / 2), legH, 0]} s={[armW, armH - legH, d]} m={main} r={6} />
      {/* back */}
      <Bx p={[0, legH, -d / 2 + backT / 2]} s={[iw + 2, h - legH, backT]} m={main} r={5} />
      {out}
      {chaiseL > 0 && (
        <Bx p={[ccx, baseTop - 1, d / 2 - chaiseL / 2 - 1]} s={[chaiseInnerW - 1.2, seatTop - baseTop + 1, chaiseL]} m={main} r={5} />
      )}
      {/* scatter cushions */}
      <Bx p={[-s * (w / 2 - armW - 25), seatTop - 2, -d / 2 + backT + 18]} s={[38, 34, 12]} rot={[-0.25, 0, 0]} m={tint('fabricLight')} r={5} />
      <Bx p={[s * (w / 2 - armW - 25), seatTop - 2, -d / 2 + backT + 18]} s={[38, 34, 12]} rot={[-0.25, 0, 0]} m={tint('fabricLight')} r={5} />
    </>
  )
}

function RoundTable({ w, d, h, main }: MP) {
  const r = Math.min(w, d) / 2
  const t = Math.min(4, h * 0.1)
  return (
    <>
      <Cy p={[0, 0, 0]} r={r * 0.55} h={2} m={M('blackMetal')} seg={32} />
      <Cy p={[0, 2, 0]} r={Math.max(2, r * 0.09)} rt={Math.max(1.8, r * 0.08)} h={h - t - 2} m={M('blackMetal')} seg={16} />
      <Cy p={[0, h - t, 0]} r={r} h={t} m={main} seg={40} />
    </>
  )
}

function CentreTable({ w, d, h, main }: MP) {
  return (
    <>
      {legs4(w, d, 5, 5, h - 4, M('darkWood'))}
      <Bx p={[0, 10, 0]} s={[w - 8, 2.5, d - 8]} m={main} />
      <Bx p={[0, h - 4, 0]} s={[w, 4, d]} m={main} r={1.2} />
    </>
  )
}

function Pouf({ w, d, h, main }: MP) {
  const r = Math.min(w, d) / 2
  return (
    <>
      <Cy p={[0, 0, 0]} r={r * 0.97} rt={r} h={h - 4} m={main} seg={36} />
      <mesh position={[0, h - 4, 0]} scale={[r * 0.98, 4, r * 0.98]} material={main}>
        <sphereGeometry args={[1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </>
  )
}

function Rug({ w, d, h, main }: MP) {
  const b = Math.min(8, w * 0.05)
  const th = Math.max(0.3, h)
  return (
    <>
      <Bx p={[0, 0, 0]} s={[w - 0.2, th * 0.8, d - 0.2]} m={main} />
      {[
        [0, -d / 2 + b / 2, w, b],
        [0, d / 2 - b / 2, w, b],
        [-w / 2 + b / 2, 0, b, d - 2 * b],
        [w / 2 - b / 2, 0, b, d - 2 * b],
      ].map(([x, z, sw, sd], i) => (
        <Bx key={i} p={[x, 0, z]} s={[sw, th, sd]} m={L.rugBorder()} />
      ))}
      {[0.55, 0.3].map((k, i) => (
        <group key={`ring${i}`}>
          <Bx p={[0, 0, -d * k * 0.5]} s={[w * k, th * 0.9, 1.5]} m={L.rugBorder()} />
          <Bx p={[0, 0, d * k * 0.5]} s={[w * k, th * 0.9, 1.5]} m={L.rugBorder()} />
          <Bx p={[-w * k * 0.5, 0, 0]} s={[1.5, th * 0.9, d * k]} m={L.rugBorder()} />
          <Bx p={[w * k * 0.5, 0, 0]} s={[1.5, th * 0.9, d * k]} m={L.rugBorder()} />
        </group>
      ))}
    </>
  )
}

function TvUnit({ w, d, h, main }: MP) {
  const legH = 10
  const bodyH = h - legH
  const fz = d / 2 - 0.6
  const sec = w / 3
  return (
    <>
      {legs4(w, d, 6, 3, legH, M('blackMetal'))}
      <Bx p={[0, legH, -0.3]} s={[w, bodyH, d - 0.6]} m={main} r={1} />
      {/* open centre niche */}
      <Bx p={[0, legH + 5, fz - 15]} s={[sec - 4, bodyH - 10, 30]} m={M('darkWood')} />
      {/* drawer fronts: grooves + handles */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Bx p={[sx * (sec / 2), legH + 1, fz + 0.2]} s={[0.6, bodyH - 2, 0.8]} m={M('blackMetal')} />
          <Bx p={[sx * sec, legH + bodyH / 2 - 0.3, fz + 0.2]} s={[sec - 2, 0.6, 0.8]} m={M('blackMetal')} />
          <Bx p={[sx * sec, legH + bodyH * 0.75 - 1, fz + 0.4]} s={[sec * 0.4, 1.2, 0.4]} m={M('metal')} />
          <Bx p={[sx * sec, legH + bodyH * 0.25 - 1, fz + 0.4]} s={[sec * 0.4, 1.2, 0.4]} m={M('metal')} />
        </group>
      ))}
      <Bx p={[0, h - 2, 0]} s={[w, 2, d]} m={M('darkWood')} />
    </>
  )
}

function Tv({ w, d, h, main }: MP) {
  const backD = Math.max(0.5, d - 2.2)
  return (
    <>
      <Bx p={[0, h * 0.15, -d / 2 + backD / 2]} s={[w * 0.7, h * 0.7, backD]} m={main} r={1.5} />
      <Bx p={[0, 0, d / 2 - 1.0]} s={[w, h, 1.6]} m={main} r={0.5} />
      <mesh position={[0, h / 2, d / 2 + 0.05]} material={L.screen()}>
        <planeGeometry args={[w - 1.8, h - 1.8]} />
      </mesh>
    </>
  )
}

function Divider({ w, d, h, main }: MP) {
  const t = 3
  const plinth = 6
  const n = Math.max(2, Math.round(w / 45))
  const iw = w - 2 * t
  const ih = h - plinth - 2 * t
  return (
    <>
      <Bx p={[0, 0, 0]} s={[w - 2 * t, plinth, d - 4]} m={M('blackMetal')} />
      <Bx p={[-w / 2 + t / 2, 0, 0]} s={[t, h, d]} m={main} />
      <Bx p={[w / 2 - t / 2, 0, 0]} s={[t, h, d]} m={main} />
      <Bx p={[0, h - t, 0]} s={[w, t, d]} m={main} r={0.6} />
      <Bx p={[0, plinth, 0]} s={[iw, t, d]} m={main} />
      <Bx p={[0, plinth + t + ih / 2 - t / 2, 0]} s={[iw, t, d]} m={main} />
      <Bx p={[0, plinth + t, -d / 2 + 0.5]} s={[iw, ih, 1]} m={M('woodVeneer')} />
      {Array.from({ length: n - 1 }, (_, i) => (
        <Bx key={i} p={[-iw / 2 + (iw / n) * (i + 1), plinth + t, 0]} s={[t, ih, d]} m={main} />
      ))}
    </>
  )
}

// ---------------------------------------------------------------- dining / seating
function DiningTable({ w, d, h, main }: MP) {
  const t = 4
  return (
    <>
      {legs4(w, d, 12, 6, h - t, M('darkWood'))}
      <Bx p={[0, h - t - 9, 0]} s={[w - 18, 9, d - 18]} m={M('darkWood')} />
      <Bx p={[0, h - t, 0]} s={[w, t, d]} m={main} r={1.5} />
    </>
  )
}

function DiningChair({ w, d, h, main }: MP) {
  const seatY = 44
  const wood = M('darkWood')
  return (
    <>
      <Bx p={[-w / 2 + 2.5, 0, d / 2 - 3]} s={[3, seatY, 3]} m={wood} />
      <Bx p={[w / 2 - 2.5, 0, d / 2 - 3]} s={[3, seatY, 3]} m={wood} />
      <Bx p={[-w / 2 + 2.5, 0, -d / 2 + 1.5]} s={[3, h - 2, 3]} m={wood} />
      <Bx p={[w / 2 - 2.5, 0, -d / 2 + 1.5]} s={[3, h - 2, 3]} m={wood} />
      <Bx p={[0, seatY - 3, 1.5]} s={[w, 7, d - 3]} m={main} r={2.5} />
      <Bx p={[0, seatY + 12, -d / 2 + 4]} s={[w - 2, h - seatY - 12, 4]} m={main} r={2} />
    </>
  )
}

function BalconyChair({ w, d, h, main }: MP) {
  const seatY = 40
  return (
    <>
      {legs4(w, d, 3, 3.5, seatY, main)}
      <Bx p={[-w / 2 + 2, 0, -d / 2 + 1.75]} s={[3.5, h, 3.5]} m={main} />
      <Bx p={[w / 2 - 2, 0, -d / 2 + 1.75]} s={[3.5, h, 3.5]} m={main} />
      <Bx p={[0, seatY - 4, 0]} s={[w - 2, 4, d]} m={main} />
      <Bx p={[0, seatY, 2]} s={[w - 6, 8, d - 10]} m={M('fabricLight')} r={3} />
      <Bx p={[0, seatY + 14, -d / 2 + 4]} s={[w - 6, h - seatY - 16, 6]} m={M('fabricLight')} r={3} rot={[-0.12, 0, 0]} />
      {[-1, 1].map((sx) => (
        <Bx key={sx} p={[sx * (w / 2 - 2), seatY + 20, 0]} s={[4, 3, d - 2]} m={main} r={1} />
      ))}
      {[-1, 1].map((sx) => (
        <Bx key={`f${sx}`} p={[sx * (w / 2 - 2), seatY, d / 2 - 3]} s={[3, 20, 3]} m={main} />
      ))}
    </>
  )
}

function BarStool({ w, d, h, main }: MP) {
  const r = Math.min(w, d) / 2
  return (
    <>
      <Cy p={[0, 0, 0]} r={r * 0.85} h={2} m={M('metal')} />
      <Cy p={[0, 2, 0]} r={2.5} h={h - 8} m={M('metal')} seg={14} />
      <mesh position={[0, 26, 0]} rotation={[Math.PI / 2, 0, 0]} material={M('metal')}>
        <torusGeometry args={[r * 0.6, 1, 8, 32]} />
      </mesh>
      <Cy p={[0, h - 7, 0]} r={r * 0.7} h={2} m={M('blackMetal')} />
      <Cy p={[0, h - 5, 0]} r={r} rt={r * 0.96} h={5} m={main} seg={32} />
    </>
  )
}

// ---------------------------------------------------------------- bedroom
function Bed({ w, d, h, main }: MP) {
  const headT = 8
  const frameH = 30
  const len = d - headT
  const mattTop = frameH + 22
  const duvetL = len * 0.68
  const nP = w >= 120 ? 2 : 1
  const pw = Math.min(68, (w - 16) / nP - 4)
  return (
    <>
      <Bx p={[0, 0, headT / 2]} s={[w - 10, 6, len - 10]} m={M('blackMetal')} />
      <Bx p={[0, 6, headT / 2]} s={[w, frameH - 6, len]} m={M('darkWood')} r={2} />
      <Bx p={[0, 0, -d / 2 + headT / 4]} s={[w, h, headT / 2]} m={M('darkWood')} r={1} />
      <Bx p={[0, frameH + 4, -d / 2 + headT * 0.75]} s={[w - 6, h - frameH - 8, headT / 2]} m={tint('fabricLight')} r={2} />
      <Bx p={[0, frameH, headT / 2]} s={[w - 4, 22, len - 2]} m={L.linen()} r={4} />
      <Bx p={[0, frameH + 3, d / 2 - duvetL / 2 - 0.5]} s={[w - 1, mattTop - frameH - 1, duvetL]} m={main} r={3} />
      <Bx p={[0, mattTop + 1, d / 2 - duvetL + 9]} s={[w - 1, 2.5, 18]} m={L.linen()} r={1} />
      {Array.from({ length: nP }, (_, i) => (
        <Bx
          key={i}
          p={[nP === 1 ? 0 : (i === 0 ? -1 : 1) * (pw / 2 + 3), mattTop - 2, -d / 2 + headT + 24]}
          s={[pw, 14, 38]}
          rot={[-0.35, 0, 0]}
          m={L.linen()}
          r={6}
        />
      ))}
    </>
  )
}

function Bedside({ w, d, h, main }: MP) {
  const legH = 8
  const fz = d / 2 - 0.6
  const bh = h - legH
  return (
    <>
      {legs4(w, d, 4, 3, legH, M('darkWood'), true)}
      <Bx p={[0, legH, -0.3]} s={[w, bh, d - 0.6]} m={main} r={1} />
      <Bx p={[0, legH + bh / 2, fz + 0.2]} s={[w - 2, 0.6, 0.8]} m={M('blackMetal')} />
      <CyZ p={[0, legH + bh * 0.75, fz + 0.2]} r={1.4} h={0.8} m={M('metal')} />
      <CyZ p={[0, legH + bh * 0.25, fz + 0.2]} r={1.4} h={0.8} m={M('metal')} />
    </>
  )
}

function Wardrobe({ w, d, h, main }: MP) {
  const plinth = 8
  const bodyD = d - 2.5
  const fz = -1.25 + bodyD / 2
  const n = w <= 100 ? 2 : w <= 150 ? 3 : 4
  const dw = w / n
  const loftY = h - 45
  const parts: ReactNode[] = []
  for (let i = 1; i < n; i++)
    parts.push(<Bx key={`g${i}`} p={[-w / 2 + i * dw, plinth + 1, fz + 0.2]} s={[0.6, h - plinth - 2, 0.8]} m={M('blackMetal')} />)
  for (let i = 0; i < n; i++) {
    const right = i % 2 === 0
    const hx = -w / 2 + dw * i + (right ? dw - 4 : 4)
    parts.push(<Bx key={`h${i}`} p={[hx, 85, fz + 1.25]} s={[1.4, 45, 2.5]} m={M('metal')} r={0.6} />)
    parts.push(<Bx key={`hl${i}`} p={[hx, loftY + 4, fz + 1.25]} s={[1.4, 14, 2.5]} m={M('metal')} r={0.6} />)
  }
  return (
    <>
      <Bx p={[0, 0, -2]} s={[w - 2, plinth, d - 7]} m={M('darkWood')} />
      <Bx p={[0, plinth, -1.25]} s={[w, h - plinth, bodyD]} m={main} r={0.8} />
      <Bx p={[0, loftY, fz + 0.2]} s={[w - 1, 0.6, 0.8]} m={M('blackMetal')} />
      {parts}
    </>
  )
}

function DressingTable({ w, d, h, main }: MP) {
  const topY = 72
  const mw = Math.min(w * 0.7, 60)
  return (
    <>
      {legs4(w, d, 3, 4, topY - 15, M('darkWood'))}
      <Bx p={[0, topY - 15, 0]} s={[w, 15, d - 1]} m={main} r={0.8} />
      <Bx p={[0, topY - 7.8, d / 2 - 0.1]} s={[w - 4, 0.6, 0.2]} m={M('blackMetal')} />
      <Bx p={[0, topY, 0]} s={[w, 3, d]} m={main} r={0.8} />
      <Bx p={[0, topY + 3, -d / 2 + 1.5]} s={[mw, h - topY - 3, 3]} m={M('darkWood')} r={1.2} />
      <Bx p={[0, topY + 6, -d / 2 + 3.1]} s={[mw - 6, h - topY - 9, 0.3]} m={L.mirror()} />
    </>
  )
}

// ---------------------------------------------------------------- study / storage
function Desk({ w, d, h, main }: MP) {
  const t = 3
  const metal = M('blackMetal')
  return (
    <>
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Bx p={[sx * (w / 2 - 3), 0, d / 2 - 4]} s={[3, h - t, 3]} m={metal} />
          <Bx p={[sx * (w / 2 - 3), 0, -d / 2 + 4]} s={[3, h - t, 3]} m={metal} />
          <Bx p={[sx * (w / 2 - 3), 6, 0]} s={[3, 3, d - 8]} m={metal} />
        </group>
      ))}
      <Bx p={[0, h - t - 30, -d / 2 + 4]} s={[w - 10, 26, 1.5]} m={main} />
      <Bx p={[w / 2 - 26, h - t - 15, 0]} s={[40, 15, d - 6]} m={main} r={0.6} />
      <Bx p={[w / 2 - 26, h - t - 8, d / 2 - 3 + 0.2]} s={[14, 1.2, 0.5]} m={M('metal')} />
      <Bx p={[0, h - t, 0]} s={[w, t, d]} m={main} r={0.8} />
    </>
  )
}

function StudyChair({ w, d, h, main }: MP) {
  const r = Math.min(w, d) / 2
  const seatY = 46
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} rotation={[0, (i * 2 * Math.PI) / 5, 0]}>
          <Bx p={[0, 4, (r - 4) / 2]} s={[4, 2.5, r - 4]} m={M('blackMetal')} />
          <mesh position={[0, 2.5, r - 3]} material={L.dark()}>
            <sphereGeometry args={[2.5, 12, 8]} />
          </mesh>
        </group>
      ))}
      <Cy p={[0, 5, 0]} r={2.6} h={seatY - 13} m={M('metal')} seg={16} />
      <Bx p={[0, seatY - 9, 0]} s={[w - 10, 2, d - 14]} m={M('blackMetal')} />
      <Bx p={[0, seatY - 8, 2]} s={[w - 6, 8, d - 10]} m={main} r={3} />
      <Bx p={[0, seatY - 8, -d / 2 + 4]} s={[5, 22, 3]} m={M('blackMetal')} />
      <Bx p={[0, seatY + 10, -d / 2 + 4]} s={[w - 12, h - seatY - 10, 6]} m={main} r={3} rot={[-0.1, 0, 0]} />
    </>
  )
}

const BOOK_COLORS = ['#7b2f2f', '#2f4d6b', '#c9b48a', '#3d5a40', '#d8d2c4', '#8a5a2b', '#3a3a3f', '#a0473a']
function Bookshelf({ w, d, h, main }: MP) {
  const t = 2.5
  const n = Math.max(2, Math.round(h / 36))
  const gap = (h - t) / n
  const books: ReactNode[] = []
  let seed = 7
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  for (let s = 0; s < n; s++) {
    let x = -w / 2 + t + 1
    const y = s * gap + t
    let k = 0
    while (x < w / 2 - t - 8) {
      const bw = 6 + rnd() * 9
      const bh = Math.min(gap - 4, 18 + rnd() * 10)
      if (rnd() < 0.15) {
        x += bw * 0.6
        continue
      }
      books.push(
        <Bx key={`${s}-${k++}`} p={[x + bw / 2, y, 1]} s={[bw - 0.4, bh, d - 6]} m={paint(BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)], 0.8)} />,
      )
      x += bw
    }
  }
  return (
    <>
      <Bx p={[-w / 2 + t / 2, 0, 0]} s={[t, h, d]} m={main} />
      <Bx p={[w / 2 - t / 2, 0, 0]} s={[t, h, d]} m={main} />
      <Bx p={[0, 0, -d / 2 + 0.5]} s={[w - 2 * t, h, 1]} m={main} />
      {Array.from({ length: n + 1 }, (_, i) => (
        <Bx key={i} p={[0, i === n ? h - t : i * gap, 0]} s={[w - 2 * t, t, d]} m={main} />
      ))}
      {books}
    </>
  )
}

function ShoeRack({ w, d, h, main }: MP) {
  const legH = 8
  const bh = h - legH
  const fz = d / 2 - 0.6
  const slats: ReactNode[] = []
  for (let y = legH + 6; y < h - 4; y += 7) slats.push(<Bx key={y} p={[0, y, fz + 0.2]} s={[w - 4, 0.5, 0.6]} m={M('darkWood')} />)
  return (
    <>
      {legs4(w, d, 4, 3, legH, M('blackMetal'))}
      <Bx p={[0, legH, -0.3]} s={[w, bh, d - 0.6]} m={main} r={0.8} />
      <Bx p={[0, legH + 1, fz + 0.2]} s={[0.6, bh - 2, 0.8]} m={M('blackMetal')} />
      {slats}
      <Bx p={[-3, h - 12, fz + 0.4]} s={[1.2, 8, 0.4]} m={M('metal')} />
      <Bx p={[3, h - 12, fz + 0.4]} s={[1.2, 8, 0.4]} m={M('metal')} />
    </>
  )
}

// ---------------------------------------------------------------- appliances
function Fridge({ w, d, h, main, variant }: MP) {
  const fz = d / 2 - 2.5
  const split = variant === 'single' ? h * 0.999 : h * 0.7
  return (
    <>
      <Bx p={[0, 0, -2]} s={[w - 4, 4, d - 8]} m={L.dark()} />
      <Bx p={[0, 3, -1.25]} s={[w, h - 3, d - 2.5]} m={main} r={2} />
      {variant !== 'single' && <Bx p={[0, split, fz + 0.2]} s={[w - 0.5, 0.6, 0.8]} m={L.dark()} />}
      {variant !== 'single' && <Bx p={[-w / 2 + 6, split + 5, fz + 1.25]} s={[2, 22, 2.5]} m={L.grey()} r={0.8} />}
      <Bx p={[-w / 2 + 6, variant === 'single' ? h * 0.45 : split - 50, fz + 1.25]} s={[2, 40, 2.5]} m={L.grey()} r={0.8} />
      <Bx p={[w / 2 - 14, split - 22, fz + 0.2]} s={[8, 12, 0.5]} m={L.dark()} r={0.2} />
    </>
  )
}

function WashingMachine({ w, d, h, main }: MP) {
  const fz = d / 2 - 2
  const r = Math.min(w * 0.3, h * 0.24)
  return (
    <>
      <Bx p={[0, 0, -1]} s={[w, h, d - 2]} m={main} r={2} />
      <Bx p={[0, h - 13, fz]} s={[w - 3, 10, 0.8]} m={L.white()} r={0.3} />
      <Bx p={[-w / 2 + 12, h - 11, fz + 0.4]} s={[16, 6, 0.5]} m={L.grey()} />
      <CyZ p={[w / 2 - 12, h - 8, fz + 0.9]} r={3.5} h={1.8} m={L.grey()} />
      <Bx p={[w / 4, h - 11, fz + 0.4]} s={[10, 4, 0.5]} m={L.dark()} />
      <mesh position={[0, h * 0.45, fz - 0.4]} material={L.grey()}>
        <torusGeometry args={[r, 2.4, 12, 40]} />
      </mesh>
      <CyZ p={[0, h * 0.45, fz + 0.6]} r={r - 1} h={0.8} m={L.porthole()} seg={36} />
    </>
  )
}

function Microwave({ w, d, h, main }: MP) {
  const fz = d / 2
  return (
    <>
      <Bx p={[0, 0, -0.3]} s={[w, h, d - 0.6]} m={main} r={1.5} />
      <Bx p={[-w * 0.13, 3, fz - 0.4]} s={[w * 0.66, h - 6, 0.4]} m={L.screen()} />
      <Bx p={[w * 0.36, 3, fz - 0.4]} s={[w * 0.18, h - 6, 0.4]} m={L.grey()} />
    </>
  )
}

function Dishwasher({ w, d, h, main }: MP) {
  const fz = d / 2 - 2
  return (
    <>
      <Bx p={[0, 0, -2]} s={[w - 2, 8, d - 6]} m={L.dark()} />
      <Bx p={[0, 8, -1]} s={[w, h - 8, d - 2]} m={main} r={1} />
      <Bx p={[0, h - 9, fz + 0.2]} s={[w, 7, 0.8]} m={L.dark()} />
      <Bx p={[0, h - 18, fz + 1]} s={[w - 16, 2, 2]} m={L.grey()} r={0.8} />
    </>
  )
}

function Ac({ w, d, h, main }: MP) {
  return (
    <>
      <Bx p={[0, 0, 0]} s={[w, h, d]} m={main} r={Math.min(5, h / 3)} />
      <Bx p={[0, 2, d / 2 - 4]} s={[w - 14, 4.5, 6]} m={L.dark()} />
      <Bx p={[0, 6.2, d / 2 - 0.15]} s={[w - 16, 0.5, 0.3]} m={L.grey()} />
      <Bx p={[w / 2 - 14, h * 0.55, d / 2 - 0.2]} s={[6, 2, 0.4]} m={L.dark()} />
    </>
  )
}

function CeilingFan({ w, h, main }: MP) {
  const R = w / 2
  const hub = 10
  const bladeL = R - hub + 2
  return (
    <>
      <Cy p={[0, h - 5, 0]} r={7} rt={5} h={5} m={main} />
      <Cy p={[0, 14, 0]} r={1.2} h={h - 19} m={M('metal')} seg={10} />
      <Cy p={[0, 4, 0]} r={hub} rt={hub - 1} h={10} m={main} seg={32} />
      <Cy p={[0, 0, 0]} r={5} rt={hub - 1} h={4} m={main} seg={24} />
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, (i * 2 * Math.PI) / 3, 0]}>
          <Bx p={[0, 8, hub - 2 + bladeL / 2]} s={[11, 0.8, bladeL]} rot={[0, 0, 0.08]} m={main} r={0.35} />
        </group>
      ))}
    </>
  )
}

function FloorLamp({ w, h, main }: MP) {
  const R = w / 2
  return (
    <>
      <Cy p={[0, 0, 0]} r={R * 0.6} rt={R * 0.55} h={2.5} m={M('blackMetal')} />
      <Cy p={[0, 2.5, 0]} r={1.1} h={h - 30} m={M('blackMetal')} seg={10} />
      <Cy p={[0, h - 30, 0]} r={R} rt={R * 0.72} h={30} m={main} seg={36} open />
      <mesh position={[0, h - 18, 0]} material={L.bulb()}>
        <sphereGeometry args={[4, 16, 12]} />
      </mesh>
    </>
  )
}

function Plant({ w, d, h, main }: MP) {
  const R = Math.min(w, d) / 2
  const ph = Math.max(10, h * (h < 60 ? 0.38 : 0.3))
  const leaves = useMemo(() => {
    const out: { a: number; b: number; len: number; lw: number }[] = []
    const layers = [
      { b: 0.22, n: 3, k: 1 },
      { b: 0.6, n: 5, k: 1 },
      { b: 1.0, n: 7, k: 1 },
    ]
    layers.forEach((L, li) => {
      for (let i = 0; i < L.n; i++) {
        const a = (i / L.n) * Math.PI * 2 + li * 0.7
        const len = L.k * Math.min((R * 0.97) / Math.sin(L.b), (h - ph + 1) / Math.cos(L.b))
        out.push({ a, b: L.b, len, lw: Math.max(3, Math.min(R * 0.55, len * 0.32)) })
      }
    })
    return out
  }, [R, h, ph])
  return (
    <>
      <Cy p={[0, 0, 0]} r={R * 0.5} rt={R * 0.66} h={ph} m={main} seg={28} />
      <Cy p={[0, ph - 1.5, 0]} r={R * 0.6} h={1.4} m={M('soil')} seg={24} />
      {leaves.map((l, i) => {
        const len = l.len
        return (
          <group key={i} position={[0, ph - 2, 0]} rotation={[0, l.a, 0]}>
            <group rotation={[l.b, 0, 0]}>
              <mesh position={[0, len / 2, 0]} scale={[l.lw, len, l.lw * 0.25]} material={M('plant')}>
                <sphereGeometry args={[0.5, 10, 8]} />
              </mesh>
            </group>
          </group>
        )
      })}
    </>
  )
}

function Mirror({ w, d, h, main }: MP) {
  return (
    <>
      <Bx p={[0, 0, -0.3]} s={[w, h, d - 0.6]} m={main} r={1.2} />
      <Bx p={[0, 3, d / 2 - 0.5]} s={[w - 6, h - 6, 0.5]} m={L.mirror()} />
    </>
  )
}

function Fallback({ w, d, h, main }: MP) {
  return <Bx p={[0, 0, 0]} s={[w, h, d]} m={main} r={2} />
}

// ---------------------------------------------------------------- registry
const MODELS: Record<ModelKind, (p: MP) => ReactNode> = {
  sofa: Sofa,
  lsofa: LSofa,
  armchair: Sofa,
  roundTable: RoundTable,
  centreTable: CentreTable,
  pouf: Pouf,
  rug: Rug,
  tvUnit: TvUnit,
  tv: Tv,
  divider: Divider,
  diningTable: DiningTable,
  diningChair: DiningChair,
  balconyChair: BalconyChair,
  barStool: BarStool,
  bed: Bed,
  bedside: Bedside,
  wardrobe: Wardrobe,
  dressingTable: DressingTable,
  desk: Desk,
  studyChair: StudyChair,
  bookshelf: Bookshelf,
  shoeRack: ShoeRack,
  fridge: Fridge,
  washingMachine: WashingMachine,
  microwave: Microwave,
  dishwasher: Dishwasher,
  ac: Ac,
  ceilingFan: CeilingFan,
  floorLamp: FloorLamp,
  plant: Plant,
  mirror: Mirror,
}

/** Main (colour-overridable) material per model: an A2 key, or 'paint' = plain paint in the catalog colour. */
const MAIN: Record<ModelKind, MaterialKey | 'paint' | 'shade'> = {
  sofa: 'fabricBlue',
  lsofa: 'fabricBlue',
  armchair: 'fabricBlue',
  roundTable: 'darkWood',
  centreTable: 'darkWood',
  pouf: 'paint',
  rug: 'paint',
  tvUnit: 'woodVeneer',
  tv: 'blackMetal',
  divider: 'darkWood',
  diningTable: 'stoneTop',
  diningChair: 'fabricLight',
  balconyChair: 'woodVeneer',
  barStool: 'darkWood',
  bed: 'fabricLight',
  bedside: 'woodVeneer',
  wardrobe: 'woodVeneer',
  dressingTable: 'woodVeneer',
  desk: 'woodVeneer',
  studyChair: 'paint',
  bookshelf: 'darkWood',
  shoeRack: 'woodVeneer',
  fridge: 'paint',
  washingMachine: 'paint',
  microwave: 'paint',
  dishwasher: 'paint',
  ac: 'paint',
  ceilingFan: 'paint',
  floorLamp: 'shade',
  plant: 'paint',
  mirror: 'darkWood',
}

export function mainMaterial(catalogId: string, color?: string): Mat {
  const e = getEntry(catalogId)
  if (!e) return paint(color ?? '#9a9a9a', 0.7)
  const k = MAIN[e.model]
  if (k === 'paint') {
    const metallic = e.model === 'fridge' || e.model === 'dishwasher'
    return paint(color ?? e.color, metallic ? 0.32 : e.model === 'pouf' || e.model === 'rug' || e.model === 'studyChair' ? 0.95 : 0.4, metallic ? 0.6 : 0)
  }
  if (k === 'shade') return shade(color ?? e.color)
  return tint(k, color)
}

export interface FurnitureModelProps {
  catalogId: string
  w: number
  d: number
  h: number
  color?: string
}

/** Procedural model in metres (origin = footprint centre at the bottom, front = +z). */
export const FurnitureModel = memo(function FurnitureModel({ catalogId, w, d, h, color }: FurnitureModelProps) {
  const e = getEntry(catalogId)
  const Comp = e ? MODELS[e.model] : Fallback
  const main = mainMaterial(catalogId, color)
  return (
    <group scale={0.01}>
      <Comp w={w} d={d} h={h} main={main} variant={e?.variant} />
    </group>
  )
})
