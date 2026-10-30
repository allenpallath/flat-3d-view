// OWNER: UI & QA agent (A6). Controls / help modal (portal to body).
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useUI } from './uiStore'
import { IconClose } from './icons'

const K = ({ k }: { k: string }) => <kbd>{k}</kbd>

export default function HelpModal() {
  const open = useUI((s) => s.helpOpen)
  const setHelp = useUI((s) => s.setHelp)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setHelp(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, setHelp])

  if (!open) return null
  return createPortal(
    <div className="ui-modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setHelp(false)}>
      <div className="ui-panel ui-modal" role="dialog" aria-modal="true" aria-labelledby="ui-help-title">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="ui-help-title">Controls</h2>
          <button className="ui-btn" onClick={() => setHelp(false)} aria-label="Close help">
            <IconClose />
          </button>
        </div>

        <h3>Looking & moving</h3>
        <div className="ui-keys">
          <span>Drag</span><span>Look around (walk) / orbit (dollhouse, plan)</span>
          <span><K k="W" /><K k="A" /><K k="S" /><K k="D" /> / arrows</span><span>Walk</span>
          <span><K k="Shift" /></span><span>Run (hold)</span>
          <span><K k="E" /></span><span>Open / close the nearest door</span>
          <span><K k="L" /></span><span>Toggle pointer lock (mouse look without dragging)</span>
          <span>Wheel</span><span>Zoom (dollhouse / plan)</span>
          <span>Minimap</span><span>Click a spot to jump there</span>
        </div>

        <h3>Planning tools</h3>
        <div className="ui-keys">
          <span>Click</span><span>Place / select (a drag never counts as a click)</span>
          <span><K k="R" /></span><span>Rotate the selected item</span>
          <span><K k="Del" /></span><span>Delete the selected item or point</span>
          <span><K k="Esc" /></span><span>Cancel placing / stop the current tool</span>
          <span>Measure</span><span>Click two points; hold <K k="Shift" /> to lock to an axis</span>
        </div>

        <h3>Touch</h3>
        <div className="ui-keys">
          <span>Left stick</span><span>Walk (bottom-left joystick)</span>
          <span>Right pad</span><span>Drag to look (bottom-right)</span>
          <span>Tap</span><span>Place / select / measure</span>
          <span>Pinch</span><span>Zoom (dollhouse / plan)</span>
        </div>

        <h3>Project</h3>
        <p className="ui-muted" style={{ margin: 0 }}>
          Your furniture and points are kept in this browser automatically. Use Save to download a .json file and
          Load to restore it on any device. Turn on <b>Plan overlay</b> to check the 3D model against the original
          drawing.
        </p>
      </div>
    </div>,
    document.body,
  )
}
