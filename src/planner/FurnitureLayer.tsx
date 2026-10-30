// OWNER: Furniture Planner agent (A4). 3D layer: placed furniture, selection gizmo, wall distances, placement ghost.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { invalidate, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, Line, TransformControls } from '@react-three/drei'
import type { PlacedItem } from '../data/schema'
import { useStore } from '../store'
import { getEntry, itemDims } from './catalog'
import { useFurnitureGeometry } from './geoCache'
import { markShadowsDirty } from '../materials/shadows'
import { clickGuard, usePlanner } from './plannerStore'
import { seedIfFirstRun } from './defaultLayout'
import {
  collides,
  footprintPolys,
  nearestWallFace,
  polyBounds,
  rayPlan,
  wallGaps,
  yawFromNormal,
  type Pose,
  type RayHit,
} from './geom'

const D2R = Math.PI / 180
const ACCENT = '#e0a64a'
const round5 = (v: number) => Math.round(v / 5) * 5
const normDeg = (d: number) => {
  let r = ((d % 360) + 360) % 360
  if (r > 180) r -= 360
  return Math.round(r)
}
/** timestamp of the last furniture click (used by the deselect-on-empty-click logic) */
const lastItemClick = { t: 0 }

// ------------------------------------------------------------------ LOD
// Beyond ~5 m (walk mode only) an item shows a low-detail proxy. Checked at most 5×/s, with hysteresis.
const LOD_FAR = 5.5 // m: switch to the proxy above this (distance to the item's bounding circle)
const LOD_NEAR = 4.5 // m: back to full detail below this
const LOD_INTERVAL = 200 // ms

interface LodHandle {
  item: PlacedItem
  r: number // m, half the larger footprint side
  hm: number // m, half the height
  far: boolean
  setFar: (v: boolean) => void
}
const lodHandles = new Map<string, LodHandle>()

function useLodManager() {
  const last = useRef(-1e9)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cam = useMemo(() => new THREE.Vector3(), [])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  useFrame(({ camera }) => {
    const now = performance.now()
    if (now - last.current < LOD_INTERVAL) {
      // render-on-demand: make sure one more frame (and check) happens after the camera stops
      if (!timer.current) timer.current = setTimeout(() => ((timer.current = null), invalidate()), LOD_INTERVAL)
      return
    }
    last.current = now
    const s = useStore.getState()
    const walk = s.mode === 'walk'
    cam.setFromMatrixPosition(camera.matrixWorld)
    let changed = false
    for (const [id, h] of lodHandles) {
      let want = false
      if (walk && id !== s.selectedId) {
        const it = h.item
        const dx = it.x / 100 - cam.x
        const dy = it.y / 100 + h.hm - cam.y
        const dz = it.z / 100 - cam.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) - h.r
        want = h.far ? dist > LOD_NEAR : dist > LOD_FAR
      }
      if (want !== h.far) {
        h.far = want
        h.setFar(want)
        changed = true
      }
    }
    if (changed) markShadowsDirty()
  })
}

