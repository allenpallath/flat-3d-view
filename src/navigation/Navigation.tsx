// OWNER: Navigation agent (A3). Camera rigs for walk / dollhouse / plan modes. Rendered inside <Canvas>.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { planC } from '../data/planC'
import { planBounds } from '../data/geometry'
import { useStore } from '../store'
import { buildColliders, findFreeSpot, moveCircle, nearestDoor, PLAYER_RADIUS } from './collision'
import { catalogSize } from './catalogLookup'
import { isLookBlocked, isTypingTarget, touchInput } from './input'

const WALK_SPEED = 140 // cm/s
const RUN_SPEED = 280
const ACCEL = 10 // 1/s, exponential approach to target velocity
const DRAG_SENS = 0.22 // deg per px
const LOCK_SENS = 0.12
const PITCH_LIMIT = 80
const DEG = Math.PI / 180

/** Walker state persists across mode switches (module level). */
export const walkState = {
  x: planC.spawn.x,
  z: planC.spawn.z,
  yaw: planC.spawn.yawDeg,
  pitch: -5,
  vx: 0,
  vz: 0,
}

const B = planBounds(planC)
const CENTER = { x: (B.x1 + B.x2) / 200, z: (B.z1 + B.z2) / 200 } // metres
const SPAN = { x: (B.x2 - B.x1) / 100, z: (B.z2 - B.z1) / 100 }

/** set by the furniture planner (A4) while a transform gizmo is being dragged */
const gizmoDragging = () => !!(window as unknown as { __gizmoDragging?: boolean }).__gizmoDragging

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

function useColliders() {
  const doorsOpen = useStore((s) => s.doorsOpen)
  const items = useStore((s) => s.items)
  return useMemo(() => buildColliders(planC, doorsOpen, items, catalogSize), [doorsOpen, items])
}

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}

