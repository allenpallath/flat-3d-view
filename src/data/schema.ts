// Shared contracts. ALL plan coordinates are in centimetres.
// Origin = top-left (north-west) interior corner of the Hall.
// +x = east (right on the drawing), +z = south (down on the drawing), y = up.
// Scene units are METRES: use cm() / toM() when converting.

export const CM = 0.01
export const toM = (cm: number) => cm * CM

export interface Rect {
  x1: number
  z1: number
  x2: number
  z2: number
}

export type FloorMaterial = 'hallTile' | 'toiletTile' | 'balconyTile'

export interface Room {
  id: string
  name: string
  /** label as printed on the drawing, e.g. "300X300" (width X length) */
  label?: string
  rect: Rect
  floor: FloorMaterial
  outdoor?: boolean
}

export type OpeningKind =
  | 'door' // hinged door leaf
  | 'mainDoor' // entrance door
  | 'sliding' // glass sliding door (balcony / dress)
  | 'window'
  | 'ventilator' // small high toilet window
  | 'opening' // empty opening, no leaf

export interface Opening {
  id: string
  kind: OpeningKind
  /** start / end along the wall's long axis (absolute x or z in cm) */
  from: number
  to: number
  /** bottom of opening above floor, cm */
  sill: number
  /** top of opening above floor, cm */
  head: number
  /** door only: which end the hinge is at */
  hinge?: 'from' | 'to'
  /** door only: leaf swings toward -1 (negative x/z side) or +1 */
  swing?: -1 | 1
}

export type WallKind = 'exterior' | 'interior' | 'parapet' | 'railing' | 'glass'

export interface Wall {
  id: string
  rect: Rect
  height: number
  kind: WallKind
  openings?: Opening[]
}

export type FixtureType =
  | 'kitchenCounter'
  | 'breakfastCounter'
  | 'hob'
  | 'sink'
  | 'chimney'
  | 'vanity' // wash basin on a cabinet
  | 'wc'
  | 'showerGlass'
  | 'showerDrain'
  | 'planter'

export interface Fixture {
  id: string
  type: FixtureType
  room: string
  rect: Rect
  /** bottom elevation, cm */
  y?: number
  height: number
}

export interface Plan {
  name: string
  ceilingHeight: number
  rooms: Room[]
  walls: Wall[]
  fixtures: Fixture[]
  spawn: { x: number; z: number; yawDeg: number }
}

/** Box in cm, used for wall pieces and colliders. */
export interface Box {
  min: [number, number, number]
  max: [number, number, number]
}

// ---------- Planner state (shared by planner/, electrical/, ui/) ----------

export interface CatalogItem {
  id: string
  name: string
  category: 'living' | 'dining' | 'bedroom' | 'kitchen' | 'storage' | 'appliance' | 'decor' | 'study'
  /** footprint width (x before rotation), depth (z), height, cm */
  w: number
  d: number
  h: number
  color: string
  /** default elevation (e.g. wall-mounted TV), cm */
  y?: number
  /** wall mounted items snap to walls */
  wallMounted?: boolean
}

export interface PlacedItem {
  id: string
  catalogId: string
  /** centre position, cm */
  x: number
  z: number
  /** bottom elevation, cm */
  y: number
  /** rotation about Y in degrees (counter-clockwise looking down) */
  rot: number
  /** optional override of size (e.g. TV inches) */
  w?: number
  d?: number
  h?: number
  color?: string
}

export type PointType =
  | 'socket6A'
  | 'socket16A'
  | 'switchboard'
  | 'tvPoint'
  | 'dataPoint'
  | 'acPoint'
  | 'lightPoint'
  | 'fanPoint'
  | 'usbSocket'

export interface ElectricalPoint {
  id: string
  type: PointType
  /** position on the wall surface, cm */
  x: number
  y: number
  z: number
  /** outward wall normal (unit, horizontal) */
  nx: number
  nz: number
  wallId?: string
  roomId?: string
  note?: string
}

export type ViewMode = 'walk' | 'dollhouse' | 'plan'
export type Tool = 'none' | 'furniture' | 'electrical' | 'measure'
export type Quality = 'low' | 'high'

/** userData tags put on meshes so tools can raycast against them */
export type MeshTag =
  | { kind: 'wall'; wallId: string }
  | { kind: 'floor'; roomId: string }
  | { kind: 'ceiling'; roomId: string }
  | { kind: 'furniture'; itemId: string }
  | { kind: 'point'; pointId: string }
  | { kind: 'fixture'; fixtureId: string }
