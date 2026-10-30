// Root component: the 3D <Canvas> with every scene layer, plus the DOM overlays (toolbar, HUD,
// minimap, side panels). Modules talk to each other only through the zustand store (store.ts).
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
import PerfProbe from './ui/PerfProbe'
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
    ;(window as unknown as { __scene: THREE.Scene }).__scene = scene
  }, [scene])
  return null
}

/**
 * Rendering is on demand (frameloop="demand"): a frame is drawn only after invalidate(), so anything
 * that animates (doors, camera glides, shadow updates) keeps calling invalidate() until it settles.
 */
export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        id="scene"
        shadows
        frameloop="demand"
        dpr={[1, 2]}
        // tone mapping is set by <Lighting/> (AgX); preserveDrawingBuffer keeps screenshots working
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.AgXToneMapping }}
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
        <PerfProbe />
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