// ------------------------------------------------------------------ placed item
const Item = memo(function Item({
  item,
  selected,
  register,
}: {
  item: PlacedItem
  selected: boolean
  register: (id: string, o: THREE.Object3D | null) => void
}) {
  const ref = useRef<THREE.Group>(null)
  const dims = itemDims(item)
  const [farState, setFar] = useState(false)
  const far = farState && !selected // never LOD the selected item
  const entry = useFurnitureGeometry({ catalogId: item.catalogId, w: dims.w, d: dims.d, h: dims.h, color: item.color }, far)
  const userData = useMemo(() => ({ kind: 'furniture', itemId: item.id }), [item.id])

  useEffect(() => {
    register(item.id, ref.current)
    return () => register(item.id, null)
  }, [item.id, register])

  // LOD registration (the manager reads the latest item / dims through the handle)
  const handle = useRef<LodHandle | null>(null)
  useLayoutEffect(() => {
    const h: LodHandle = handle.current ?? { item, r: 0, hm: 0, far: false, setFar }
    h.item = item
    h.r = Math.max(dims.w, dims.d) / 200
    h.hm = Math.max(dims.h, 1) / 200
    handle.current = h
    lodHandles.set(item.id, h)
  })
  useEffect(() => {
    const id = item.id
    return () => {
      lodHandles.delete(id)
    }
  }, [item.id])

  // static item: the matrix is only recomputed when it moves (the selected one auto-updates for the gizmo)
  useLayoutEffect(() => {
    ref.current?.updateMatrix()
    invalidate()
  }, [item.x, item.y, item.z, item.rot, selected])

  // anything that changes what casts shadows: geometry swap (LOD, size, colour)
  useEffect(() => {
    markShadowsDirty()
  }, [entry])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const s = useStore.getState()
    if (s.tool !== 'furniture' || s.pendingCatalogId) return
    if (e.delta > 5 || performance.now() < clickGuard.until) return
    // ignore items hidden behind a wall (R3F only raycasts objects with handlers)
    const o = e.ray.origin
    const dir = e.ray.direction
    const wall = rayPlan([o.x * 100, o.y * 100, o.z * 100], [dir.x, dir.y, dir.z], s.mode === 'plan' ? 120 : 9999)
    if (wall && wall.kind === 'wall' && wall.t / 100 < e.distance - 0.08) return
    e.stopPropagation()
    lastItemClick.t = performance.now()
    s.set({ selectedId: item.id })
  }

  return (
    <group
      ref={ref}
      position={[item.x / 100, item.y / 100, item.z / 100]}
      rotation={[0, item.rot * D2R, 0]}
      matrixAutoUpdate={selected}
      onClick={onClick}
    >
      <mesh geometry={entry.geometry} material={entry.materials} userData={userData} castShadow receiveShadow matrixAutoUpdate={false} />
    </group>
  )
})

// ------------------------------------------------------------------ selection
function snapWallItem(id: string) {
  const s = useStore.getState()
  const it = s.items.find((i) => i.id === id)
  if (!it || !getEntry(it.catalogId)?.wallMounted) return
  const dd = itemDims(it)
  // back face centre of the item
  const a = it.rot * D2R
  const bx = it.x - Math.sin(a) * (dd.d / 2)
  const bz = it.z - Math.cos(a) * (dd.d / 2)
  const f = nearestWallFace(bx, bz, it.y + dd.h / 2, 60)
  if (!f) return
  const x = f.px + f.nx * (dd.d / 2)
  const z = f.pz + f.nz * (dd.d / 2)
  s.updateItem(id, { x: Math.round(x), z: Math.round(z), rot: yawFromNormal(f.nx, f.nz) })
}

function Gizmo({ item, object }: { item: PlacedItem; object: THREE.Object3D }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tc = useRef<any>(null)
  const mode = usePlanner((s) => s.gizmoMode)
  const [shift, setShift] = useState(false)
  const wallMounted = !!getEntry(item.catalogId)?.wallMounted
  const id = item.id

  useEffect(() => {
    const k = (e: KeyboardEvent) => setShift(e.shiftKey)
    window.addEventListener('keydown', k)
    window.addEventListener('keyup', k)
    return () => {
      window.removeEventListener('keydown', k)
      window.removeEventListener('keyup', k)
    }
  }, [])

  useEffect(() => {
    const c = tc.current
    if (!c) return
    const cb = (e: { value: boolean }) => {
      window.__gizmoDragging = !!e.value
      invalidate()
      if (!e.value) {
        clickGuard.until = performance.now() + 300
        snapWallItem(id)
      }
    }
    c.addEventListener('dragging-changed', cb)
    return () => {
      c.removeEventListener('dragging-changed', cb)
      window.__gizmoDragging = false
    }
  }, [id, object])

  const onObjectChange = () => {
    const o = object
    const q = o.quaternion
    const yaw = (2 * Math.atan2(q.y, q.w)) / D2R
    const cur = useStore.getState().items.find((i) => i.id === id)
    if (!cur) return
    useStore.getState().updateItem(id, {
      x: Math.round(o.position.x * 100),
      z: Math.round(o.position.z * 100),
      y: wallMounted ? Math.max(0, Math.round(o.position.y * 100)) : cur.y,
      rot: normDeg(yaw),
    })
  }

  const rotate = mode === 'rotate'
  return (
    <TransformControls
      ref={tc}
      object={object}
      mode={mode}
      space="world"
      size={0.75}
      showX={!rotate}
      showZ={!rotate}
      showY={rotate || wallMounted}
      translationSnap={0.05}
      rotationSnap={(shift ? 90 : 15) * D2R}
      onObjectChange={onObjectChange}
    />
  )
}

