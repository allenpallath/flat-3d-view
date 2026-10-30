// Imperative geometry builder for the procedural furniture models. Every primitive is baked into
// world-of-the-item space (metres) and bucketed per material; build() merges them into ONE
// BufferGeometry with one group per material, so an item is a single (multi-material) mesh.
// Each part also records a cheap low-detail stand-in, used for the distance LOD proxy.
import * as THREE from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type V3 = [number, number, number]
type Mat = THREE.Material

export interface BuiltGeometry {
  geometry: THREE.BufferGeometry
  materials: Mat[]
}

/** Detail primitives that are skipped by the LOD proxy (handles, grooves, screens ...). */
const LOD_MIN_VOLUME = 250 // cm³ (model space)

// drei RoundedBox, reproduced exactly (same shape, extrude params, centring, creased normals)
const EPS = 0.00001
function roundedBoxGeometry(width: number, height: number, depth: number, radius: number, smoothness = 3, bevelSegments = 4, creaseAngle = 0.4) {
  const shape = new THREE.Shape()
  const r = radius - EPS
  shape.absarc(EPS, EPS, EPS, -Math.PI / 2, -Math.PI, true)
  shape.absarc(EPS, height - r * 2, EPS, Math.PI, Math.PI / 2, true)
  shape.absarc(width - r * 2, height - r * 2, EPS, Math.PI / 2, 0, true)
  shape.absarc(width - r * 2, EPS, EPS, 0, -Math.PI / 2, true)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - radius * 2,
    bevelEnabled: true,
    bevelSegments: bevelSegments * 2,
    steps: 1,
    bevelSize: radius - EPS,
    bevelThickness: radius,
    curveSegments: smoothness,
  })
  g.center()
  const out = toCreasedNormals(g, creaseAngle)
  if (out !== g) g.dispose()
  return out
}

/** Non-indexed, position/normal/uv only, no groups: the common format every part is merged in. */
function normalise(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let out = g
  if (g.index) {
    out = g.toNonIndexed()
    g.dispose()
  }
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name)
  if (!out.attributes.uv) {
    const n = out.attributes.position.count
    out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  }
  out.clearGroups()
  return out
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

interface LodPart {
  make: () => THREE.BufferGeometry
  matrix: THREE.Matrix4
  mat: Mat
}

export class GeoBuilder {
  private stack: THREE.Matrix4[] = [new THREE.Matrix4().makeScale(0.01, 0.01, 0.01)]
  private buckets = new Map<Mat, THREE.BufferGeometry[]>()
  private lodParts: LodPart[] = []
  /** when false, only the LOD recipe is recorded (no detailed geometry is built) */
  constructor(private detailed = true) {}

