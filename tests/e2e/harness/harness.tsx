// Isolated harness for the UI modules (Toolbar, HUD, MeasureTool, PlanOverlay) that does not
// depend on the rest of the app: plain boxes for walls/floors + a minimal orbit/walk camera.
// Open http://localhost:5186/tests/e2e/harness/index.html
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import planC from '../../../src/data/planC'
import { wallBoxes } from '../../../src/data/geometry'
import { toM } from '../../../src/data/schema'
import { useStore } from '../../../src/store'
import Toolbar from '../../../src/ui/Toolbar'
import HUD from '../../../src/ui/HUD'
import MeasureTool from '../../../src/ui/MeasureTool'
import PlanOverlay from '../../../src/ui/PlanOverlay'

function Boxes() {
  const mode = useStore((s) => s.mode)
  const cut = mode === 'plan' ? 120 : 1e9
  return (
    <group>
      {planC.rooms.map((r) => (
        <mesh key={r.id} rotation-x={-Math.PI / 2} position={[toM((r.rect.x1 + r.rect.x2) / 2), 0, toM((r.rect.z1 + r.rect.z2) / 2)]} userData={{ kind: 'floor', roomId: r.id }}>
          <planeGeometry args={[toM(r.rect.x2 - r.rect.x1), toM(r.rect.z2 - r.rect.z1)]} />
          <meshStandardMaterial color={r.outdoor ? '#9a8f80' : '#d8d2c6'} />
        </mesh>
      ))}
      {planC.walls.flatMap((w) =>
        wallBoxes(w)
          .filter((b) => b.min[1] < cut)
          .map((b, i) => {
            const top = Math.min(b.max[1], cut)
            return (
              <mesh key={`${w.id}-${i}`} position={[toM((b.min[0] + b.max[0]) / 2), toM((b.min[1] + top) / 2), toM((b.min[2] + b.max[2]) / 2)]} userData={{ kind: 'wall', wallId: w.id }}>
                <boxGeometry args={[toM(b.max[0] - b.min[0]), toM(top - b.min[1]), toM(b.max[2] - b.min[2])]} />
                <meshStandardMaterial color={w.kind === 'glass' ? '#9cc' : location.search.includes('red') ? '#d33' : '#f2efe8'} transparent={w.kind === 'glass'} opacity={w.kind === 'glass' ? 0.3 : 1} />
              </mesh>
            )
          }),
      )}
    </group>
  )
}

function Cam() {
  const mode = useStore((s) => s.mode)
  const teleport = useStore((s) => s.teleport)
  const eye = useStore((s) => s.eyeHeight)
  const { camera } = useThree()
  useFrame(() => {
    if (mode !== 'walk') return
    const t = useStore.getState().teleport
    const p = t ?? planC.spawn
    camera.position.set(toM(p.x), toM(eye), toM(p.z))
    camera.rotation.set(0, THREE.MathUtils.degToRad(('yawDeg' in p ? p.yawDeg : 0) ?? 0), 0, 'YXZ')
    const s = useStore.getState().player
    if (s.x !== p.x || s.z !== p.z) useStore.setState({ player: { x: p.x, z: p.z, yawDeg: (p as { yawDeg?: number }).yawDeg ?? 0 } })
  })
  void teleport
  if (mode === 'walk') return null
  return (
    <OrbitControls
      key={mode}
      target={[4.4, 0, 4.4]}
      makeDefault
      onStart={undefined}
      ref={(c) => {
        if (!c) return
        if (mode === 'plan') c.object.position.set(4.4, 14, 4.41)
        else c.object.position.set(-2, 10, 14)
        c.update()
      }}
    />
  )
}

function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas id="scene" gl={{ preserveDrawingBuffer: true }} camera={{ fov: 65, near: 0.05, far: 200 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[8, 12, -4]} intensity={2} />
        <Boxes />
        <PlanOverlay />
        <MeasureTool />
        <Cam />
      </Canvas>
      <Toolbar />
      <HUD />
    </div>
  )
}

;(window as unknown as { __store: typeof useStore }).__store = useStore
createRoot(document.getElementById('root')!).render(<App />)
