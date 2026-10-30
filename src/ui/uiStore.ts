// OWNER: UI & QA agent (A6). Small UI-only state shared between Toolbar and HUD.
import { create } from 'zustand'

interface UIState {
  helpOpen: boolean
  setHelp: (open: boolean) => void
}

export const useUI = create<UIState>()((set) => ({
  helpOpen: false,
  setHelp: (helpOpen) => set({ helpOpen }),
}))
