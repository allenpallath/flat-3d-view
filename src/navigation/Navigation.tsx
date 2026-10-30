// Camera rigs for the three view modes, rendered inside <Canvas>:
//   walk      – first person: keyboard / touch movement with collision, drag or pointer-lock look,
//               wheel / pinch zoom (field of view), teleports from the minimap and panels;
//   dollhouse – OrbitControls around the flat from above (ceilings are hidden by Ceilings.tsx);
//   plan      – orthographic top-down camera, pan + zoom only.
// The walker lives in plan cm (walkState); the camera is placed from it every frame in metres.
import { useEffect, useMemo, useRef } from 'react'
import { advance, invalidate, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { planC } from '../data/planC'
import { planBounds, roomAt } from '../data/geometry'
import { toM } from '../data/schema'
import type { Teleport } from '../store'
import { FOV_DEFAULT, useStore } from '../store'
import { getCatalogItem } from '../planner/catalog'
import { buildColliders, findFreeSpot, moveCircle, nearestDoor, PLAYER_RADIUS, type SizeLookup } from './collision'
import { isTypingTarget, touchInput } from './input'

const WALK_SPEED = 140 // cm/s
const RUN_SPEED = 280 // cm/s
const ACCEL = 10 // 1/s, exponential approach to target velocity
const DRAG_SENS = 0.22 // deg per px
const LOCK_SENS = 0.12 // deg per px of pointer-lock movement
const PITCH_LIMIT = 80 // deg up / down
const START_PITCH = -5 // deg, slightly down so the floor is in view
const DOOR_REACH = 130 // cm: E toggles the nearest door within this distance
const KEY_ZOOM_STEP = 5 // deg of field of view per −/+ key press
const ENTER_TWEEN_S = 0.8 // seconds of the camera glide into walk mode
const FOV_EASE = 14 // 1/s, exponential approach of the camera fov to the chosen zoom
const DEG = Math.PI / 180

// Motion-adaptive resolution: while walking/looking the frame is rendered at a lower pixel ratio
// (motion hides the softness, like a light blur); ~250 ms after motion stops one sharp frame follows.
const BASE_DPR = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
const MOTION_DPR = BASE_DPR >= 1.5 ? BASE_DPR * 0.6 : BASE_DPR * 0.8
const SHARPEN_AFTER_MS = 250
let lastMotion = 0
const noteMotion = () => {
  lastMotion = performance.now()
  invalidate()
}

/** Walker state (cm, cm/s, degrees). Module level so it persists across mode switches. */
const walkState = {
  x: planC.spawn.x,
  z: planC.spawn.z,
  yaw: planC.spawn.yawDeg,
  pitch: START_PITCH,
  vx: 0,
  vz: 0,
}

/** last teleport nonce applied (module level so a remount doesn't re-apply or miss one) */
let appliedNonce = 0

const B = planBounds(planC)
const CENTER = { x: toM((B.x1 + B.x2) / 2), z: toM((B.z1 + B.z2) / 2) } // metres
const SPAN = { x: toM(B.x2 - B.x1), z: toM(B.z2 - B.z1) } // metres

/** set by the furniture planner (plannerStore.ts) while a transform gizmo is being dragged */
const gizmoDragging = () => !!(window as unknown as { __gizmoDragging?: boolean }).__gizmoDragging

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/** Furniture sizes for the walker's colliders, from the planner catalog. */
const catalogSize: SizeLookup = (id) => {
  const c = getCatalogItem(id)
  return c ? { w: c.w, d: c.d, h: c.h, y: c.y } : undefined
}

/** Collision rects (cm) for the current doors and furniture; rebuilt only when those change. */
function useColliders() {
  const doorsOpen = useStore((s) => s.doorsOpen)
  const items = useStore((s) => s.items)
  return useMemo(() => buildColliders(planC, doorsOpen, items, catalogSize), [doorsOpen, items])
}

/** Key code -> [strafe right, forward] input. */
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

/**
 * First-person controller. Always mounted (so keyboard state and teleports are handled in every mode),
 * but only moves the camera while `active` (walk mode).
 */
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

  const tmpPos = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat = useMemo(() => new THREE.Quaternion(), [])
  const tmpEuler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])

  /** Put the camera exactly at the walker's eye (no tween). */
  const snapCamera = () => {
    const cam = getThree().camera
    cam.position.set(toM(walkState.x), toM(useStore.getState().eyeHeight), toM(walkState.z))
    cam.quaternion.setFromEuler(tmpEuler.set(walkState.pitch * DEG, walkState.yaw * DEG, 0, 'YXZ'))
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
      getThree().setDpr(BASE_DPR)
      // walk-mode zoom shouldn't carry over to the dollhouse view
      if (camera instanceof THREE.PerspectiveCamera && camera.fov !== FOV_DEFAULT) {
        camera.fov = FOV_DEFAULT
        camera.updateProjectionMatrix()
      }
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock()
    }
  }, [active, camera, gl])

  // teleport requests (also applies one that arrived before this component mounted)
  useEffect(() => {
    const apply = (t: Teleport | null) => {
      if (!t || t.nonce === appliedNonce) return
      appliedNonce = t.nonce
      const s = useStore.getState()
      const room = roomAt(planC, t.x, t.z)
      const p = findFreeSpot(t.x, t.z, PLAYER_RADIUS, collRef.current, room?.rect)
      walkState.x = p.x
      walkState.z = p.z
      walkState.vx = walkState.vz = 0
      if (t.yawDeg != null) walkState.yaw = t.yawDeg
      walkState.pitch = START_PITCH
      lastTeleport.current = performance.now()
      tween.current = null
      if (s.mode === 'walk') {
        snapCamera()
        // render a frame right away so the new view is on screen before anything else (screenshots, slow GPUs)
        queueMicrotask(() => advance(performance.now()))
      }
      s.set({ player: { x: Math.round(p.x), z: Math.round(p.z), yawDeg: Math.round(walkState.yaw) } })
    }
    apply(useStore.getState().teleport)
    return useStore.subscribe((s, prev) => {
      if (s.teleport !== prev.teleport) apply(s.teleport)
    })
  }, [])

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (!activeRef.current) return
      if (e.code in MOVE_KEYS || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        keys.current.add(e.code)
        noteMotion()
        if (e.code.startsWith('Arrow')) e.preventDefault()
      } else if (e.code === 'KeyE' && !e.repeat) {
        const id = nearestDoor(planC, walkState.x, walkState.z, DOOR_REACH)
        if (id) useStore.getState().toggleDoor(id)
      } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        useStore.getState().zoomBy(KEY_ZOOM_STEP) // zoom out = wider view
      } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        useStore.getState().zoomBy(-KEY_ZOOM_STEP)
      } else if (e.code === 'Digit0' && !e.repeat) {
        useStore.getState().setFov(FOV_DEFAULT)
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
    // two-finger pinch on the canvas zooms (changes the field of view)
    const touches = new Map<number, { x: number; y: number }>()
    let pinchDist = 0
    /** Distance (px) between the two touches (only called while exactly two are down). */
    const spread = () => {
      const it = touches.values()
      const a = it.next().value!
      const b = it.next().value!
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const look = (dx: number, dy: number, sens: number) => {
      const k = sens * (useStore.getState().fov / FOV_DEFAULT) // slower look when zoomed in
      noteMotion()
      walkState.yaw -= dx * k
      walkState.pitch = THREE.MathUtils.clamp(walkState.pitch - dy * k, -PITCH_LIMIT, PITCH_LIMIT)
    }
    const onDown = (e: PointerEvent) => {
      if (!activeRef.current) return
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (touches.size === 2) {
          drag = null
          pinchDist = spread()
          return
        }
      }
      if (e.button !== 0 || gizmoDragging() || document.pointerLockElement === el) return
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
    }
    const onWheel = (e: WheelEvent) => {
      if (!activeRef.current) return
      e.preventDefault()
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      useStore.getState().zoomBy(THREE.MathUtils.clamp(px * 0.04, -8, 8)) // scroll down = wider
    }
    const onMove = (e: PointerEvent) => {
      if (!activeRef.current) return
      const t = touches.get(e.pointerId)
      if (t) {
        t.x = e.clientX // update in place: no allocation per move
        t.y = e.clientY
        if (touches.size === 2) {
          const d = spread()
          if (pinchDist > 0 && d > 0) {
            const s = useStore.getState()
            s.setFov(s.fov * (pinchDist / d)) // fingers apart = zoom in
          }
          pinchDist = d
          return
        }
      }
      if (document.pointerLockElement === el) {
        if (e.pointerType === 'mouse') look(e.movementX, e.movementY, LOCK_SENS)
        return
      }
      if (!drag || e.pointerId !== drag.id) return
      if (gizmoDragging()) {
        drag = null
        return
      }
      look(e.clientX - drag.x, e.clientY - drag.y, DRAG_SENS)
      drag.x = e.clientX
      drag.y = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId)
      if (touches.size < 2) pinchDist = 0
      if (drag && e.pointerId === drag.id) drag = null
    }
    const prevTouch = el.style.touchAction
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      el.style.touchAction = prevTouch
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [gl])

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
    // yaw 0 looks north (-z) and positive yaw turns left (CCW from above), as three.js rotation.y:
    // forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw) on the x/z plane
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
    tmpPos.set(toM(w.x), toM(eye), toM(w.z))
    tmpEuler.set(w.pitch * DEG, w.yaw * DEG, 0, 'YXZ')
    tmpQuat.setFromEuler(tmpEuler)

    // zoom: ease the field of view toward the chosen value
    if (camera instanceof THREE.PerspectiveCamera) {
      const target = useStore.getState().fov
      const diff = target - camera.fov
      let dirty = false
      if (Math.abs(diff) > 0.05) {
        camera.fov += diff * (1 - Math.exp(-FOV_EASE * rawDt))
        dirty = true
      } else if (diff !== 0) {
        camera.fov = target
        dirty = true
      }
      // Near plane as far out as possible (depth precision, less shimmer) while its corners stay
      // inside the walker's collision radius, so hugging a wall never clips through it.
      // A near-plane corner is at distance near * reach from the eye; keep that within 90 % of the radius.
      const tanH = Math.tan((camera.fov * DEG) / 2)
      const reach = Math.sqrt(1 + tanH * tanH * (1 + camera.aspect * camera.aspect))
      const near = Math.min(0.1, (toM(PLAYER_RADIUS) * 0.9) / reach)
      if (Math.abs(camera.near - near) > 1e-4) {
        camera.near = near
        dirty = true
      }
      if (dirty) camera.updateProjectionMatrix()
    }

    const tw = tween.current
    if (tw) {
      tw.t = Math.min(1, tw.t + rawDt / ENTER_TWEEN_S) // wall-clock: finishes on time even at low fps
      const e = easeInOut(tw.t)
      camera.position.lerpVectors(tw.pos, tmpPos, e)
      camera.quaternion.slerpQuaternions(tw.quat, tmpQuat, e)
      if (tw.t >= 1) tween.current = null
    } else {
      camera.position.copy(tmpPos)
      camera.quaternion.copy(tmpQuat)
    }

    // on-demand rendering: keep frames coming while anything is in motion
    const zooming = camera instanceof THREE.PerspectiveCamera && camera.fov !== useStore.getState().fov
    if (mag > 0 || w.vx !== 0 || w.vz !== 0 || tween.current || zooming) noteMotion()
    const settling = performance.now() - lastMotion < SHARPEN_AFTER_MS
    if (settling) state.invalidate() // one more sharp frame comes after motion stops
    const dpr = settling ? MOTION_DPR : BASE_DPR
    if (state.viewport.dpr !== dpr) state.setDpr(dpr)

    // throttled store write (~10 Hz), only on change; yaw is reported wrapped to [-180, 180)
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

