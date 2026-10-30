import * as THREE from 'three'

// OWNER: Materials & Lighting agent (A2).
// Contract: getMaterials() returns memoised singleton materials keyed by name.
// Other modules must only use these keys (do not create ad-hoc materials for surfaces listed here).

export type MaterialKey =
  | 'wallPaint' // interior walls, matte warm white
  | 'exteriorWall' // outside faces / wall caps
  | 'ceiling'
  | 'hallTile' // large-format beige marble-look vitrified tile (80x80)
  | 'toiletTile' // wood-look warm tile (floor + walls of toilets)
  | 'balconyTile' // anti-skid matte tile
  | 'skirting'
  | 'woodVeneer' // light oak wardrobes / TV unit / desk
  | 'darkWood' // walnut (door leaves, shelves, coffee table)
  | 'stoneTop' // kitchen / vanity counter top (light quartz)
  | 'kitchenCabinet' // teal-blue matte kitchen shutters (as in render)
  | 'glass'
  | 'metal' // brushed steel (hob, sink, handles)
  | 'blackMetal' // window/door frames, railing
  | 'ceramic' // WC, basins
  | 'fabricBlue' // sofa
  | 'fabricLight' // bed linen, chairs
  | 'plant'
  | 'soil'

let cache: Record<MaterialKey, THREE.Material> | null = null

export function getMaterials(): Record<MaterialKey, THREE.Material> {
  if (cache) return cache
  const std = (color: string, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  cache = {
    wallPaint: std('#efebe4', 0.9),
    exteriorWall: std('#2a2a2c', 0.9),
    ceiling: std('#f6f4ef', 0.95),
    hallTile: std('#e3d9c6', 0.35),
    toiletTile: std('#c89a68', 0.5),
    balconyTile: std('#d8d2c6', 0.8),
    skirting: std('#d9d0c0', 0.6),
    woodVeneer: std('#c8a273', 0.6),
    darkWood: std('#6b4a32', 0.55),
    stoneTop: std('#ece8e1', 0.25),
    kitchenCabinet: std('#3e6a7a', 0.6),
    glass: new THREE.MeshPhysicalMaterial({ color: '#dfeef2', roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.25 }),
    metal: std('#b9bcc0', 0.3, 1),
    blackMetal: std('#222326', 0.5, 0.6),
    ceramic: std('#fafafa', 0.15),
    fabricBlue: std('#2f5370', 0.95),
    fabricLight: std('#d9d4cc', 0.95),
    plant: std('#3f7a37', 0.8),
    soil: std('#4a3a2c', 1),
  }
  return cache
}
