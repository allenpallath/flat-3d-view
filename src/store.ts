// The shared app state (zustand): view mode, tool, settings, doors, the walker's position, placed
// furniture and electrical points. Furniture, points and settings are persisted to localStorage.
// Positions are plan cm; the store never holds three.js objects.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ElectricalPoint, PlacedItem, PointType, Quality, Tool, ViewMode } from './data/schema'

let idCounter = 0
/** Unique id for an item / point: prefix + time + counter (unique within and across sessions). */
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`

/** Walk-mode field of view (degrees, vertical). Lower = zoomed in, higher = wider view. */
export const FOV_DEFAULT = 65
export const FOV_MIN = 30
export const FOV_MAX = 110
const clampFov = (f: number) => Math.min(FOV_MAX, Math.max(FOV_MIN, Math.round(f)))

export interface Teleport {
  /** cm */
  x: number
  z: number
  yawDeg?: number
  /** bumps on every request so repeated teleports to the same spot still fire */
  nonce: number
}

/** Shared state and actions; `set` is the escape hatch for plain field updates. */
export interface AppState {
  // view
  mode: ViewMode
  tool: Tool
  quality: Quality
  overlay: boolean // show the original floor-plan image on the floor
  showCeilings: boolean
  eyeHeight: number // cm
  fov: number // walk-mode zoom, degrees
  doorsOpen: Record<string, boolean> // opening id -> open
  teleport: Teleport | null
  /** current walker position (cm) + yaw, written by navigation for the minimap/HUD */
  player: { x: number; z: number; yawDeg: number }

  // planner
  items: PlacedItem[]
  points: ElectricalPoint[]
  selectedId: string | null
  /** catalog item or point type the user picked and is about to place */
  pendingCatalogId: string | null
  pendingPointType: PointType | null

  // actions
  set: (p: Partial<AppState>) => void
  setMode: (m: ViewMode) => void
  setTool: (t: Tool) => void
  toggleDoor: (id: string) => void
  /** positive = zoom out (wider), negative = zoom in */
  zoomBy: (deltaDeg: number) => void
  setFov: (deg: number) => void
  requestTeleport: (x: number, z: number, yawDeg?: number) => void
  addItem: (i: Omit<PlacedItem, 'id'>) => string
  updateItem: (id: string, p: Partial<PlacedItem>) => void
  removeItem: (id: string) => void
  addPoint: (p: Omit<ElectricalPoint, 'id'>) => string
  updatePoint: (id: string, p: Partial<ElectricalPoint>) => void
  removePoint: (id: string) => void
  replaceAll: (data: { items?: PlacedItem[]; points?: ElectricalPoint[] }) => void
}

/** The app store (persisted subset: items, points, quality, eye height, fov, doors). */
export const useStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'walk',
      tool: 'none',
      quality: 'high',
      overlay: false,
      showCeilings: true,
      eyeHeight: 160,
      fov: FOV_DEFAULT,
      doorsOpen: {},
      teleport: null,
      player: { x: 0, z: 0, yawDeg: 0 },

      items: [],
      points: [],
      selectedId: null,
      pendingCatalogId: null,
      pendingPointType: null,

      set: (p) => set(p),
      setMode: (mode) => set({ mode }),
      setTool: (tool) => set({ tool, pendingCatalogId: null, pendingPointType: null }),
      toggleDoor: (id) => set((s) => ({ doorsOpen: { ...s.doorsOpen, [id]: !(s.doorsOpen[id] ?? true) } })),
      zoomBy: (d) => set((s) => ({ fov: clampFov(s.fov + d) })),
      setFov: (deg) => set({ fov: clampFov(deg) }),
      requestTeleport: (x, z, yawDeg) => set((s) => ({ teleport: { x, z, yawDeg, nonce: (s.teleport?.nonce ?? 0) + 1 } })),

      addItem: (i) => {
        const id = newId('item')
        set((s) => ({ items: [...s.items, { ...i, id }], selectedId: id }))
        return id
      },
      updateItem: (id, p) => set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...p } : it)) })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),

      addPoint: (p) => {
        const id = newId('pt')
        set((s) => ({ points: [...s.points, { ...p, id }], selectedId: id }))
        return id
      },
      updatePoint: (id, p) => set((s) => ({ points: s.points.map((it) => (it.id === id ? { ...it, ...p } : it)) })),
      removePoint: (id) => set((s) => ({ points: s.points.filter((it) => it.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),
      replaceAll: (data) => set((s) => ({ items: data.items ?? s.items, points: data.points ?? s.points, selectedId: null })),
    }),
    {
      name: 'flat-c-planner-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        items: s.items,
        points: s.points,
        quality: s.quality,
        eyeHeight: s.eyeHeight,
        fov: s.fov,
        doorsOpen: s.doorsOpen,
      }),
    },
  ),
)

/** Doors are open unless explicitly closed. */
export const isDoorOpen = (doorsOpen: Record<string, boolean>, id: string) => doorsOpen[id] ?? true
