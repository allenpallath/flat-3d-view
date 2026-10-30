// 3D layer for electrical points: every point as a modular plate (tagged {kind:'point', pointId}) and,
// with the electrical tool, click-to-place / select / delete, dimension guides and the TV-size preview.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import planC from '../data/planC'
import { roomAt } from '../data/geometry'
import { toCm, toM, type ElectricalPoint, type PointType } from '../data/schema'
import { isTypingTarget } from '../navigation/input'
import { PRESETS, tvSizeCm, tvViewingRange } from './presets'
import { plateTexture } from './plateTexture'
import { alongInfo, ceilingInfo, depthInFront, findWallFace, isCeilingPoint, snap } from './wallMath'
import { tvPlanFor, useElecUi } from './uiStore'

type NewPoint = Omit<ElectricalPoint, 'id'>

const ACCENT = '#e0a64a'
const PLATE_DEPTH = 0.9 // cm
const noRaycast = () => null

// ---------- materials (plastic plates are not a surface listed in getMaterials) ----------
const plastic = new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.35 })
const plasticGhost = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, transparent: true, opacity: 0.55, depthWrite: false })
const faceMats = new Map<string, THREE.MeshStandardMaterial>()
function faceMat(type: PointType, ghost: boolean) {
  const k = `${type}-${ghost}`
  let m = faceMats.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: plateTexture(type), roughness: 0.4, transparent: ghost, opacity: ghost ? 0.7 : 1, depthWrite: !ghost })
    faceMats.set(k, m)
  }
  return m
}
const ringMats = new Map<string, THREE.MeshBasicMaterial>()
function ringMat(color: string) {
  let m = ringMats.get(color)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false })
    ringMats.set(color, m)
  }
  return m
}

/** World transform of a point: group origin on the surface, local +z = outward normal. */
function pointTransform(p: Pick<ElectricalPoint, 'x' | 'y' | 'z' | 'nx' | 'nz'>) {
  const position: [number, number, number] = [toM(p.x), toM(p.y), toM(p.z)]
  const rotation: [number, number, number] = isCeilingPoint(p) ? [Math.PI / 2, 0, 0] : [0, Math.atan2(p.nx, p.nz), 0]
  return { position, rotation }
}

