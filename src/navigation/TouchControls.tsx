// OWNER: Navigation agent (A3). On-screen joystick (bottom-left) + look-pad (bottom-right) for touch devices.
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { isTouchDevice, touchInput } from './input'

const R = 46 // knob travel radius, px
const LOOK_SENS = 0.35 // deg per px

const pad: React.CSSProperties = {
  position: 'fixed',
  bottom: 18,
  width: 128,
  height: 128,
  borderRadius: '50%',
  background: 'rgba(20,22,26,0.45)',
  border: '1px solid rgba(255,255,255,0.25)',
  backdropFilter: 'blur(6px)',
  touchAction: 'none',
  userSelect: 'none',
  zIndex: 20,
}

function Joystick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const origin = useRef<{ id: number; x: number; y: number } | null>(null)
  const end = () => {
    origin.current = null
    touchInput.moveX = touchInput.moveY = 0
    setKnob({ x: 0, y: 0 })
  }
  useEffect(() => end, [])
  return (
    <div
      aria-label="Move joystick"
      style={{ ...pad, left: 18 }}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        origin.current = { id: e.pointerId, x: r.left + r.width / 2, y: r.top + r.height / 2 }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const o = origin.current
        if (!o || o.id !== e.pointerId) return
        let dx = e.clientX - o.x
        let dy = e.clientY - o.y
        const d = Math.hypot(dx, dy)
        if (d > R) {
          dx = (dx / d) * R
          dy = (dy / d) * R
        }
        setKnob({ x: dx, y: dy })
        touchInput.moveX = dx / R
        touchInput.moveY = -dy / R
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        style={{
          position: 'absolute',
          left: 64 - 26 + knob.x,
          top: 64 - 26 + knob.y,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'rgba(224,166,74,0.85)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

function LookPad() {
  const last = useRef<{ id: number; x: number; y: number } | null>(null)
  return (
    <div
      aria-label="Look pad"
      style={{ ...pad, right: 18, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', font: '12px system-ui' }}
      onPointerDown={(e) => {
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const l = last.current
        if (!l || l.id !== e.pointerId) return
        touchInput.lookYaw -= (e.clientX - l.x) * LOOK_SENS
        touchInput.lookPitch -= (e.clientY - l.y) * LOOK_SENS
        l.x = e.clientX
        l.y = e.clientY
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    >
      look
    </div>
  )
}

export default function TouchControls() {
  const mode = useStore((s) => s.mode)
  const [touch, setTouch] = useState(isTouchDevice)
  useEffect(() => {
    const on = () => setTouch(true)
    window.addEventListener('touchstart', on, { once: true, passive: true })
    return () => window.removeEventListener('touchstart', on)
  }, [])
  if (!touch || mode !== 'walk') return null
  return (
    <>
      <Joystick />
      <LookPad />
    </>
  )
}