  private local(pos?: V3, rot?: V3, scale?: V3) {
    _p.set(pos?.[0] ?? 0, pos?.[1] ?? 0, pos?.[2] ?? 0)
    _q.setFromEuler(_e.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0))
    _s.set(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1)
    return new THREE.Matrix4().multiplyMatrices(this.stack[this.stack.length - 1], _m.compose(_p, _q, _s))
  }

  /** Add a part. `make` builds its detailed geometry, `lod` (optional) a cheap stand-in. */
  part(make: () => THREE.BufferGeometry, m: Mat, pos?: V3, rot?: V3, scale?: V3, lod?: (() => THREE.BufferGeometry) | null) {
    const matrix = this.local(pos, rot, scale)
    if (lod) this.lodParts.push({ make: lod, matrix, mat: m })
    if (!this.detailed) return
    const g = normalise(make())
    g.applyMatrix4(matrix)
    let list = this.buckets.get(m)
    if (!list) this.buckets.set(m, (list = []))
    list.push(g)
  }

  /** Nested transform (like a <group position rotation>). */
  group(pos: V3 | undefined, rot: V3 | undefined, fn: () => void) {
    this.stack.push(this.local(pos, rot))
    fn()
    this.stack.pop()
  }

  /** Box with p = [centre x, BOTTOM y, centre z], s = [w, h, d]. Rounded when r > 0.2 (after clamping). */
  box(p: V3, s: V3, m: Mat, r = 0, rot?: V3) {
    // Every box is shrunk by 0.1 % of its own size about its centre so coplanar parts don't z-fight.
    const w = s[0] * 0.999
    const h = s[1] * 0.999
    const d = s[2] * 0.999
    const pos: V3 = [p[0], p[1] + s[1] / 2, p[2]]
    const rr = Math.min(r, Math.min(w, h, d) / 2 - 0.01)
    const lod = w * h * d >= LOD_MIN_VOLUME ? () => new THREE.BoxGeometry(w, h, d) : null
    if (rr > 0.2) this.part(() => roundedBoxGeometry(w, h, d, rr), m, pos, rot, undefined, lod)
    else this.part(() => new THREE.BoxGeometry(w, h, d), m, pos, rot, undefined, lod)
  }

  /** Cylinder with p = [centre x, BOTTOM y, centre z]. */
  cyl(p: V3, r: number, h: number, m: Mat, opts: { rt?: number; seg?: number; open?: boolean } = {}) {
    const rt = opts.rt ?? r
    const seg = opts.seg ?? 28
    const open = opts.open ?? false
    const big = Math.max(r, rt)
    const lod = Math.PI * big * big * h >= LOD_MIN_VOLUME || big >= 15 ? () => new THREE.CylinderGeometry(rt, r, h, Math.min(seg, 10), 1, open) : null
    this.part(() => new THREE.CylinderGeometry(rt, r, h, seg, 1, open), m, [p[0], p[1] + h / 2, p[2]], undefined, undefined, lod)
  }

  /** Cylinder whose axis points along +z (knobs, portholes). p = centre. */
  cylZ(p: V3, r: number, h: number, m: Mat, seg = 28) {
    const lod = Math.PI * r * r * h >= LOD_MIN_VOLUME ? () => new THREE.CylinderGeometry(r, r, h, 10) : null
    this.part(() => new THREE.CylinderGeometry(r, r, h, seg), m, p, [Math.PI / 2, 0, 0], undefined, lod)
  }

  /** Sphere (optionally partial / scaled). */
  sphere(pos: V3, args: [number, number, number, number?, number?, number?, number?], m: Mat, scale?: V3, lod = true) {
    const [r, ws, hs, ...rest] = args
    this.part(
      () => new THREE.SphereGeometry(r, ws, hs, ...(rest as number[])),
      m,
      pos,
      undefined,
      scale,
      lod ? () => new THREE.SphereGeometry(r, 8, 5, ...(rest as number[])) : null,
    )
  }

  torus(pos: V3, rot: V3 | undefined, args: [number, number, number, number], m: Mat) {
    this.part(() => new THREE.TorusGeometry(...args), m, pos, rot, undefined, null)
  }

  plane(pos: V3, w: number, h: number, m: Mat) {
    this.part(() => new THREE.PlaneGeometry(w, h), m, pos, undefined, undefined, null)
  }

  /** Merge the detailed parts: one geometry, one group per material. */
  build(): BuiltGeometry {
    return mergeBuckets(this.buckets)
  }

  /** Merge the low-detail stand-ins (plain boxes / low-poly cylinders, small details dropped). */
  buildLod(): BuiltGeometry {
    const buckets = new Map<Mat, THREE.BufferGeometry[]>()
    for (const p of this.lodParts) {
      const g = normalise(p.make())
      g.applyMatrix4(p.matrix)
      let list = buckets.get(p.mat)
      if (!list) buckets.set(p.mat, (list = []))
      list.push(g)
    }
    return mergeBuckets(buckets)
  }
}

function mergeBuckets(buckets: Map<Mat, THREE.BufferGeometry[]>): BuiltGeometry {
  const materials: Mat[] = []
  const perMat: THREE.BufferGeometry[] = []
  for (const [mat, list] of buckets) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false)
    if (list.length > 1) for (const g of list) g.dispose()
    if (!merged) continue
    materials.push(mat)
    perMat.push(merged)
  }
  let geometry: THREE.BufferGeometry
  if (perMat.length === 0) {
    geometry = new THREE.BufferGeometry()
  } else {
    geometry = mergeGeometries(perMat, true) ?? new THREE.BufferGeometry()
    for (const g of perMat) g.dispose()
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return { geometry, materials }
}