function SelectionBox({ item }: { item: PlacedItem }) {
  const items = useStore((s) => s.items)
  const { w, d, h } = itemDims(item)
  const blocked = useMemo(() => collides(item.catalogId, item, { w, d, h }, items, item.id), [item, items, w, d, h])
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w / 100 + 0.03, Math.max(h, 1) / 100 + 0.03, d / 100 + 0.03)), [w, d, h])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <group position={[item.x / 100, item.y / 100, item.z / 100]} rotation={[0, item.rot * D2R, 0]}>
      <lineSegments geometry={geo} position={[0, Math.max(h, 1) / 200, 0]} renderOrder={999} raycast={() => null}>
        <lineBasicMaterial color={blocked ? '#ff4d4d' : ACCENT} depthTest={false} transparent />
      </lineSegments>
    </group>
  )
}

const labelStyle: React.CSSProperties = {
  background: 'rgba(20,22,26,0.85)',
  color: '#fff',
  font: '600 12px system-ui, sans-serif',
  padding: '2px 6px',
  borderRadius: 6,
  border: `1px solid ${ACCENT}`,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
}

function WallDistances({ item }: { item: PlacedItem }) {
  const { h } = itemDims(item)
  const gaps = useMemo(() => wallGaps(item), [item])
  const ly = Math.min(item.y + Math.max(h, 1) / 2, 110) / 100
  return (
    <group>
      {gaps
        .filter((g) => g.dist >= 0.5)
        .map((g) => {
          const a: [number, number, number] = [g.a[0] / 100, ly, g.a[1] / 100]
          const b: [number, number, number] = [g.b[0] / 100, ly, g.b[1] / 100]
          const mid: [number, number, number] = [(a[0] + b[0]) / 2, ly, (a[2] + b[2]) / 2]
          return (
            <group key={g.dir}>
              <Line points={[a, b]} color={ACCENT} lineWidth={2} depthTest={false} renderOrder={998} raycast={() => null} />
              <Html position={mid} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                <div style={labelStyle}>{Math.round(g.dist)} cm</div>
              </Html>
            </group>
          )
        })}
    </group>
  )
}

// ------------------------------------------------------------------ placement ghost
const ghostMat = new THREE.MeshStandardMaterial({ color: '#53c26b', transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.6 })
const GREEN = new THREE.Color('#53c26b')
const RED = new THREE.Color('#ff4d4d')
const _normal = new THREE.Vector3()

function usePicker() {
  const { camera, scene, raycaster } = useThree()
  const tagged = useRef<{ list: THREE.Object3D[]; t: number }>({ list: [], t: -1e9 })

  return useCallback(
    (ndc: THREE.Vector2): RayHit | null => {
      raycaster.setFromCamera(ndc, camera)
      const now = performance.now()
      if (now - tagged.current.t > 500) {
        const list: THREE.Object3D[] = []
        scene.traverse((o) => {
          const k = o.userData?.kind
          if ((k === 'floor' || k === 'wall') && (o as THREE.Mesh).isMesh) list.push(o)
        })
        tagged.current = { list, t: now }
      }
      const o = raycaster.ray.origin
      const dir = raycaster.ray.direction
      if (tagged.current.list.length) {
        const hits = raycaster.intersectObjects(tagged.current.list, false)
        for (const h of hits) {
          let vis = true
          for (let p: THREE.Object3D | null = h.object; p; p = p.parent) if (!p.visible) vis = false
          if (!vis) continue
          const kind = h.object.userData.kind as 'floor' | 'wall'
          let nx = 0
          let nz = 0
          if (h.face) {
            const n = _normal.copy(h.face.normal).transformDirection(h.object.matrixWorld)
            if (Math.abs(n.y) < 0.5) {
              nx = n.x
              nz = n.z
            }
          }
          const horiz = Math.abs(nx) + Math.abs(nz) > 0.5
          return {
            t: h.distance * 100,
            x: h.point.x * 100,
            y: h.point.y * 100,
            z: h.point.z * 100,
            nx,
            nz,
            kind: kind === 'wall' && horiz ? 'wall' : 'floor',
          }
        }
      }
      return rayPlan([o.x * 100, o.y * 100, o.z * 100], [dir.x, dir.y, dir.z], useStore.getState().mode === 'plan' ? 120 : 9999)
    },
    [camera, scene, raycaster],
  )
}