/** One plate: rect plates are a box + printed face, round ones a disc (+ hook for fan points). */
function Plate({ p, ghost, selected, outline }: { p: NewPoint & { id?: string }; ghost?: boolean; selected?: boolean; outline?: boolean }) {
  const pre = PRESETS[p.type]
  const { position, rotation } = pointTransform(p)
  const { w, h, shape } = pre.plate
  const tag = p.id ? { kind: 'point', pointId: p.id } : undefined
  const rc = ghost ? noRaycast : undefined
  const ring = selected ? ACCENT : outline ? pre.color : null
  const pad = selected ? 1.6 : 0.8
  return (
    <group position={position} rotation={rotation}>
      {shape === 'rect' ? (
        <>
          <mesh position={[0, 0, toM(PLATE_DEPTH / 2)]} material={ghost ? plasticGhost : plastic} userData={tag} raycast={rc} castShadow={false}>
            <boxGeometry args={[toM(w), toM(h), toM(PLATE_DEPTH)]} />
          </mesh>
          <mesh position={[0, 0, toM(PLATE_DEPTH + 0.02)]} material={faceMat(p.type, !!ghost)} userData={tag} raycast={rc}>
            <planeGeometry args={[toM(w), toM(h)]} />
          </mesh>
          {ring && (
            <mesh position={[0, 0, toM(0.15)]} material={ringMat(ring)} raycast={noRaycast}>
              <planeGeometry args={[toM(w + pad), toM(h + pad)]} />
            </mesh>
          )}
        </>
      ) : (
        <>
          <mesh position={[0, 0, toM(0.6)]} rotation={[Math.PI / 2, 0, 0]} material={ghost ? plasticGhost : plastic} userData={tag} raycast={rc}>
            <cylinderGeometry args={[toM(w / 2), toM(w / 2), toM(1.2), 32]} />
          </mesh>
          <mesh position={[0, 0, toM(1.22)]} material={faceMat(p.type, !!ghost)} userData={tag} raycast={rc}>
            <circleGeometry args={[toM(w / 2), 32]} />
          </mesh>
          {p.type === 'fanPoint' && (
            <mesh position={[0, 0, toM(3)]} rotation={[0, 0, 0]} raycast={noRaycast}>
              <torusGeometry args={[toM(1.6), toM(0.35), 8, 20]} />
              <meshStandardMaterial color="#555" metalness={0.6} roughness={0.4} />
            </mesh>
          )}
          {ring && (
            <mesh position={[0, 0, toM(0.15)]} material={ringMat(ring)} raycast={noRaycast}>
              <circleGeometry args={[toM(w / 2 + pad / 2), 32]} />
            </mesh>
          )}
        </>
      )}
    </group>
  )
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(toM(x), toM(y), toM(z))

const labelStyle: CSSProperties = {
  background: 'rgba(20,22,26,0.85)',
  color: '#fff',
  font: '12px system-ui, sans-serif',
  padding: '4px 7px',
  borderRadius: 6,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: ACCENT,
  lineHeight: 1.35,
}

/** Height + along-wall dimension lines and a label for the selected point. */
function DimensionGuide({ p }: { p: ElectricalPoint }) {
  const off = 1.5 // cm proud of the wall
  if (isCeilingPoint(p)) {
    const c = ceilingInfo(planC, p)
    if (!c) return null
    const r = c.room.rect
    const xEnd = c.west <= c.east ? r.x1 : r.x2
    const zEnd = c.north <= c.south ? r.z1 : r.z2
    const y = p.y - off
    return (
      <group>
        <Line points={[v3(xEnd, y, p.z), v3(p.x, y, p.z)]} color={ACCENT} lineWidth={2} dashed dashSize={0.05} gapSize={0.03} />
        <Line points={[v3(p.x, y, zEnd), v3(p.x, y, p.z)]} color={ACCENT} lineWidth={2} dashed dashSize={0.05} gapSize={0.03} />
        <Html position={[toM(p.x), toM(p.y - 25), toM(p.z)]} center zIndexRange={[10, 0]}>
          <div style={labelStyle}>
            <b>{PRESETS[p.type].label}</b> · ceiling
            <br />
            {Math.round(Math.min(c.west, c.east))} cm from {c.west <= c.east ? 'W' : 'E'} wall · {Math.round(Math.min(c.north, c.south))} cm from{' '}
            {c.north <= c.south ? 'N' : 'S'} wall
          </div>
        </Html>
      </group>
    )
  }
  const info = alongInfo(planC, p)
  const ox = p.x + p.nx * off
  const oz = p.z + p.nz * off
  const corner = info ? (info.nearest.side === 'left' ? info.leftEnd : info.rightEnd) : null
  return (
    <group>
      <Line points={[v3(ox, 0, oz), v3(ox, p.y, oz)]} color={ACCENT} lineWidth={2} />
      <Line points={[v3(ox - p.nz * 6, 0.5, oz + p.nx * 6), v3(ox + p.nz * 6, 0.5, oz - p.nx * 6)]} color={ACCENT} lineWidth={2} />
      {corner && (
        <Line
          points={[v3(corner.x + p.nx * off, p.y, corner.z + p.nz * off), v3(ox, p.y, oz)]}
          color={ACCENT}
          lineWidth={2}
          dashed
          dashSize={0.05}
          gapSize={0.03}
        />
      )}
      <Html position={[toM(ox + p.nx * 4), toM(p.y + PRESETS[p.type].plate.h / 2 + 12), toM(oz + p.nz * 4)]} center zIndexRange={[10, 0]}>
        <div style={labelStyle}>
          <b>{PRESETS[p.type].label}</b> · {Math.round(p.y)} cm high
          {info && (
            <>
              <br />
              {Math.round(info.nearest.dist)} cm from {info.nearest.side} corner
              <span style={{ opacity: 0.65 }}>
                {' '}
                (L {Math.round(info.left)} / R {Math.round(info.right)})
              </span>
            </>
          )}
        </div>
      </Html>
    </group>
  )
}

const tvMat = new THREE.MeshBasicMaterial({ color: '#0d0f14', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })
const zoneMat = new THREE.MeshBasicMaterial({ color: '#4caf50', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })

/** Translucent TV-size rectangle on the wall + recommended viewing-distance band on the floor. */
function TvPreview({ p }: { p: ElectricalPoint }) {
  const tvAll = useElecUi((s) => s.tv)
  const plan = tvPlanFor(tvAll, p.id)
  if (!plan.show || isCeilingPoint(p)) return null
  const { w, h } = tvSizeCm(plan.inches)
  const range = tvViewingRange(plan.inches)
  // available depth in front of the wall inside the room
  const depth = depthInFront(planC, p) ?? Infinity
  const d0 = Math.min(range.min, depth)
  const d1 = Math.min(range.max, depth)
  const yaw = Math.atan2(p.nx, p.nz)
  const off = 4
  const corners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
    [-w / 2, -h / 2],
  ].map(([a, b]) => new THREE.Vector3(toM(a), toM(b), 0))
  const mid = (d0 + d1) / 2
  return (
    <group>
      <group position={[toM(p.x + p.nx * off), toM(plan.centre), toM(p.z + p.nz * off)]} rotation={[0, yaw, 0]}>
        <mesh material={tvMat} raycast={noRaycast}>
          <planeGeometry args={[toM(w), toM(h)]} />
        </mesh>
        <Line points={corners} color={ACCENT} lineWidth={2} />
        <Html position={[0, toM(h / 2 + 8), 0]} center zIndexRange={[10, 0]}>
          <div style={labelStyle}>
            {plan.inches}" TV · {Math.round(w)}×{Math.round(h)} cm · centre {plan.centre} cm
          </div>
        </Html>
      </group>
      {d1 > d0 && (
        <group position={[toM(p.x + p.nx * mid), toM(0.4), toM(p.z + p.nz * mid)]} rotation={[0, yaw, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={zoneMat} raycast={noRaycast}>
            <planeGeometry args={[toM(w), toM(d1 - d0)]} />
          </mesh>
          <Html position={[0, toM(5), 0]} center zIndexRange={[10, 0]}>
            <div style={{ ...labelStyle, borderColor: '#4caf50' }}>
              Best seat (eyes) {range.min}–{range.max} cm from TV
              {depth < range.max && <> · wall only {Math.round(depth)} cm away</>}
            </div>
          </Html>
        </group>
      )}
    </group>
  )
}

// ---------- placement helpers ----------

function visibleChain(o: THREE.Object3D | null): boolean {
  for (let x = o; x; x = x.parent) if (!x.visible) return false
  return true
}

type PickResult =
  | { kind: 'point'; pointId: string }
  | { kind: 'surface'; hit: THREE.Intersection; surface: 'wall' | 'ceiling' | 'floor' }
  | null

const PASS_THROUGH = new Set(['furniture', 'fixture'])

/** First tagged, visible hit under the ray, looking through furniture and fixtures. */
function pickAt(raycaster: THREE.Raycaster, scene: THREE.Scene): PickResult {
  const hits = raycaster.intersectObjects(scene.children, true)
  for (const h of hits) {
    const ud = h.object.userData as { kind?: string; pointId?: string }
    if (!ud?.kind || PASS_THROUGH.has(ud.kind)) continue
    if (!visibleChain(h.object)) continue
    if (ud.kind === 'point' && ud.pointId) return { kind: 'point', pointId: ud.pointId }
    if (ud.kind === 'wall' || ud.kind === 'ceiling' || ud.kind === 'floor') return { kind: 'surface', hit: h, surface: ud.kind }
  }
  return null
}

const _n = new THREE.Vector3()

/**
 * The point that a click / hover would place. Wall hits snap the normal to the nearest axis, the height
 * to the preset (or cursor with Shift) and the along-wall position to 5 cm. Ceiling / floor hits
 * place on the ceiling, snapping to the room centre within 25 cm.
 */
function candidateFrom(pick: PickResult, type: PointType, shift: boolean, heightOverride: number | null): NewPoint | null {
  if (!pick || pick.kind !== 'surface') return null
  const pre = PRESETS[type]
  const { hit, surface } = pick
  const P = { x: toCm(hit.point.x), y: toCm(hit.point.y), z: toCm(hit.point.z) }
  if (surface === 'wall') {
    if (pre.mount === 'ceiling' || !hit.face) return null
    _n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
    if (Math.abs(_n.y) > 0.5) return null
    let nx = 0
    let nz = 0
    if (Math.abs(_n.x) >= Math.abs(_n.z)) nx = Math.sign(_n.x)
    else nz = Math.sign(_n.z)
    const half = pre.plate.h / 2
    let y = shift ? Math.round(P.y) : (heightOverride ?? pre.defaultHeight)
    y = Math.min(planC.ceilingHeight - half - 1, Math.max(half + 1, y))
    let x = Math.round(P.x * 10) / 10
    let z = Math.round(P.z * 10) / 10
    if (nx !== 0) z = snap(z, 5)
    else x = snap(x, 5)
    const wallId = (hit.object.userData as { wallId?: string }).wallId ?? findWallFace(planC, x, z, nx, nz)?.id
    const roomId = roomAt(planC, x + nx * 5, z + nz * 5)?.id
    return { type, x, y, z, nx, nz, ...(wallId ? { wallId } : {}), ...(roomId ? { roomId } : {}) }
  }
  // ceiling or floor (projected to the ceiling)
  if (pre.mount === 'wall') return null
  let x = snap(P.x, 5)
  let z = snap(P.z, 5)
  const room = roomAt(planC, x, z)
  if (room) {
    const cx = (room.rect.x1 + room.rect.x2) / 2
    const cz = (room.rect.z1 + room.rect.z2) / 2
    if (Math.hypot(cx - P.x, cz - P.z) < 25) {
      x = Math.round(cx)
      z = Math.round(cz)
    }
  }
  // on a real ceiling hit use its height (the hall has a dropped false-ceiling border)
  const y = surface === 'ceiling' ? Math.min(planC.ceilingHeight, Math.round(P.y)) : planC.ceilingHeight
  return { type, x, y, z, nx: 0, nz: 0, ...(room ? { roomId: room.id } : {}) }
}

/** Same placement candidate (type, position, normal), so the ghost need not re-render. */
function samePoint(a: NewPoint | null, b: NewPoint | null) {
  if (a === b) return true
  if (!a || !b) return false
  return a.type === b.type && a.x === b.x && a.y === b.y && a.z === b.z && a.nx === b.nx && a.nz === b.nz && a.wallId === b.wallId
}

/** All electrical points plus the electrical tool's interaction. */
export default function PointsLayer() {
  const points = useStore((s) => s.points)
  const tool = useStore((s) => s.tool)
  const selectedId = useStore((s) => s.selectedId)
  const pending = useStore((s) => s.pendingPointType)
  const editing = tool === 'electrical'
  const get = useThree((s) => s.get)
  const gl = useThree((s) => s.gl)
  const [ghost, setGhost] = useState<NewPoint | null>(null)
  const shiftRef = useRef(false)

  const selected = useMemo(() => points.find((p) => p.id === selectedId) ?? null, [points, selectedId])

  // DOM pointer handling on the canvas (works in every view mode; look/orbit are drags).
  useEffect(() => {
    if (!editing) {
      setGhost(null)
      return
    }
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let down: { x: number; y: number; id: number } | null = null

    const cast = (e: PointerEvent) => {
      const { camera, scene } = get()
      if (document.pointerLockElement) ndc.set(0, 0)
      else {
        const r = el.getBoundingClientRect()
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      }
      raycaster.setFromCamera(ndc, camera)
      return pickAt(raycaster, scene)
    }

    const onMove = (e: PointerEvent) => {
      shiftRef.current = e.shiftKey
      const type = useStore.getState().pendingPointType
      if (!type) return
      if (e.pointerType !== 'mouse' && !document.pointerLockElement) return
      const c = candidateFrom(cast(e), type, e.shiftKey, useElecUi.getState().heightOverride)
      setGhost((g) => (samePoint(g, c) ? g : c)) // re-render only when the ghost actually moves
    }
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) down = { x: e.clientX, y: e.clientY, id: e.pointerId }
    }
    const onUp = (e: PointerEvent) => {
      if (!down || e.button !== 0 || e.pointerId !== down.id) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      down = null
      if (moved > 5) return
      const s = useStore.getState()
      const pick = cast(e)
      if (pick?.kind === 'point') {
        s.set({ selectedId: pick.pointId })
        return
      }
      if (s.pendingPointType) {
        const c = candidateFrom(pick, s.pendingPointType, e.shiftKey, useElecUi.getState().heightOverride)
        if (c) s.addPoint(c)
        return
      }
      if (s.selectedId && s.points.some((p) => p.id === s.selectedId)) s.set({ selectedId: null })
    }
    const onLeave = () => setGhost(null)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [editing, gl, get])

  useEffect(() => {
    if (!pending) setGhost(null)
  }, [pending])

  // Keyboard: Esc disarms, Delete/Backspace removes the selected point.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const s = useStore.getState()
      if (e.key === 'Escape') {
        if (s.pendingPointType) s.set({ pendingPointType: null })
        else if (s.selectedId && s.points.some((p) => p.id === s.selectedId)) s.set({ selectedId: null })
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedId && s.points.some((p) => p.id === s.selectedId)) {
          e.preventDefault()
          s.removePoint(s.selectedId)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  return (
    <group name="electrical-points">
      {points.map((p) => (
        <Plate key={p.id} p={p} selected={editing && p.id === selectedId} outline={editing} />
      ))}
      {editing && ghost && pending && (
        <>
          <Plate p={ghost} ghost />
          <Html position={[toM(ghost.x + ghost.nx * 3), toM(ghost.y - (isCeilingPoint(ghost) ? 20 : PRESETS[ghost.type].plate.h / 2 + 10)), toM(ghost.z + ghost.nz * 3)]} center zIndexRange={[10, 0]}>
            <div style={{ ...labelStyle, opacity: 0.85 }}>
              {isCeilingPoint(ghost) ? 'Ceiling' : `${Math.round(ghost.y)} cm`}
              {!isCeilingPoint(ghost) && !shiftRef.current && <span style={{ opacity: 0.6 }}> · Shift = free height</span>}
            </div>
          </Html>
        </>
      )}
      {editing && selected && <DimensionGuide p={selected} />}
      {editing && selected && selected.type === 'tvPoint' && <TvPreview p={selected} />}
    </group>
  )
}