/** Orbit view of the whole flat; glides the camera to a 3/4 overview on entry. */
function DollhouseView() {
  const camera = useThree((s) => s.camera)
  const controls = useRef<OrbitControlsImpl>(null)
  const tween = useRef<{ t: number; from: THREE.Vector3; to: THREE.Vector3 } | null>(null)
  const target = useMemo(() => new THREE.Vector3(CENTER.x, 0, CENTER.z), [])

  useEffect(() => {
    const dist = Math.max(SPAN.x, SPAN.z) * 1.15
    const to = new THREE.Vector3(CENTER.x - dist * 0.25, dist * 0.95, CENTER.z + dist * 0.75)
    tween.current = { t: 0, from: camera.position.clone(), to }
    // Viewing from 3–30 m away: a larger near plane gives far better depth precision (no z-fighting).
    const persp = camera instanceof THREE.PerspectiveCamera ? camera : null
    const prevNear = persp?.near
    if (persp) {
      persp.near = 0.5
      persp.updateProjectionMatrix()
    }
    return () => {
      if (persp && prevNear !== undefined) {
        persp.near = prevNear
        persp.updateProjectionMatrix()
      }
    }
  }, [camera])

  useFrame((_, dt) => {
    const tw = tween.current
    if (!tw) return
    tw.t = Math.min(1, tw.t + dt / 1.0)
    invalidate()
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

/** Top-down orthographic view, zoomed to fit the flat; left-drag pans, wheel / pinch zooms. */
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

/** All camera rigs; the store's `mode` decides which one drives the camera. */
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