function WalkController({ active }: { active: boolean }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const getThree = useThree((s) => s.get)
  const colliders = useColliders()
  const collRef = useRef(colliders)
  collRef.current = colliders
  const activeRef = useRef(active)
  activeRef.current = active
  const keys = useRef(new Set<string>())
  const lastWrite = useRef(0)
  const tween = useRef<{ t: number; pos: THREE.Vector3; quat: THREE.Quaternion } | null>(null)
  const lastTeleport = useRef(-1e9)

  /** Put the camera exactly at the walker's eye (no tween). */
  const snapCamera = () => {
    const cam = getThree().camera
    cam.position.set(walkState.x / 100, useStore.getState().eyeHeight / 100, walkState.z / 100)
    cam.quaternion.setFromEuler(new THREE.Euler(walkState.pitch * DEG, walkState.yaw * DEG, 0, 'YXZ'))
    cam.updateMatrixWorld()
  }

  // keep a valid start position
  useEffect(() => {
    const p = findFreeSpot(walkState.x, walkState.z, PLAYER_RADIUS, collRef.current)
    walkState.x = p.x
    walkState.z = p.z
    useStore.getState().set({ player: { x: Math.round(p.x), z: Math.round(p.z), yawDeg: Math.round(walkState.yaw) } })
  }, [])

  // smooth transition when entering walk mode
  useEffect(() => {
    if (active) {
      // a teleport that came with the mode switch (minimap click) jumps straight there
      if (performance.now() - lastTeleport.current < 1000) {
        tween.current = null
        snapCamera()
      } else tween.current = { t: 0, pos: camera.position.clone(), quat: camera.quaternion.clone() }
      if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix()
    } else {
      keys.current.clear()
      walkState.vx = walkState.vz = 0
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock()
    }
  }, [active, camera, gl])

  // teleport requests
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        const t = s.teleport
        if (!t || t === prev.teleport) return
        const p = findFreeSpot(t.x, t.z, PLAYER_RADIUS, collRef.current)
        walkState.x = p.x
        walkState.z = p.z
        walkState.vx = walkState.vz = 0
        if (t.yawDeg != null) walkState.yaw = t.yawDeg
        walkState.pitch = -5
        lastTeleport.current = performance.now()
        tween.current = null
        if (s.mode === 'walk') snapCamera()
        s.set({ player: { x: Math.round(p.x), z: Math.round(p.z), yawDeg: Math.round(walkState.yaw) } })
      }),
    [],
  )

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (!activeRef.current) return
      if (e.code in MOVE_KEYS || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        keys.current.add(e.code)
        if (e.code.startsWith('Arrow')) e.preventDefault()
      } else if (e.code === 'KeyE' && !e.repeat) {
        const id = nearestDoor(planC, walkState.x, walkState.z, 130)
        if (id) useStore.getState().toggleDoor(id)
      } else if (e.code === 'KeyL' && !e.repeat) {
        if (document.pointerLockElement === gl.domElement) document.exitPointerLock()
        else gl.domElement.requestPointerLock?.()
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [gl])

  // drag-to-look + pointer-lock look, on the canvas only
  useEffect(() => {
    const el = gl.domElement
    let drag: { id: number; x: number; y: number } | null = null
    const look = (dx: number, dy: number, sens: number) => {
      walkState.yaw -= dx * sens
      walkState.pitch = THREE.MathUtils.clamp(walkState.pitch - dy * sens, -PITCH_LIMIT, PITCH_LIMIT)
    }
    const onDown = (e: PointerEvent) => {
      if (!activeRef.current || e.button !== 0 || isLookBlocked() || gizmoDragging() || document.pointerLockElement === el) return
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
    }
    const onMove = (e: PointerEvent) => {
      if (!activeRef.current) return
      if (document.pointerLockElement === el) {
        if (e.pointerType === 'mouse') look(e.movementX, e.movementY, LOCK_SENS)
        return
      }
      if (!drag || e.pointerId !== drag.id) return
      if (isLookBlocked() || gizmoDragging()) {
        drag = null
        return
      }
      look(e.clientX - drag.x, e.clientY - drag.y, DRAG_SENS)
      drag.x = e.clientX
      drag.y = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null
    }
    const prevTouch = el.style.touchAction
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      el.style.touchAction = prevTouch
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [gl])

  const tmpPos = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat = useMemo(() => new THREE.Quaternion(), [])
  const tmpEuler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])

  useFrame((state, rawDt) => {
    if (!activeRef.current) return
    const dt = Math.min(rawDt, 0.25) // substeps in moveCircle prevent tunnelling
    const w = walkState

    // touch look
    if (touchInput.lookYaw || touchInput.lookPitch) {
      w.yaw += touchInput.lookYaw
      w.pitch = THREE.MathUtils.clamp(w.pitch + touchInput.lookPitch, -PITCH_LIMIT, PITCH_LIMIT)
      touchInput.lookYaw = touchInput.lookPitch = 0
    }

    // input -> desired local velocity
    let ix = touchInput.moveX
    let iy = touchInput.moveY
    for (const k of keys.current) {
      const m = MOVE_KEYS[k]
      if (m) {
        ix += m[0]
        iy += m[1]
      }
    }
    const mag = Math.hypot(ix, iy)
    if (mag > 1) {
      ix /= mag
      iy /= mag
    }
    const running = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight') || Math.hypot(touchInput.moveX, touchInput.moveY) > 0.95
    const speed = running ? RUN_SPEED : WALK_SPEED
    const yr = w.yaw * DEG
    const fx = -Math.sin(yr)
    const fz = -Math.cos(yr)
    const rx = Math.cos(yr)
    const rz = -Math.sin(yr)
    const tvx = (fx * iy + rx * ix) * speed
    const tvz = (fz * iy + rz * ix) * speed
    const k = 1 - Math.exp(-ACCEL * dt)
    w.vx += (tvx - w.vx) * k
    w.vz += (tvz - w.vz) * k
    if (Math.abs(w.vx) < 0.5 && Math.abs(w.vz) < 0.5 && mag === 0) w.vx = w.vz = 0

    const p = moveCircle(w.x, w.z, w.vx * dt, w.vz * dt, PLAYER_RADIUS, collRef.current)
    // kill velocity into walls so we don't "stick" when sliding
    if (dt > 0) {
      w.vx = Math.abs(p.x - w.x) < Math.abs(w.vx * dt) * 0.5 ? 0 : w.vx
      w.vz = Math.abs(p.z - w.z) < Math.abs(w.vz * dt) * 0.5 ? 0 : w.vz
    }
    w.x = p.x
    w.z = p.z

    const eye = useStore.getState().eyeHeight
    tmpPos.set(w.x / 100, eye / 100, w.z / 100)
    tmpEuler.set(w.pitch * DEG, w.yaw * DEG, 0, 'YXZ')
    tmpQuat.setFromEuler(tmpEuler)

    const tw = tween.current
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / 0.8)
      const e = easeInOut(tw.t)
      camera.position.lerpVectors(tw.pos, tmpPos, e)
      camera.quaternion.slerpQuaternions(tw.quat, tmpQuat, e)
      if (tw.t >= 1) tween.current = null
    } else {
      camera.position.copy(tmpPos)
      camera.quaternion.copy(tmpQuat)
    }

    // throttled store write (~10 Hz), only on change
    const now = state.clock.elapsedTime
    if (now - lastWrite.current > 0.1) {
      lastWrite.current = now
      const cur = useStore.getState().player
      const nx = Math.round(w.x)
      const nz = Math.round(w.z)
      const ny = Math.round(((w.yaw % 360) + 540) % 360 - 180)
      if (cur.x !== nx || cur.z !== nz || cur.yawDeg !== ny) useStore.getState().set({ player: { x: nx, z: nz, yawDeg: ny } })
    }
  })

  return null
}

