// OWNER: Materials & Lighting agent (A2).
// Outdoor context so windows don't look into a void: lawn, paved apron + plinth around the flat,
// a ring of simple trees and a few neighbouring apartment blocks far away. Not raycastable.
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import planC from '../data/planC'
import { planBounds } from '../data/geometry'
import { toM } from '../data/schema'
import { useStore } from '../store'
import { getMaterials } from './materials'

const noRaycast = () => null
const GROUND_Y = -0.12

function metrePlane(w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h)
  return g
}

/** Box whose UVs are in metres on every face. */
function metreBox(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1])
  }
  return g
}

function facadeMaterial() {
  // 256 px = 6 m x 6 m: two bays x two floors of an apartment block
  let tex: THREE.Texture | null = null
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')!
    const px = 256 / 6
    ctx.fillStyle = '#e6e0d5'
    ctx.fillRect(0, 0, 256, 256)
    for (let f = 0; f < 2; f++) {
      // slab band
      ctx.fillStyle = '#d2cbbf'
      ctx.fillRect(0, f * 3 * px + 2.75 * px, 256, 0.25 * px)
      for (let b = 0; b < 2; b++) {
        const x = b * 3 * px + 0.7 * px
        const y = f * 3 * px + 0.8 * px
        const w = 1.6 * px
        const h = 1.5 * px
        const grd = ctx.createLinearGradient(x, y, x + w, y + h)
        grd.addColorStop(0, '#6f8494')
        grd.addColorStop(0.6, '#3e4d59')
        grd.addColorStop(1, '#55697a')
        ctx.fillStyle = '#3a3b3d'
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
        ctx.fillStyle = grd
        ctx.fillRect(x, y, w, h)
        ctx.fillStyle = '#3a3b3d'
        ctx.fillRect(x + w / 2 - 1, y, 2, h)
      }
    }
    tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.anisotropy = 8
    tex.repeat.set(1 / 6, 1 / 6)
  }
  return new THREE.MeshStandardMaterial({ map: tex, color: '#ffffff', roughness: 0.85 })
}

// deterministic pseudo random
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function Trees({ cx, cz, count }: { cx: number; cz: number; count: number }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(
    () => ({
      trunk: new THREE.CylinderGeometry(0.12, 0.18, 1, 7).translate(0, 0.5, 0),
      crown: new THREE.IcosahedronGeometry(1, 1),
      trunkMat: new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 0.95 }),
      crownMat: new THREE.MeshStandardMaterial({ color: '#4d6e34', roughness: 0.9, flatShading: true }),
    }),
    [],
  )
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd(i) * 0.4
      const d = 12 + rnd(i + 50) * 16
      const x = cx + Math.cos(a) * d
      const z = cz + Math.sin(a) * d
      const h = 2.5 + rnd(i + 100) * 2.5
      const s = 1.6 + rnd(i + 150) * 1.4
      m.compose(new THREE.Vector3(x, GROUND_Y, z), q, new THREE.Vector3(1, h, 1))
      trunks.current!.setMatrixAt(i, m)
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(i + 200) * 6)
      m.compose(new THREE.Vector3(x, GROUND_Y + h + s * 0.6, z), q, new THREE.Vector3(s, s * 1.15, s))
      crowns.current!.setMatrixAt(i, m)
      q.identity()
    }
    trunks.current!.instanceMatrix.needsUpdate = true
    crowns.current!.instanceMatrix.needsUpdate = true
    trunks.current!.computeBoundingSphere()
    crowns.current!.computeBoundingSphere()
  }, [cx, cz, count])
  return (
    <>
      <instancedMesh ref={trunks} args={[geo.trunk, geo.trunkMat, count]} raycast={noRaycast} />
      <instancedMesh ref={crowns} args={[geo.crown, geo.crownMat, count]} raycast={noRaycast} />
    </>
  )
}

export default function Surroundings() {
  const high = useStore((s) => s.quality) === 'high'
  const mats = getMaterials()
  const data = useMemo(() => {
    const b = planBounds(planC)
    const x1 = toM(b.x1)
    const x2 = toM(b.x2)
    const z1 = toM(b.z1)
    const z2 = toM(b.z2)
    const cx = (x1 + x2) / 2
    const cz = (z1 + z2) / 2
    const apron = 3
    const blocks: { x: number; z: number; w: number; h: number; d: number }[] = [
      { x: cx - 42, z: cz - 6, w: 14, h: 30, d: 22 },
      { x: cx - 36, z: cz + 34, w: 22, h: 36, d: 14 },
      { x: cx + 6, z: cz + 50, w: 26, h: 27, d: 14 },
      { x: cx + 46, z: cz + 18, w: 14, h: 33, d: 24 },
      { x: cx + 40, z: cz - 34, w: 20, h: 24, d: 14 },
      { x: cx - 4, z: cz - 52, w: 28, h: 39, d: 14 },
      { x: cx - 48, z: cz - 44, w: 16, h: 21, d: 16 },
    ]
    return {
      cx,
      cz,
      ground: metrePlane(400, 400),
      apron: metrePlane(x2 - x1 + apron * 2, z2 - z1 + apron * 2),
      plinth: metreBox(x2 - x1, -GROUND_Y - 0.004, z2 - z1),
      plinthPos: [cx, (GROUND_Y - 0.004) / 2, cz] as [number, number, number],
      blocks: blocks.map((k) => ({ ...k, geo: metreBox(k.w, k.h, k.d) })),
      facade: facadeMaterial(),
    }
  }, [])

  return (
    <group>
      <mesh geometry={data.ground} material={mats.grass} rotation-x={-Math.PI / 2} position={[data.cx, GROUND_Y - 0.01, data.cz]} receiveShadow raycast={noRaycast} />
      <mesh geometry={data.apron} material={mats.paving} rotation-x={-Math.PI / 2} position={[data.cx, GROUND_Y, data.cz]} receiveShadow raycast={noRaycast} />
      <mesh geometry={data.plinth} material={mats.concrete} position={data.plinthPos} raycast={noRaycast} />
      {data.blocks.map((k, i) => (
        <mesh key={i} geometry={k.geo} material={data.facade} position={[k.x, GROUND_Y + k.h / 2, k.z]} raycast={noRaycast} />
      ))}
      <Trees cx={data.cx} cz={data.cz} count={high ? 34 : 18} />
    </group>
  )
}
