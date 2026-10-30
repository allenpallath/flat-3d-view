// `?perf` overlay: fps, draw calls, triangles, geometries, textures, JS heap.
// Shows "idle" when no frame was rendered for 1 s (frameloop="demand").
import { useEffect, useState } from 'react'
import { heapMB, PERF_ENABLED, perfClock, usePerf } from './perfStore'

const IDLE_MS = 1000
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : String(n))

function Overlay() {
  const s = usePerf()
  const [idle, setIdle] = useState(true)
  const [heap, setHeap] = useState<number | null>(null)
  useEffect(() => {
    const id = setInterval(() => {
      setIdle(performance.now() - perfClock.lastFrame > IDLE_MS)
      setHeap(heapMB()) // heap keeps changing while idle too
    }, 500)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="ui-panel ui-perf" data-testid="perf-hud" aria-hidden>
      <div>
        <b>{idle ? 'idle' : `${s.fps.toFixed(s.fps < 10 ? 1 : 0)} fps`}</b>
      </div>
      <div>calls {fmt(s.calls)}</div>
      <div>tris {fmt(s.triangles)}</div>
      <div>geo {s.geometries}</div>
      <div>tex {s.textures}</div>
      <div>prog {s.programs}</div>
      <div>heap {heap === null ? 'n/a' : `${heap.toFixed(0)} MB`}</div>
    </div>
  )
}

/** Perf overlay; renders nothing without `?perf`. */
export default function PerfHUD() {
  return PERF_ENABLED ? <Overlay /> : null
}