function computePose(catalogId: string, hit: RayHit | null, ghostRot: number): Pose | null {
  const e = getEntry(catalogId)
  if (!e || !hit) return null
  const y = e.y ?? 0
  if (e.wallMounted) {
    const face =
      hit.kind === 'wall'
        ? { px: hit.x, pz: hit.z, nx: Math.round(hit.nx), nz: Math.round(hit.nz) }
        : nearestWallFace(hit.x, hit.z, y + e.h / 2, 150)
    if (face && Math.abs(face.nx) + Math.abs(face.nz) > 0.5) {
      let x = Math.round(face.px + face.nx * (e.d / 2))
      let z = Math.round(face.pz + face.nz * (e.d / 2))
      if (Math.abs(face.nx) > Math.abs(face.nz)) z = round5(z)
      else x = round5(x)
      return { x, z, y, rot: yawFromNormal(face.nx, face.nz) }
    }
    return { x: round5(hit.x), z: round5(hit.z), y, rot: ghostRot }
  }
  if (hit.kind === 'wall') {
    // pointing at a wall: back against the wall face (R still adds 90° steps), snapped along the wall only
    const nx = Math.round(hit.nx)
    const nz = Math.round(hit.nz)
    const rot = normDeg(yawFromNormal(nx, nz) + ghostRot)
    const bb = polyBounds(footprintPolys(catalogId, 0, 0, rot, e.w, e.d))
    if (Math.abs(nx) > Math.abs(nz)) return { x: Math.round(hit.x + (nx > 0 ? -bb.x1 : -bb.x2)), z: round5(hit.z), y, rot }
    return { x: round5(hit.x), z: Math.round(hit.z + (nz > 0 ? -bb.z1 : -bb.z2)), y, rot }
  }
  return { x: round5(hit.x), z: round5(hit.z), y, rot: ghostRot }
}

function Ghost({ catalogId }: { catalogId: string }) {
  const e = getEntry(catalogId)
  const ref = useRef<THREE.Group>(null)
  const pick = usePicker()
  const gl = useThree((st) => st.gl)
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const blockedRef = useRef(false)
  const entry = useFurnitureGeometry({ catalogId, w: e?.w ?? 1, d: e?.d ?? 1, h: e?.h ?? 1 }, false)
  useEffect(() => {
    ghostMat.color.copy(GREEN)
    usePlanner.getState().set({ ghostBlocked: false })
  }, [])
  // render-on-demand: the ghost follows the pointer, so pointer moves must produce a frame
  useEffect(() => {
    const el = gl.domElement
    const onMove = () => invalidate()
    el.addEventListener('pointermove', onMove)
    invalidate()
    return () => {
      el.removeEventListener('pointermove', onMove)
      invalidate()
    }
  }, [gl])

  useFrame((state) => {
    const g = ref.current
    if (!g || !e) return
    if (document.pointerLockElement) ndc.set(0, 0)
    else ndc.copy(state.pointer)
    const pose = computePose(catalogId, pick(ndc), usePlanner.getState().ghostRot)
    if (!pose) {
      g.visible = false
      return
    }
    g.visible = true
    g.position.set(pose.x / 100, pose.y / 100, pose.z / 100)
    g.rotation.set(0, pose.rot * D2R, 0)
    const blocked = collides(catalogId, pose, e, useStore.getState().items)
    if (blocked !== blockedRef.current) {
      blockedRef.current = blocked
      ghostMat.color.copy(blocked ? RED : GREEN)
      usePlanner.getState().set({ ghostBlocked: blocked })
    }
  })

  if (!e) return null
  return (
    <group ref={ref} visible={false}>
      <mesh geometry={entry.geometry} material={ghostMat} renderOrder={5} raycast={noRaycast} />
    </group>
  )
}
const noRaycast = () => {}

