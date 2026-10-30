// Perf stats published by <PerfProbe/> (in-canvas) and shown by <PerfHUD/>.
// Enabled with the `?perf` URL flag. Updated at ~2 Hz, never per frame.
import { create } from 'zustand'

export const PERF_ENABLED =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf')

export interface PerfStats {
  fps: number
  /** totals of the last rendered frame, summed over every pass (shadow maps, post-processing) */
  calls: number
  triangles: number
  geometries: number
  textures: number
  programs: number
  /** MB, null when performance.memory is not available (non-Chromium) */
  heapMB: number | null
}

/** Latest published perf stats. */
export const usePerf = create<PerfStats>()(() => ({
  fps: 0,
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
  heapMB: null,
}))

/** performance.now() of the last frame the probe saw (mutable, read by the HUD's idle check). */
export const perfClock = { lastFrame: 0 }

/** Used JS heap in MB, or null outside Chromium. */
export function heapMB(): number | null {
  const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  return m ? m.usedJSHeapSize / 1048576 : null
}
