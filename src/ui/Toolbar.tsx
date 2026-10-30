// DOM overlay: top-centre toolbar.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import type { ElectricalPoint, PlacedItem, Tool, ViewMode } from '../data/schema'
import { makeProject, parseProject } from './format'
import HelpModal from './HelpModal'
import { useUI } from './uiStore'
import {
  IconCamera, IconCeiling, IconGear, IconHelp, IconHouse, IconLayers, IconLoad, IconPlan, IconPlug, IconRuler, IconSave, IconSofa, IconWalk,
} from './icons'
import './ui.css'

const MODES: { id: ViewMode; label: string; icon: ReactNode; title: string }[] = [
  { id: 'walk', label: 'Walk', icon: <IconWalk />, title: 'Walk through at eye height' },
  { id: 'dollhouse', label: 'Dollhouse', icon: <IconHouse />, title: 'Orbit around a roofless model' },
  { id: 'plan', label: 'Plan', icon: <IconPlan />, title: 'Top-down plan view' },
]

const TOOLS: { id: Exclude<Tool, 'none'>; label: string; icon: ReactNode; title: string }[] = [
  { id: 'furniture', label: 'Furniture', icon: <IconSofa />, title: 'Place and arrange furniture' },
  { id: 'electrical', label: 'Electrical', icon: <IconPlug />, title: 'Plan sockets, switches and TV points' },
  { id: 'measure', label: 'Measure', icon: <IconRuler />, title: 'Measure between two points' },
]