// ------------------------------------------------------------------ input: tap to place / deselect, keyboard
function useCanvasInput() {
  const { gl } = useThree()
  const pick = usePicker()
  useEffect(() => {
    const el = gl.domElement
    let down: { x: number; y: number; acc: number } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      down = { x: e.clientX, y: e.clientY, acc: 0 }
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      down.acc += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0)
    }
    const onUp = (e: PointerEvent) => {
      if (!down || e.button !== 0) return
      const moved = Math.max(down.acc, Math.hypot(e.clientX - down.x, e.clientY - down.y))
      down = null
      if (moved > 5) return
      const s = useStore.getState()
      if (s.tool !== 'furniture') return
      if (s.pendingCatalogId) {
        const r = el.getBoundingClientRect()
        const ndc = document.pointerLockElement
          ? new THREE.Vector2(0, 0)
          : new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
        const pose = computePose(s.pendingCatalogId, pick(ndc), usePlanner.getState().ghostRot)
        if (!pose) return
        clickGuard.until = performance.now() + 300
        s.addItem({ catalogId: s.pendingCatalogId, ...pose })
        s.set({ pendingCatalogId: null })
        return
      }
      // empty click deselects (after R3F had the chance to handle an item click)
      const t = performance.now()
      if (t < clickGuard.until) return
      setTimeout(() => {
        const st = useStore.getState()
        if (lastItemClick.t >= t || performance.now() < clickGuard.until - 250) return
        if (st.selectedId && st.items.some((i) => i.id === st.selectedId)) st.set({ selectedId: null })
      }, 30)
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
  }, [gl, pick])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      if (s.tool !== 'furniture' || e.ctrlKey || e.metaKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const k = e.key
      if (s.pendingCatalogId) {
        if (k === 'Escape') s.set({ pendingCatalogId: null })
        else if (k === 'r' || k === 'R') {
          const p = usePlanner.getState()
          p.set({ ghostRot: normDeg(p.ghostRot + (e.shiftKey ? -90 : 90)) })
        }
        return
      }
      const it = s.items.find((i) => i.id === s.selectedId)
      if (!it) return
      if (k === 'Delete' || k === 'Backspace') {
        e.preventDefault()
        s.removeItem(it.id)
      } else if (k === 'Escape') {
        s.set({ selectedId: null })
      } else if (k === 'r' || k === 'R') {
        s.updateItem(it.id, { rot: normDeg(it.rot + (e.shiftKey ? -90 : 90)) })
      } else if (k === 'g' || k === 'G') {
        const p = usePlanner.getState()
        p.set({ gizmoMode: p.gizmoMode === 'translate' ? 'rotate' : 'translate' })
      } else if (e.altKey && k.startsWith('Arrow')) {
        e.preventDefault()
        e.stopPropagation() // keep the walker from moving
        const st = e.shiftKey ? 1 : 5
        const dx = k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0
        const dz = k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0
        s.updateItem(it.id, { x: it.x + dx, z: it.z + dz })
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}

// ------------------------------------------------------------------ layer
export default function FurnitureLayer() {
  const items = useStore((s) => s.items)
  const tool = useStore((s) => s.tool)
  const selectedId = useStore((s) => s.selectedId)
  const pending = useStore((s) => s.pendingCatalogId)
  const objs = useRef(new Map<string, THREE.Object3D>())
  const [, bump] = useState(0)

  useEffect(() => {
    seedIfFirstRun()
  }, [])

  const register = useCallback((id: string, o: THREE.Object3D | null) => {
    if (o) objs.current.set(id, o)
    else objs.current.delete(id)
    bump((v) => v + 1)
  }, [])

  useCanvasInput()
  useLodManager()

  const active = tool === 'furniture'
  const selected = active ? items.find((i) => i.id === selectedId) : undefined
  const target = selected ? objs.current.get(selected.id) : undefined

  return (
    <group name="furniture-layer">
      {items.map((it) => (
        <Item key={it.id} item={it} selected={it.id === selectedId} register={register} />
      ))}
      {selected && target && !pending && <Gizmo key={selected.id} item={selected} object={target} />}
      {selected && <SelectionBox item={selected} />}
      {selected && !pending && <WallDistances item={selected} />}
      {active && pending && <Ghost key={pending} catalogId={pending} />}
    </group>
  )
}
