// OWNER: UI & QA agent (A6). DOM overlay: bottom-centre room pill + hints, crosshair, welcome card.
import { useState } from 'react'
import { FOV_DEFAULT, FOV_MAX, FOV_MIN, useStore } from '../store'
import planC from '../data/planC'
import { roomAt } from '../data/geometry'
import type { PointType } from '../data/schema'
import { useMeasure } from './measureStore'
import { useUI } from './uiStore'
import './ui.css'

const WELCOME_KEY = 'flat-c-welcome-v1'

const POINT_LABEL: Record<PointType, string> = {
  socket6A: '6A socket',
  socket16A: '16A socket',
  switchboard: 'switchboard',
  tvPoint: 'TV point',
  dataPoint: 'data point',
  acPoint: 'AC point',
  lightPoint: 'light point',
  fanPoint: 'fan point',
  usbSocket: 'USB socket',
}

const prettify = (id: string) => id.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()

function readWelcomeSeen(): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return true // keep automated screenshots clean
    return localStorage.getItem(WELCOME_KEY) === '1'
  } catch {
    return true
  }
}

function useHint(): string {
  const mode = useStore((s) => s.mode)
  const tool = useStore((s) => s.tool)
  const pendingPointType = useStore((s) => s.pendingPointType)
  const pendingCatalogId = useStore((s) => s.pendingCatalogId)
  const selectedId = useStore((s) => s.selectedId)
  const measuring = useMeasure((s) => s.start !== null)

  if (tool === 'measure')
    return measuring
      ? 'Click the second point · hold Shift to lock to an axis · Esc cancels'
      : 'Click a point on any surface to start measuring · Esc to stop'
  if (tool === 'electrical') {
    if (pendingPointType) return `Click a wall to place a ${POINT_LABEL[pendingPointType] ?? prettify(pendingPointType)} — Esc to stop`
    if (selectedId) return 'Drag to move the point · Del deletes · Esc deselects'
    return 'Pick a point type in the panel, or click a point to edit it'
  }
  if (tool === 'furniture') {
    if (pendingCatalogId) return `Click the floor to place the ${prettify(pendingCatalogId)} · R rotates · Esc cancels`
    if (selectedId) return 'Drag to move · R rotates · Del deletes · Esc deselects'
    return 'Pick an item from the catalogue, or click furniture to select it'
  }
  if (mode === 'walk') return 'Drag to look · WASD to move · Shift to run · E: doors · scroll / − + to zoom'
  if (mode === 'dollhouse') return 'Drag to orbit · right-drag to pan · scroll to zoom'
  return 'Drag to pan · scroll to zoom · switch to Walk to go inside'
}

/** Zoom as a magnification relative to the default view (e.g. 0.6× = wider, 2× = closer). */
const zoomFactor = (fov: number) => Math.tan((FOV_DEFAULT * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360)

function ZoomControls() {
  const fov = useStore((s) => s.fov)
  const zoomBy = useStore((s) => s.zoomBy)
  const setFov = useStore((s) => s.setFov)
  return (
    <div className="ui-panel ui-hud-actions ui-zoom" data-testid="zoom">
      <button className="ui-btn" onClick={() => zoomBy(10)} disabled={fov >= FOV_MAX} title="Zoom out — wider view (−)" aria-label="Zoom out">
        −
      </button>
      <button
        className="ui-btn ui-zoom-value"
        onClick={() => setFov(FOV_DEFAULT)}
        title={`Field of view ${fov}° — click to reset (0)`}
        aria-label="Reset zoom"
      >
        {zoomFactor(fov).toFixed(1)}×
      </button>
      <button className="ui-btn" onClick={() => zoomBy(-10)} disabled={fov <= FOV_MIN} title="Zoom in — closer view (+)" aria-label="Zoom in">
        +
      </button>
    </div>
  )
}

export default function HUD() {
  const mode = useStore((s) => s.mode)
  const tool = useStore((s) => s.tool)
  const px = useStore((s) => Math.round(s.player.x))
  const pz = useStore((s) => Math.round(s.player.z))
  const measureCount = useMeasure((s) => s.list.length)
  const measureStarted = useMeasure((s) => s.start !== null)
  const clearMeasure = useMeasure((s) => s.clear)
  const undoMeasure = useMeasure((s) => s.undo)
  const setHelp = useUI((s) => s.setHelp)
  const hint = useHint()
  const [welcomeSeen, setWelcomeSeen] = useState(readWelcomeSeen)

  const room = roomAt(planC, px, pz)
  const label = room?.label?.replace(/\s*[xX]\s*/, ' × ')

  const dismiss = () => {
    setWelcomeSeen(true)
    try {
      localStorage.setItem(WELCOME_KEY, '1')
    } catch {
      /* private mode: just hide for this session */
    }
  }

  return (
    <>
      {mode === 'walk' && <div className="ui-crosshair" aria-hidden="true" />}

      <div className="ui-hud-wrap">
        {mode === 'walk' && <ZoomControls />}
        {(measureCount > 0 || (tool === 'measure' && measureStarted)) && (
          <div className="ui-panel ui-hud-actions">
            <button className="ui-btn" onClick={undoMeasure} disabled={measureCount === 0 && !measureStarted}>
              Undo
            </button>
            <button className="ui-btn" onClick={clearMeasure} data-testid="measure-clear">
              Clear ({measureCount})
            </button>
          </div>
        )}
        <div className="ui-panel ui-hud" data-testid="hud">
          <div>
            <span className="room">{room ? room.name : mode === 'walk' ? 'Outside' : planC.name}</span>
            {label && <span className="size">{label} cm</span>}
          </div>
          <div className="hint">{hint}</div>
        </div>
      </div>

      {!welcomeSeen && (
        <div className="ui-panel ui-welcome" role="dialog" aria-labelledby="ui-welcome-title">
          <h2 id="ui-welcome-title">Welcome to your Type C flat</h2>
          <p>This is a to-scale 3D model of the 2BHK — walk through it like you're there.</p>
          <p>Drag to look around, use WASD / arrows (or the on-screen stick) to move, E to open doors.</p>
          <p>Use Furniture, Electrical and Measure in the toolbar to plan the layout, plug points and TV wall.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              className="ui-btn"
              onClick={() => {
                dismiss()
                setHelp(true)
              }}
            >
              All controls
            </button>
            <button className="ui-btn primary" onClick={dismiss} autoFocus>
              Start exploring
            </button>
          </div>
        </div>
      )}
    </>
  )
}
