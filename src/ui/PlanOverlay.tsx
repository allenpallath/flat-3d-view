// OWNER: UI & QA agent (A6). 3D layer: the original drawing laid on the floor as a scale check.
import { Suspense, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useStore } from '../store'
import { toM } from '../data/schema'
import { planImageExtentCm } from './format'

const URL_ = `${import.meta.env.BASE_URL}floorplan-c.webp`
const EXT = planImageExtentCm()
const W = toM(EXT.x2 - EXT.x1)
const D = toM(EXT.z2 - EXT.z1)
const CX = toM((EXT.x1 + EXT.x2) / 2)
const CZ = toM((EXT.z1 + EXT.z2) / 2)
const Y = toM(0.5)
const noRaycast = () => null

function OverlayPlane() {
  const tex = useTexture(URL_)
  const mode = useStore((s) => s.mode)
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    tex.needsUpdate = true
  }, [tex])
  return (
    // PlaneGeometry lies in XY with +Y = image top; rotating -90° about X maps +Y to -Z (north),
    // so the drawing's top edge lands at the north and its left edge at the west, as on paper.
    <mesh
      rotation-x={-Math.PI / 2}
      position={[CX, Y, CZ]}
      renderOrder={2}
      raycast={noRaycast}
      userData={{ kind: 'overlay' }}
    >
      <planeGeometry args={[W, D]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={mode === 'walk' ? 0.55 : 0.7}
        depthWrite={false}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  )
}

export default function PlanOverlay() {
  const overlay = useStore((s) => s.overlay)
  if (!overlay) return null
  // own Suspense so loading the image never blanks the whole scene
  return (
    <Suspense fallback={null}>
      <OverlayPlane />
    </Suspense>
  )
}
