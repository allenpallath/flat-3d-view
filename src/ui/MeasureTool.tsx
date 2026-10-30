// OWNER: UI & QA agent (A6). 3D layer: two-click tape measure with axis lock and endpoint snapping.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { useStore } from '../store'
import { useMeasure } from './measureStore'
import { axisLock, distCmFromMetres, formatCm, formatFtIn, snapToNearest, type Vec3 } from './format'

const ACCENT = '#e0a64a'
const SNAP_COLOR = '#4ade80'
const AXIS_COLOR: Record<'x' | 'y' | 'z', string> = { x: '#f87171', y: '#4ade80', z: '#60a5fa' }
const CLICK_PX = 5
const SNAP_RADIUS_M = 0.05
const MAX_HIT_M = 80
const IGNORE = { measureIgnore: true }
const noRaycast = () => null
const Z_UP = new THREE.Vector3(0, 0, 1)
const tmpV = new THREE.Vector3()
const tmpN = new THREE.Vector3()

function isIgnored(o: THREE.Object3D | null): boolean {
  for (let p = o; p; p = p.parent) {
    if (!p.visible || p.userData?.measureIgnore || p.userData?.kind === 'overlay') return true
  }
  return false
}

function usable(hit: THREE.Intersection): boolean {
  const o = hit.object as THREE.Mesh & { isLine2?: boolean; isLineSegments2?: boolean }
  if (!o.isMesh || o.isLine2 || o.isLineSegments2) return false
  if (hit.distance > MAX_HIT_M) return false
  const m = o.material as THREE.Material | THREE.Material[]
  const mat = Array.isArray(m) ? m[0] : m
  if (mat && (mat.visible === false || (mat.transparent && mat.opacity < 0.05))) return false
  return !isIgnored(o)
}

function Label({ a, b, color = ACCENT }: { a: Vec3; b: Vec3; color?: string }) {
  const cm = distCmFromMetres(a, b)
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  return (
    <Html position={mid} center zIndexRange={[12, 5]} pointerEvents="none" style={{ pointerEvents: 'none' }}>
      <div className="ui-measure-label" style={{ borderColor: color }}>
        {formatCm(cm)}
        <small>{formatFtIn(cm)}</small>
      </div>
    </Html>
  )
}

/** Scale an object every frame so `px` scene units equal `px` screen pixels at its position. */
function useScreenScale(ref: RefObject<THREE.Object3D | null>, px: number) {
  const { camera, size } = useThree()
  useFrame(() => {
    const m = ref.current
    if (!m) return
    m.getWorldPosition(tmpV)
    let worldPerPx: number
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const o = camera as THREE.OrthographicCamera
      worldPerPx = (o.top - o.bottom) / o.zoom / size.height
    } else {
      const fov = (camera as THREE.PerspectiveCamera).fov ?? 60
      worldPerPx = (2 * camera.position.distanceTo(tmpV) * Math.tan(THREE.MathUtils.degToRad(fov) / 2)) / size.height
    }
    m.scale.setScalar(Math.max(worldPerPx * px, 0.002))
  })
}