function download(name: string, href: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')

function findCanvas(): HTMLCanvasElement | null {
  return (
    (document.querySelector('canvas#scene') as HTMLCanvasElement | null) ??
    (document.querySelector('#scene canvas') as HTMLCanvasElement | null) ??
    document.querySelector('canvas')
  )
}

/** Top-centre toolbar: view modes, tools, toggles, settings, save / load / screenshot / help. */
export default function Toolbar() {
  const mode = useStore((s) => s.mode)
  const tool = useStore((s) => s.tool)
  const quality = useStore((s) => s.quality)
  const overlay = useStore((s) => s.overlay)
  const showCeilings = useStore((s) => s.showCeilings)
  const eyeHeight = useStore((s) => s.eyeHeight)
  const setMode = useStore((s) => s.setMode)
  const setTool = useStore((s) => s.setTool)
  const set = useStore((s) => s.set)
  const setHelp = useUI((s) => s.setHelp)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // close the settings popover on outside click
  useEffect(() => {
    if (!settingsOpen) return
    const onDown = (e: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [settingsOpen])

  const onSave = () => {
    const { items, points } = useStore.getState()
    const blob = new Blob([JSON.stringify(makeProject(items, points), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    download(`flat-c-project-${stamp()}.json`, url)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setToast(`Saved ${items.length} items, ${points.length} points`)
  }

  const onLoadFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const { items, points } = parseProject(await f.text())
      // parseProject checks the required fields; fill optional ones older / hand-edited files may lack
      useStore.getState().replaceAll({
        items: (items as PlacedItem[]).map((i) => ({ ...i, y: i.y ?? 0, rot: i.rot ?? 0 })),
        points: (points as ElectricalPoint[]).map((p) => ({ ...p, nx: p.nx ?? 0, nz: p.nz ?? 0 })),
      })
      setToast(`Loaded ${items.length} items, ${points.length} points`)
    } catch (err) {
      setToast(`Could not load: ${(err as Error).message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onScreenshot = () => {
    const c = findCanvas()
    if (!c) return setToast('No 3D view found')
    try {
      download(`flat-c-${mode}-${stamp()}.png`, c.toDataURL('image/png'))
      setToast('Screenshot saved')
    } catch (err) {
      setToast(`Screenshot failed: ${(err as Error).message}`)
    }
  }

  return (
    <>
      <div className="ui-toolbar-wrap" ref={settingsRef}>
        <div className="ui-panel ui-toolbar" role="toolbar" aria-label="View and tools">
          <div className="ui-seg" role="radiogroup" aria-label="View mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`ui-btn${mode === m.id ? ' on' : ''}`}
                role="radio"
                aria-checked={mode === m.id}
                title={m.title}
                onClick={() => setMode(m.id)}
                data-testid={`mode-${m.id}`}
              >
                {m.icon}
                <span className="lbl">{m.label}</span>
              </button>
            ))}
          </div>

          <span className="ui-sep" />

          <div className="ui-group" aria-label="Tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={`ui-btn${tool === t.id ? ' on' : ''}`}
                aria-pressed={tool === t.id}
                title={t.title + (tool === t.id ? ' (click to turn off)' : '')}
                onClick={() => setTool(tool === t.id ? 'none' : t.id)}
                data-testid={`tool-${t.id}`}
              >
                {t.icon}
                <span className="lbl">{t.label}</span>
              </button>
            ))}
          </div>

          <span className="ui-sep" />

          <div className="ui-group">
            <button
              className={`ui-btn${overlay ? ' on' : ''}`}
              aria-pressed={overlay}
              title="Show the original floor-plan drawing on the floor (scale check)"
              onClick={() => set({ overlay: !overlay })}
              data-testid="toggle-overlay"
            >
              <IconLayers />
              <span className="lbl">Overlay</span>
            </button>
            <button
              className={`ui-btn${showCeilings ? ' on' : ''}`}
              aria-pressed={showCeilings}
              title="Show ceilings (walk mode)"
              onClick={() => set({ showCeilings: !showCeilings })}
              data-testid="toggle-ceilings"
            >
              <IconCeiling />
              <span className="lbl">Ceilings</span>
            </button>
            <div className="ui-seg" role="radiogroup" aria-label="Render quality" title="Render quality">
              {(['high', 'low'] as const).map((q) => (
                <button
                  key={q}
                  className={`ui-btn${quality === q ? ' on' : ''}`}
                  role="radio"
                  aria-checked={quality === q}
                  onClick={() => set({ quality: q })}
                  style={{ padding: '5px 7px' }}
                  title={q === 'high' ? 'High quality: shadows and effects' : 'Low quality: faster on phones'}
                >
                  {q === 'high' ? 'HQ' : 'LQ'}
                </button>
              ))}
            </div>
          </div>

          <span className="ui-sep" />

          <div className="ui-group">
            <button className={`ui-btn${settingsOpen ? ' on' : ''}`} title="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((o) => !o)}>
              <IconGear />
            </button>
            <button className="ui-btn" title="Save project (.json)" onClick={onSave}>
              <IconSave />
            </button>
            <button className="ui-btn" title="Load project (.json)" onClick={() => fileRef.current?.click()}>
              <IconLoad />
            </button>
            <button className="ui-btn" title="Save a screenshot (.png)" onClick={onScreenshot}>
              <IconCamera />
            </button>
            <button className="ui-btn" title="Help and controls" onClick={() => setHelp(true)} data-testid="help">
              <IconHelp />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => onLoadFile(e.target.files?.[0])}
          />
        </div>

        {settingsOpen && (
          <div className="ui-panel ui-popover" role="dialog" aria-label="Settings">
            <label htmlFor="ui-eye">
              Eye height <b style={{ color: '#e0a64a' }}>{eyeHeight} cm</b>
            </label>
            <input
              id="ui-eye"
              type="range"
              min={140}
              max={190}
              step={1}
              value={eyeHeight}
              onChange={(e) => set({ eyeHeight: Number(e.target.value) })}
            />
            <div className="ui-muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>140</span>
              <span>Camera height in walk mode</span>
              <span>190</span>
            </div>
          </div>
        )}

        {toast && (
          <div className="ui-panel ui-toast" role="status">
            {toast}
          </div>
        )}
      </div>
      <HelpModal />
    </>
  )
}
