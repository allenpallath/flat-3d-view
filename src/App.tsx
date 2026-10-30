// OWNER: Manager. Wires the modules together; each module owns its own folder.
import { Suspense, useEffect } from 'react'
import { Canvas, invalidate, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Architecture from './architecture/Architecture'
import Lighting from './materials/Lighting'
import PostFX from './materials/PostFX'
import Navigation from './navigation/Navigation'
import Minimap from './navigation/Minimap'
import RoomCulling from './navigation/RoomCulling'
import FurnitureLayer from './planner/FurnitureLayer'
import CatalogPanel from './planner/CatalogPanel'
import PointsLayer from './electrical/PointsLayer'
import ElectricalPanel from './electrical/ElectricalPanel'
import Toolbar from './ui/Toolbar'
import HUD from './ui/HUD'
import MeasureTool from './ui/MeasureTool'
import PlanOverlay from './ui/PlanOverlay'
import { useStore } from './store'

/** Rendering is on demand: any store change (mode, tool, items, points, doors, settings) redraws. */
function InvalidateOnStoreChange() {
  useEffect(() => useStore.subscribe(() => invalidate()), [])
  return null
}

/** Dev/test hook: exposes the scene so scripts can inspect it. */
function SceneHook() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    ;(window as any).__scene = scene
  }, [scene])
  return null
}

export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        id="scene"
        shadows
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ fov: 65, near: 0.1, far: 200, position: [1.5, 1.6, 1.5] }}
      >
        <Suspense fallback={null}>
          <Lighting />
          <Architecture />
          <FurnitureLayer />
          <PointsLayer />
          <PlanOverlay />
          <MeasureTool />
          <PostFX />
        </Suspense>
        <Navigation />
        <RoomCulling />
        <SceneHook />
        <InvalidateOnStoreChange />
      </Canvas>
      <Toolbar />
      <HUD />
      <Minimap />
      <CatalogPanel />
      <ElectricalPanel />
    </div>
  )
}
