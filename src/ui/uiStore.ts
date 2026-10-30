// Small UI-only state shared between Toolbar and HUD.
import { create } from 'zustand'

interface UIState {
  helpOpen: boolean
  setHelp: (open: boolean) => void
}

/** Toolbar / HUD shared UI store. */
export const useUI = create<UIState>()((set) => ({
  helpOpen: false,
  setHelp: (helpOpen) => set({ helpOpen }),
}))
