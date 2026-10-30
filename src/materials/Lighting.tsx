// OWNER: Materials & Lighting agent (A2).
// Daylight interior lighting: sky, soft-shadowed sun fitted to the flat, interior IBL built from
// Lightformers (no files), hemisphere fill, warm ceiling downlights per room, renderer setup.
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, Lightformer, Sky } from '@react-three/drei'
import * as THREE from 'three'
import planC from '../data/planC'
import { planBounds } from '../data/geometry'
import { toM } from '../data/schema'
import { useStore } from '../store'
import { applyQuality, getMaterials } from './materials'
import Surroundings from './Surroundings'

/** Sun: azimuth measured from north (-z) toward east (+x), degrees; elevation above horizon. */
const SUN_AZIMUTH = -28
const SUN_ELEVATION = 38
export const SUN_DIR = (() => {
  const az = THREE.MathUtils.degToRad(SUN_AZIMUTH)
  const el = THREE.MathUtils.degToRad(SUN_ELEVATION)
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize()
})()

const EXPOSURE = 1.15
const noRaycast = () => null

interface CeilingLight {
  x: number // m
  z: number
  room: string
  /** kept on 'low' quality */
  essential: boolean
}

/** Ceiling downlights: one per indoor room, two in the long hall. */
function ceilingLights(): CeilingLight[] {
  const out: CeilingLight[] = []
  const essential = new Set(['hall', 'kitchen', 'master', 'bedroom'])
  for (const r of planC.rooms) {
    if (r.outdoor) continue
    const { x1, z1, x2, z2 } = r.rect
    const cx = (x1 + x2) / 2
    if (z2 - z1 > 500) {
      // long hall: living + dining
      out.push({ x: toM(cx), z: toM(z1 + (z2 - z1) * 0.3), room: r.id, essential: true })
      out.push({ x: toM(cx), z: toM(z1 + (z2 - z1) * 0.75), room: r.id, essential: false })
    } else {
      out.push({ x: toM(cx), z: toM((z1 + z2) / 2), room: r.id, essential: essential.has(r.id) })
    }
  }
  return out
}

function Downlight({ l, showFixture, quality }: { l: CeilingLight; showFixture: boolean; quality: 'low' | 'high' }) {
  const ceil = toM(planC.ceilingHeight)
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(l.x, 0, l.z)
    return o
  }, [l.x, l.z])
  const small = ['toilet1', 'toilet2', 'washNiche', 'dress1', 'dress2', 'workArea'].includes(l.room)
  return (
    <group>
      <primitive object={target} />
      <spotLight
        position={[l.x, ceil - 0.06, l.z]}
        target={target}
        color="#ffd7a6"
        intensity={small ? 5 : quality === 'high' ? 9 : 12}
        angle={1.05}
        penumbra={0.9}
        decay={2}
        distance={small ? 3.6 : 5.5}
      />
      {showFixture && (
        <mesh position={[l.x, ceil - 0.004, l.z]} rotation-x={Math.PI / 2} material={getMaterials().lightPanel} raycast={noRaycast}>
          <circleGeometry args={[0.075, 24]} />
        </mesh>
      )}
    </group>
  )
}

export default function Lighting() {
  const quality = useStore((s) => s.quality)
  const mode = useStore((s) => s.mode)
  const showCeilings = useStore((s) => s.showCeilings)
  const gl = useThree((s) => s.gl)
  const high = quality === 'high'

  // renderer: AgX tone mapping (photographic highlight roll-off), sRGB output, soft shadows
  useEffect(() => {
    gl.toneMapping = THREE.AgXToneMapping
    gl.toneMappingExposure = EXPOSURE
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    // dev hook for perf checks: __gl.info.render / __gl.info.memory / __gl.info.programs
    if (import.meta.env.DEV) (window as unknown as { __gl: THREE.WebGLRenderer }).__gl = gl
  }, [gl])

  useEffect(() => {
    applyQuality(quality)
    gl.shadowMap.needsUpdate = true
  }, [quality, gl])

  // sun shadow camera fitted to the flat
  const sun = useMemo(() => {
    const b = planBounds(planC)
    const cx = toM((b.x1 + b.x2) / 2)
    const cz = toM((b.z1 + b.z2) / 2)
    const r = Math.hypot(toM(b.x2 - b.x1), toM(b.z2 - b.z1)) / 2 + 0.6
    const dist = 30
    const target = new THREE.Object3D()
    target.position.set(cx, 0, cz)
    return { target, r, dist, pos: [cx + SUN_DIR.x * dist, SUN_DIR.y * dist, cz + SUN_DIR.z * dist] as [number, number, number] }
  }, [])

  const lights = useMemo(ceilingLights, [])
  const active = high ? lights : lights.filter((l) => l.essential)
  const mapSize = high ? 2048 : 1024

  return (
    <>
      <Sky
        distance={4000}
        sunPosition={[SUN_DIR.x * 100, SUN_DIR.y * 100, SUN_DIR.z * 100]}
        turbidity={5}
        rayleigh={1.2}
        mieCoefficient={0.004}
        mieDirectionalG={0.85}
      />
      <fog attach="fog" args={['#d9e1e8', 45, 260]} />

      <primitive object={sun.target} />
      <directionalLight
        key={mapSize /* re-create the shadow map when its size changes */}
        position={sun.pos}
        target={sun.target}
        color="#fff1dc"
        intensity={3.2}
        castShadow
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-sun.r}
        shadow-camera-right={sun.r}
        shadow-camera-top={sun.r}
        shadow-camera-bottom={-sun.r}
        shadow-camera-near={sun.dist - sun.r - 6}
        shadow-camera-far={sun.dist + sun.r + 6}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={high ? 4 : 2}
      />
      <hemisphereLight args={['#dfe8f3', '#b9a78c', 0.45]} />

      {/* Interior image-based lighting: a warm room with bright windows and ceiling lights.
          Gives believable reflections on polished tiles, glass, metal and lacquer. */}
      <Environment resolution={high ? 256 : 128} frames={1} background={false} environmentIntensity={0.55}>
        <color attach="background" args={['#8a8278']} />
        {/* ceiling (bounced light) and floor */}
        <Lightformer form="rect" intensity={1.1} color="#fff8ee" position={[0, 6, 0]} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={0.45} color="#d8c9b0" position={[0, -6, 0]} scale={[12, 12, 1]} />
        {/* windows */}
        <Lightformer form="rect" intensity={5} color="#eaf2ff" position={[0, 1, -8]} scale={[7, 3, 1]} />
        <Lightformer form="rect" intensity={3} color="#f2f6ff" position={[8, 1, 1]} scale={[5, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#fff4e4" position={[-8, 1, 3]} scale={[3, 3, 1]} />
        {/* warm ceiling lights */}
        <Lightformer form="circle" intensity={14} color="#ffd9aa" position={[-2, 5.5, -2]} scale={0.8} />
        <Lightformer form="circle" intensity={14} color="#ffd9aa" position={[2, 5.5, 2]} scale={0.8} />
        <Lightformer form="circle" intensity={14} color="#ffd9aa" position={[2, 5.5, -3]} scale={0.8} />
      </Environment>

      {active.map((l) => (
        <Downlight key={`${l.room}-${l.x}-${l.z}`} l={l} quality={quality} showFixture={mode === 'walk' && showCeilings} />
      ))}

      <Surroundings />
    </>
  )
}