function DollhouseView() {
  const camera = useThree((s) => s.camera)
  const controls = useRef<OrbitControlsImpl>(null)
  const tween = useRef<{ t: number; from: THREE.Vector3; to: THREE.Vector3 } | null>(null)
  const target = useMemo(() => new THREE.Vector3(CENTER.x, 0, CENTER.z), [])

  useEffect(() => {
    const dist = Math.max(SPAN.x, SPAN.z) * 1.15
    const to = new THREE.Vector3(CENTER.x - dist * 0.25, dist * 0.95, CENTER.z + dist * 0.75)
    tween.current = { t: 0, from: camera.position.clone(), to }
    if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix()
  }, [camera])

  useFrame((_, dt) => {
    const tw = tween.current
    if (!tw) return
    tw.t = Math.min(1, tw.t + Math.min(dt, 0.1) / 1.0)
    camera.position.lerpVectors(tw.from, tw.to, easeInOut(tw.t))
    camera.lookAt(target)
    controls.current?.update()
    if (tw.t >= 1) tween.current = null
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[CENTER.x, 0, CENTER.z]}
      enableDamping
      dampingFactor={0.1}
      minDistance={3}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2 - 0.12}
      screenSpacePanning={false}
    />
  )
}

function PlanView() {
  const size = useThree((s) => s.size)
  const zoom = Math.min(size.width / (SPAN.x + 1), size.height / (SPAN.z + 1.5)) * 0.92
  return (
    <>
      <OrthographicCamera makeDefault position={[CENTER.x, 40, CENTER.z + 0.001]} zoom={zoom} near={0.1} far={200} />
      <OrbitControls
        makeDefault
        target={[CENTER.x, 0, CENTER.z]}
        enableRotate={false}
        enableDamping
        dampingFactor={0.15}
        screenSpacePanning
        minZoom={zoom * 0.5}
        maxZoom={zoom * 8}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
    </>
  )
}

export default function Navigation() {
  const mode = useStore((s) => s.mode)
  return (
    <>
      <WalkController active={mode === 'walk'} />
      {mode === 'dollhouse' && <DollhouseView />}
      {mode === 'plan' && <PlanView />}
    </>
  )
}
