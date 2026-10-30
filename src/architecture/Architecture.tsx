// OWNER: Architecture agent (A1). Minimal stub so other modules have walls/floors to work against.
import { useMemo } from 'react'
import planC from '../data/planC'
import { wallBoxes } from '../data/geometry'
import { toM } from '../data/schema'
import { getMaterials } from '../materials/materials'

export default function Architecture() {
  const mats = getMaterials()
  const boxes = useMemo(() => planC.walls.flatMap((w) => wallBoxes(w).map((b, i) => ({ w, b, i }))), [])
  return (
    <group>
      {planC.rooms.map((r) => (
        <mesh
          key={r.id}
          rotation-x={-Math.PI / 2}
          position={[toM((r.rect.x1 + r.rect.x2) / 2), 0, toM((r.rect.z1 + r.rect.z2) / 2)]}
          material={mats[r.floor]}
          userData={{ kind: 'floor', roomId: r.id }}
          receiveShadow
        >
          <planeGeometry args={[toM(r.rect.x2 - r.rect.x1), toM(r.rect.z2 - r.rect.z1)]} />
        </mesh>
      ))}
      {boxes.map(({ w, b, i }) => (
        <mesh
          key={`${w.id}-${i}`}
          position={[toM((b.min[0] + b.max[0]) / 2), toM((b.min[1] + b.max[1]) / 2), toM((b.min[2] + b.max[2]) / 2)]}
          material={mats.wallPaint}
          userData={{ kind: 'wall', wallId: w.id }}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[toM(b.max[0] - b.min[0]), toM(b.max[1] - b.min[1]), toM(b.max[2] - b.min[2])]} />
        </mesh>
      ))}
    </group>
  )
}
