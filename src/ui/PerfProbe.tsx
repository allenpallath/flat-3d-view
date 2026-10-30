// In-canvas perf probe (renders nothing). Mount inside <Canvas>; it is a
// no-op unless the URL has `?perf`. Publishes renderer.info to usePerf and exposes window.__perf.
import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { heapMB, PERF_ENABLED, perfClock, usePerf } from './perfStore'
import { texturesPending, textureScale } from '../materials/materials'

const PUBLISH_MS = 500
/** mutable per-frame accumulators (no allocation per frame) */
const accumulator = { frames: 0, t0: 0, calls: 0, triangles: 0 }

function Probe() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    // renderer.info.render is reset inside every gl.render() by default, so with an EffectComposer it
    // only shows the last pass. Reset once per frame instead (below) so the numbers cover all passes.
    const prev = gl.info.autoReset
    gl.info.autoReset = false
    gl.info.reset()
    const w = window as unknown as { __perf?: unknown }
    w.__perf = {
      stats: () => usePerf.getState(),
      memory: () => ({ ...gl.info.memory }),
      programs: () => gl.info.programs?.length ?? 0,
      heap: () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
      texturesPending,
      textureScale,
      invalidate: () => invalidate(),
      lastFrame: () => perfClock.lastFrame,
    }
    return () => {
      gl.info.autoReset = prev
      delete w.__perf
    }
  }, [gl, invalidate])

  const acc = accumulator
  // Negative priority: runs before the scene / composer render of this frame, so gl.info.render
  // still holds the complete totals of the previous frame. Read them, then reset.
  useFrame(() => {
    const now = performance.now()
    const r = gl.info.render
    acc.calls = r.calls
    acc.triangles = r.triangles
    gl.info.reset()
    acc.frames++
    perfClock.lastFrame = now
    if (acc.t0 === 0) acc.t0 = now
    const dt = now - acc.t0
    if (dt >= PUBLISH_MS) {
      const m = gl.info.memory
      usePerf.setState({
        fps: (acc.frames * 1000) / dt,
        calls: acc.calls,
        triangles: acc.triangles,
        geometries: m.geometries,
        textures: m.textures,
        programs: gl.info.programs?.length ?? 0,
        heapMB: heapMB(),
      })
      acc.frames = 0
      acc.t0 = now
    }
  }, -1000)

  return null
}

/** `<PerfProbe />` — mount once inside <Canvas>. Does nothing without `?perf`. */
export default function PerfProbe() {
  return PERF_ENABLED ? <Probe /> : null
}
