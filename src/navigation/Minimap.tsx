// OWNER: Navigation agent (A3). DOM overlay: top-right minimap + quick-teleport room list (+ touch controls).
import { useEffect, useMemo, useState } from 'react'
import { planC } from '../data/planC'
import { planBounds, rectCenter, roomAt } from '../data/geometry'
import { isDoorOpen, useStore } from '../store'
import { doorOpenings } from './collision'
import TouchControls from './TouchControls'

const SHORT: Record<string, string> = {
  hall: 'Hall',
  kitchen: 'Kitchen',
  washNiche: 'Wash Basin',
  balcony1: 'Balcony (Hall)',
  master: 'Master Bedroom',
  dress1: 'Dress (Master)',
  balcony2: 'Balcony (Master)',
  toilet1: 'Toilet (Master)',
  toilet2: 'Toilet 2',
  bedroom: 'Bedroom 2',
  dress2: 'Dress 2',
  balcony3: 'Balcony 2',
  workArea: 'Work Area',
}
const ACCENT = '#e0a64a'
const PAD = 20
const B = planBounds(planC)
const VB = { x: B.x1 - PAD, z: B.z1 - PAD, w: B.x2 - B.x1 + PAD * 2, h: B.z2 - B.z1 + PAD * 2 }
const DOORS = doorOpenings(planC)

const panel: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  background: 'rgba(20,22,26,0.82)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  borderRadius: 10,
  color: '#fff',
  font: '13px system-ui, -apple-system, Segoe UI, sans-serif',
  padding: 8,
  zIndex: 15,
  boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
  userSelect: 'none',
}
const btn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(255,255,255,0.14)',
  color: '#fff',
  borderRadius: 6,
  padding: '3px 7px',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  lineHeight: 1.3,
}

const useMedia = (q: string) => {
  const [small, setSmall] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches)
  useEffect(() => {
    const m = window.matchMedia?.(q)
    if (!m) return
    const on = () => setSmall(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return small
}
const useSmallScreen = () => useMedia('(max-width: 640px)')

function teleportTo(x: number, z: number, yawDeg?: number) {
  const s = useStore.getState()
  if (s.mode !== 'walk') s.setMode('walk')
  s.requestTeleport(Math.round(x), Math.round(z), yawDeg)
}

function MapSvg({ width }: { width: number }) {
  const player = useStore((s) => s.player)
  const doorsOpen = useStore((s) => s.doorsOpen)
  const current = roomAt(planC, player.x, player.z)
  const yr = (player.yawDeg * Math.PI) / 180
  const cone = useMemo(() => {
    const L = 130
    const a = 32 * (Math.PI / 180)
    const pt = (ang: number) => `${player.x - Math.sin(ang) * L},${player.z - Math.cos(ang) * L}`
    return `M${player.x},${player.z} L${pt(yr + a)} L${pt(yr - a)} Z`
  }, [player.x, player.z, yr])

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const m = svg.getScreenCTM()
    if (!m) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    if (roomAt(planC, p.x, p.y)) teleportTo(p.x, p.y)
  }

  return (
    <svg
      viewBox={`${VB.x} ${VB.z} ${VB.w} ${VB.h}`}
      width={width}
      height={(width * VB.h) / VB.w}
      style={{ display: 'block', cursor: 'crosshair', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}
      onClick={onClick}
      role="img"
      aria-label="Minimap: click a room to walk there"
    >
      {planC.rooms.map((r) => (
        <rect
          key={r.id}
          x={r.rect.x1}
          y={r.rect.z1}
          width={r.rect.x2 - r.rect.x1}
          height={r.rect.z2 - r.rect.z1}
          fill={r.id === current?.id ? ACCENT : r.outdoor ? '#7d8f74' : '#d8d2c4'}
          fillOpacity={r.id === current?.id ? 0.75 : 0.9}
        >
          <title>{r.name}</title>
        </rect>
      ))}
      {planC.walls.map((w) => (
        <rect
          key={w.id}
          x={w.rect.x1}
          y={w.rect.z1}
          width={w.rect.x2 - w.rect.x1}
          height={w.rect.z2 - w.rect.z1}
          fill={w.kind === 'railing' || w.kind === 'glass' ? '#5a6a78' : '#1b1c1f'}
          pointerEvents="none"
        />
      ))}
      {DOORS.map((d) => (
        <rect
          key={d.opening.id}
          x={d.rect.x1}
          y={d.rect.z1}
          width={d.rect.x2 - d.rect.x1}
          height={d.rect.z2 - d.rect.z1}
          fill={isDoorOpen(doorsOpen, d.opening.id) ? '#d8d2c4' : '#a0522d'}
          pointerEvents="none"
        />
      ))}
      <path d={cone} fill={ACCENT} fillOpacity={0.45} pointerEvents="none" />
      <circle cx={player.x} cy={player.z} r={18} fill={ACCENT} stroke="#fff" strokeWidth={5} pointerEvents="none" />
    </svg>
  )
}

export default function Minimap() {
  const small = useSmallScreen()
  const phone = useMedia('(max-width: 480px)')
  const [open, setOpen] = useState(!phone)
  const [mapOpen, setMapOpen] = useState(true)
  const [listOpen, setListOpen] = useState(!small)
  useEffect(() => setListOpen(!small), [small])
  useEffect(() => setOpen(!phone), [phone])
  const playerRoom = useStore((s) => roomAt(planC, s.player.x, s.player.z)?.id)
  const width = small ? 150 : 204

  if (!open)
    return (
      <>
        <button
          data-testid="minimap-toggle"
          style={{ ...btn, position: 'fixed', top: 12, right: 12, zIndex: 15, padding: '6px 9px', background: 'rgba(20,22,26,0.82)', backdropFilter: 'blur(8px)' }}
          onClick={() => setOpen(true)}
          title="Show map"
          aria-label="Show map"
        >
          Map
        </button>
        <TouchControls />
      </>
    )

  return (
    <>
      <div style={{ ...panel, width: mapOpen ? width : undefined }} data-testid="minimap">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: mapOpen || listOpen ? 6 : 0 }}>
          <span style={{ fontWeight: 600, flex: 1, whiteSpace: 'nowrap' }}>{mapOpen ? (SHORT[playerRoom ?? ''] ?? 'Map') : ''}</span>
          {phone && (
            <button style={btn} onClick={() => setOpen(false)} title="Close" aria-label="Close map">
              ✕
            </button>
          )}
          <button style={btn} onClick={() => setMapOpen((v) => !v)} title={mapOpen ? 'Hide map' : 'Show map'}>
            {mapOpen ? 'Map ▴' : 'Map ▾'}
          </button>
          <button style={btn} onClick={() => setListOpen((v) => !v)} title="Rooms">
            {listOpen ? 'Rooms ▴' : 'Rooms ▾'}
          </button>
        </div>
        {mapOpen && <MapSvg width={width} />}
        {listOpen && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, maxWidth: width, maxHeight: small ? 160 : undefined, overflowY: 'auto' }}>
            {planC.rooms.map((r) => {
              const c = rectCenter(r.rect)
              const on = r.id === playerRoom
              return (
                <button
                  key={r.id}
                  style={{ ...btn, ...(on ? { background: ACCENT, color: '#1b1c1f', borderColor: ACCENT } : null) }}
                  onClick={() => {
                    teleportTo(c.x, c.z)
                    if (phone) setOpen(false)
                  }}
                  title={`Walk to ${r.name}`}
                >
                  {SHORT[r.id] ?? r.name}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <TouchControls />
    </>
  )
}
