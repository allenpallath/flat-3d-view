// Electrical-only UI state: panel open/closed, the placement height override and the per-TV-point
// preview settings (persisted in localStorage separately from the main plan).
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { TV_CENTRE_CM } from '../data/tv'

export interface TvPlan {
  inches: number
  /** TV centre height above floor, cm */
  centre: number
  show: boolean
}

export const DEFAULT_TV: TvPlan = { inches: 55, centre: TV_CENTRE_CM, show: true }

interface ElecUi {
  panelOpen: boolean
  /** height (cm) to place the armed type at; null = preset default */
  heightOverride: number | null
  tv: Record<string, TvPlan>
  setPanelOpen: (v: boolean) => void
  setHeightOverride: (h: number | null) => void
  setTv: (pointId: string, p: Partial<TvPlan>) => void
}

/** Electrical UI store; only the TV preview settings are persisted. */
export const useElecUi = create<ElecUi>()(
  persist(
    (set) => ({
      panelOpen: typeof window === 'undefined' ? true : window.innerWidth > 640,
      heightOverride: null,
      tv: {},
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setHeightOverride: (heightOverride) => set({ heightOverride }),
      setTv: (id, p) => set((s) => ({ tv: { ...s.tv, [id]: { ...DEFAULT_TV, ...s.tv[id], ...p } } })),
    }),
    {
      name: 'flat-c-electrical-ui-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ tv: s.tv }),
    },
  ),
)

/** TV preview settings of a TV point, with defaults filled in. */
export const tvPlanFor = (tv: Record<string, TvPlan>, id: string): TvPlan => ({ ...DEFAULT_TV, ...tv[id] })