/** End marker that keeps a constant on-screen size. */
function Dot({ p, color = ACCENT, px = 5 }: { p: Vec3; color?: string; px?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useScreenScale(ref, px)
  return (
    <mesh ref={ref} position={p} renderOrder={11} raycast={noRaycast}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial color={color} depthTest={false} transparent toneMapped={false} />
    </mesh>
  )
}

/** Surface-aligned ring around the hover point (constant screen size). */
function Ring({ n, color }: { n: Vec3; color: string }) {
  const ref = useRef<THREE.Group>(null)
  useScreenScale(ref, 12)
  useLayoutEffect(() => {
    ref.current?.quaternion.setFromUnitVectors(Z_UP, tmpN.set(n[0], n[1], n[2]).normalize())
  }, [n])
  return (
    <group ref={ref}>
      <mesh renderOrder={11} raycast={noRaycast}>
        <ringGeometry args={[0.75, 1, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthTest={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Segment({ a, b, color = ACCENT, dashed = false }: { a: Vec3; b: Vec3; color?: string; dashed?: boolean }) {
  const points = useMemo(() => [a, b], [a, b])
  return (
    <>
      <Line
        points={points}
        color={color}
        lineWidth={2.5}
        dashed={dashed}
        dashSize={0.05}
        gapSize={0.03}
        depthTest={false}
        transparent
        renderOrder={10}
        raycast={noRaycast}
      />
      <Dot p={a} color={color} />
      <Dot p={b} color={color} />
      <Label a={a} b={b} color={color} />
    </>
  )
}

interface Hover {
  p: Vec3
  n: Vec3
  snapped: boolean
  axis: 'x' | 'y' | 'z' | null
}

const sameHover = (a: Hover | null, b: Hover | null) =>
  a === b || (!!a && !!b && a.p.every((v, i) => Math.abs(v - b.p[i]) < 1e-4) && a.snapped === b.snapped && a.axis === b.axis)

function Interaction() {
  const { gl, camera, scene, raycaster } = useThree()
  const start = useMeasure((s) => s.start)
  const [hover, setHover] = useState<Hover | null>(null)
  const down = useRef<{ x: number; y: number; id: number } | null>(null)
  const last = useRef<{ x: number; y: number; shift: boolean } | null>(null)
  const pickRef = useRef<((x: number, y: number, shift: boolean) => Hover | null) | null>(null)

  useEffect(() => {
    const el = gl.domElement
    const ndc = new THREE.Vector2()
    const nrm = new THREE.Vector3()
    const cands: Vec3[] = [] // reused snap-candidate list (pick runs per pointermove / per frame)

    const pick = (clientX: number, clientY: number, shift: boolean): Hover | null => {
      if (document.pointerLockElement) ndc.set(0, 0)
      else {
        const r = el.getBoundingClientRect()
        ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
      }
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObjects(scene.children, true).find(usable)
      if (!hit) return null
      let p: Vec3 = [hit.point.x, hit.point.y, hit.point.z]
      if (hit.face) nrm.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
      else nrm.set(0, 1, 0)
      const { list, start } = useMeasure.getState()
      let axis: Hover['axis'] = null
      let snapped = false
      if (start && shift) {
        const l = axisLock(start, p)
        p = l.point
        axis = l.axis
      } else {
        cands.length = 0
        for (const m of list) cands.push(m.a, m.b)
        if (start) cands.push(start)
        const s = snapToNearest(p, cands, SNAP_RADIUS_M)
        if (s) {
          p = s
          snapped = true
        }
      }
      return { p, n: [nrm.x, nrm.y, nrm.z], snapped, axis }
    }

    pickRef.current = pick

    const refresh = () => {
      if (!last.current) return
      const h = pick(last.current.x, last.current.y, last.current.shift)
      setHover((prev) => (sameHover(prev, h) ? prev : h))
    }

    const onMove = (e: PointerEvent) => {
      last.current = { x: e.clientX, y: e.clientY, shift: e.shiftKey }
      if (e.pointerType === 'mouse' || down.current) refresh()
    }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      down.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
      last.current = { x: e.clientX, y: e.clientY, shift: e.shiftKey }
    }
    const onUp = (e: PointerEvent) => {
      const d = down.current
      down.current = null
      if (!d || d.id !== e.pointerId || e.button !== 0) return
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > CLICK_PX) return
      const h = pick(e.clientX, e.clientY, e.shiftKey)
      if (!h) return
      const m = useMeasure.getState()
      if (!m.start) m.setStart(h.p)
      else if (distCmFromMetres(m.start, h.p) > 0.5) m.add(m.start, h.p)
      if (e.pointerType !== 'mouse') setHover(null)
      else setHover(h)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && last.current) {
        last.current.shift = e.type === 'keydown'
        refresh()
        return
      }
      if (e.type !== 'keydown' || e.key !== 'Escape') return
      const m = useMeasure.getState()
      if (m.start) m.setStart(null)
      else useStore.getState().setTool('none')
    }
    const onLeave = () => {
      last.current = null
      setHover(null)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerleave', onLeave)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    const prevCursor = el.style.cursor
    el.style.cursor = 'crosshair'
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      el.style.cursor = prevCursor
      useMeasure.getState().setStart(null)
    }
  }, [gl, camera, scene, raycaster])

  // pointer-lock walk: aim with the crosshair, so re-pick the centre whenever the camera moved
  const lastCam = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    if (!document.pointerLockElement || !pickRef.current) return
    if (lastCam.equals(camera.matrixWorld)) return
    lastCam.copy(camera.matrixWorld)
    const h = pickRef.current(0, 0, last.current?.shift ?? false)
    setHover((prev) => (sameHover(prev, h) ? prev : h))
  })

  const color = hover?.axis ? AXIS_COLOR[hover.axis] : hover?.snapped ? SNAP_COLOR : ACCENT
  return (
    <>
      {start && <Dot p={start} />}
      {start && hover && <Segment a={start} b={hover.p} color={color} dashed />}
      {hover && (
        <group position={hover.p}>
          <Dot p={[0, 0, 0]} color={color} px={hover.snapped ? 7 : 5} />
          <Ring n={hover.n} color={color} />
        </group>
      )}
    </>
  )
}

export default function MeasureTool() {
  const tool = useStore((s) => s.tool)
  const list = useMeasure((s) => s.list)
  return (
    <group userData={IGNORE}>
      {list.map((m) => (
        <Segment key={m.id} a={m.a} b={m.b} />
      ))}
      {tool === 'measure' && <Interaction />}
    </group>
  )
}
