// OWNER: UI & QA agent (A6). Local state for the measure tool (not persisted).
import { create } from 'zustand'
import type { Vec3 } from './format'

export interface Measurement {
  id: number
  a: Vec3 // metres
  b: Vec3 // metres
}

interface MeasureState {
  list: Measurement[]
  /** first point of the in-progress measurement (metres) */
  start: Vec3 | null
  setStart: (p: Vec3 | null) => void
  add: (a: Vec3, b: Vec3) => void
  undo: () => void
  clear: () => void
}

let nextId = 1
export const useMeasure = create<MeasureState>()((set) => ({
  list: [],
  start: null,
  setStart: (start) => set({ start }),
  add: (a, b) => set((s) => ({ list: [...s.list, { id: nextId++, a, b }], start: null })),
  undo: () => set((s) => ({ list: s.list.slice(0, -1), start: null })),
  clear: () => set({ list: [], start: null }),
}))
