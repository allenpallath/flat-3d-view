// OWNER: Furniture Planner agent (A4). Planner-local UI state (not persisted).
import { create } from 'zustand'

export interface PlannerState {
  gizmoMode: 'translate' | 'rotate'
  /** rotation (deg) applied to the placement ghost of floor items */
  ghostRot: number
  /** whether the ghost currently overlaps something */
  ghostBlocked: boolean
  set: (p: Partial<PlannerState>) => void
}

export const usePlanner = create<PlannerState>()((set) => ({
  gizmoMode: 'translate',
  ghostRot: 0,
  ghostBlocked: false,
  set: (p) => set(p),
}))

declare global {
  interface Window {
    /** true while the furniture TransformControls gizmo is being dragged (navigation should not drag-look) */
    __gizmoDragging?: boolean
  }
}

/** timestamp (ms) of the last gizmo drag end / placement, used to swallow the click that follows */
export const clickGuard = { until: 0 }
