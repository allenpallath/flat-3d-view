// OWNER: Electrical Planner agent (A5). DOM side panel shown when tool === 'electrical'.
import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { newId, useStore } from '../store'
import planC from '../data/planC'
import type { ElectricalPoint, PointType } from '../data/schema'
import { POINT_TYPES, PRESETS, TV_SIZES, tvSizeCm, tvViewingRange } from './presets'
import { plateDataUrl } from './plateTexture'
import { suggestedPoints } from './suggested'
import { countByType, parsePointsJson, pointsToCsv, pointsToJson } from './exportCsv'
import { alongInfo, ceilingInfo, isCeilingPoint, overlappingOpening, roomForPoint, setLeftDistance, sideLabel, viewpointFor, wallSide } from './wallMath'
import { tvPlanFor, useElecUi } from './uiStore'

const ACCENT = '#e0a64a'

const S = {
  panel: {
    position: 'fixed',
    left: 12,
    top: 64,
    width: 'min(300px, calc(100vw - 24px))',
    maxHeight: 'calc(100vh - 64px - 150px)',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(20,22,26,0.82)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: 10,
    color: '#fff',
    font: '13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    zIndex: 30,
    boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  } as CSSProperties,
  header: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', userSelect: 'none' } as CSSProperties,
  body: { overflowY: 'auto', padding: '0 12px 12px', WebkitOverflowScrolling: 'touch' } as CSSProperties,
  h: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.6, margin: '12px 0 6px' } as CSSProperties,
  btn: {
    background: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#fff',
    borderRadius: 7,
    padding: '6px 9px',
    font: 'inherit',
    cursor: 'pointer',
    minHeight: 32,
  } as CSSProperties,
  input: {
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#fff',
    borderRadius: 6,
    padding: '5px 7px',
    font: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,
  row: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } as CSSProperties,
}

const active = (on: boolean): CSSProperties =>
  on ? { ...S.btn, background: 'rgba(224,166,74,0.25)', borderColor: ACCENT } : S.btn

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Thumb({ type, size = 30 }: { type: PointType; size?: number }) {
  const pre = PRESETS[type]
  const ar = pre.plate.w / pre.plate.h
  const w = ar >= 1 ? size : size * ar
  const h = ar >= 1 ? size / ar : size
  return (
    <span style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <img
        src={plateDataUrl(type)}
        width={w}
        height={h}
        alt=""
        style={{ borderRadius: pre.plate.shape === 'round' ? '50%' : 3, boxShadow: `0 0 0 2px ${pre.color}` }}
      />
    </span>
  )
}

function NumField({ value, onChange, min, max, step = 1, suffix = 'cm' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const v = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(v)) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v)))
    setDraft(null)
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number"
        inputMode="decimal"
        style={{ ...S.input, width: 76 }}
        value={draft ?? String(Math.round(value * 10) / 10)}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          e.stopPropagation()
        }}
      />
      <span style={{ opacity: 0.6 }}>{suffix}</span>
    </span>
  )
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div>
      <div style={{ ...S.h, display: 'flex', justifyContent: 'space-between' }}>
        <span>{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}

function Inspector({ p }: { p: ElectricalPoint }) {
  const updatePoint = useStore((s) => s.updatePoint)
  const removePoint = useStore((s) => s.removePoint)
  const set = useStore((s) => s.set)
  const pre = PRESETS[p.type]
  const ceiling = isCeilingPoint(p)
  const info = alongInfo(planC, p)
  const cinfo = ceiling ? ceilingInfo(planC, p) : null
  const room = roomForPoint(planC, p)
  const clash = overlappingOpening(planC, p)
  const tvAll = useElecUi((s) => s.tv)
  const setTv = useElecUi((s) => s.setTv)
  const tv = tvPlanFor(tvAll, p.id)
  const compatible = POINT_TYPES.filter((t) => (ceiling ? PRESETS[t].mount !== 'wall' : PRESETS[t].mount !== 'ceiling'))

  return (
    <Section
      title="Selected point"
      right={
        <span style={{ cursor: 'pointer', textTransform: 'none' }} onClick={() => set({ selectedId: null })}>
          close
        </span>
      }
    >
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 8, display: 'grid', gap: 7 }}>
        <div style={S.row}>
          <Thumb type={p.type} />
          <select style={{ ...S.input, flex: 1, width: 'auto' }} value={p.type} onChange={(e) => updatePoint(p.id, { type: e.target.value as PointType })}>
            {compatible.map((t) => (
              <option key={t} value={t} style={{ color: '#000' }}>
                {PRESETS[t].label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ opacity: 0.75 }}>
          {room?.name ?? 'Outside rooms'} · {sideLabel(wallSide(p.nx, p.nz))}
          {p.wallId ? ` (${p.wallId})` : ''}
        </div>
        {!ceiling && (
          <>
            <div style={S.row}>
              <span style={{ width: 92 }}>Height</span>
              <NumField value={p.y} min={5} max={planC.ceilingHeight - 5} onChange={(y) => updatePoint(p.id, { y })} />
            </div>
            <div style={{ ...S.row, gap: 4 }}>
              {pre.quickHeights.map((q) => (
                <button key={q.label} style={{ ...active(Math.round(p.y) === q.h), padding: '3px 7px', minHeight: 26 }} onClick={() => updatePoint(p.id, { y: q.h })}>
                  {q.label}
                </button>
              ))}
            </div>
            {info && (
              <div style={S.row}>
                <span style={{ width: 92 }}>From left corner</span>
                <NumField
                  value={info.left}
                  min={0}
                  max={info.left + info.right}
                  onChange={(d) => {
                    const np = setLeftDistance(planC, p, d)
                    if (np) updatePoint(p.id, np)
                  }}
                />
                <span style={{ opacity: 0.6, fontSize: 12 }}>right corner {Math.round(info.right)} cm</span>
              </div>
            )}
          </>
        )}
        {cinfo && (
          <div style={{ opacity: 0.8 }}>
            {Math.round(cinfo.west)} cm from W wall · {Math.round(cinfo.north)} cm from N wall
            <br />
            <button
              style={{ ...S.btn, marginTop: 4, minHeight: 26, padding: '3px 8px' }}
              onClick={() => {
                const r = cinfo.room.rect
                updatePoint(p.id, { x: Math.round((r.x1 + r.x2) / 2), z: Math.round((r.z1 + r.z2) / 2) })
              }}
            >
              Centre in room
            </button>
          </div>
        )}
        {clash && (
          <div style={{ color: '#ff8a65' }}>
            Overlaps the {clash.kind === 'mainDoor' ? 'main door' : clash.kind} opening ({clash.id}) — move it.
          </div>
        )}
        <input
          style={S.input}
          placeholder="Note (e.g. 'fridge', 'two-way with bedside')"
          value={p.note ?? ''}
          onChange={(e) => updatePoint(p.id, { note: e.target.value || undefined })}
          onKeyDown={(e) => e.stopPropagation()}
        />
        {p.type === 'tvPoint' && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 7, display: 'grid', gap: 6 }}>
            <label style={S.row}>
              <input type="checkbox" checked={tv.show} onChange={(e) => setTv(p.id, { show: e.target.checked })} />
              Preview TV size on the wall
            </label>
            <div style={{ ...S.row, gap: 4 }}>
              {TV_SIZES.map((s) => (
                <button key={s} style={{ ...active(tv.inches === s), padding: '3px 8px', minHeight: 28 }} onClick={() => setTv(p.id, { inches: s, show: true })}>
                  {s}"
                </button>
              ))}
            </div>
            <div style={S.row}>
              <span style={{ width: 92 }}>TV centre</span>
              <NumField value={tv.centre} min={40} max={220} onChange={(centre) => setTv(p.id, { centre })} />
            </div>
            <TvAdvice inches={tv.inches} centre={tv.centre} p={p} />
          </div>
        )}
        <div style={{ ...S.row, justifyContent: 'space-between' }}>
          <button style={S.btn} onClick={() => goTo(p)}>
            Go there
          </button>
          <button style={{ ...S.btn, borderColor: '#e57373', color: '#ffb4a8' }} onClick={() => removePoint(p.id)}>
            Delete
          </button>
        </div>
      </div>
    </Section>
  )
}

function TvAdvice({ inches, centre, p }: { inches: number; centre: number; p: ElectricalPoint }) {
  const { w, h } = tvSizeCm(inches)
  const r = tvViewingRange(inches)
  const room = roomForPoint(planC, p)
  let depth: number | null = null
  if (room) {
    const rc = room.rect
    depth = p.nx > 0 ? rc.x2 - p.x : p.nx < 0 ? p.x - rc.x1 : p.nz > 0 ? rc.z2 - p.z : p.z - rc.z1
  }
  // eyes of someone on a sofa against the opposite wall sit ~65 cm from that wall
  const seat = depth !== null ? Math.round(depth - 65) : null
  const fits = seat !== null ? (seat < r.min ? 'too close — pick a smaller TV' : seat > r.max ? 'a bigger TV would suit' : 'good fit') : null
  return (
    <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.9 }}>
      {inches}" ≈ {Math.round(w)} × {Math.round(h)} cm, bottom edge at {Math.round(centre - h / 2)} cm.
      <br />
      Recommended viewing distance (4K): <b>{(r.min / 100).toFixed(1)}–{(r.max / 100).toFixed(1)} m</b>.
      {seat !== null && (
        <>
          <br />
          Sofa against the opposite wall → eyes ≈ {(seat / 100).toFixed(1)} m: <b style={{ color: fits === 'good fit' ? '#81c784' : ACCENT }}>{fits}</b>.
        </>
      )}
      <br />
      <span style={{ opacity: 0.7 }}>Seated eye level ≈ 100–110 cm; keep the screen centre near it. The green floor band shows the ideal seating zone.</span>
    </div>
  )
}

function goTo(p: ElectricalPoint) {
  const s = useStore.getState()
  const v = viewpointFor(planC, p, isCeilingPoint(p) ? 0 : 170, s.player?.yawDeg ?? 0)
  s.set({ selectedId: p.id })
  s.requestTeleport(v.x, v.z, v.yawDeg)
}

export default function ElectricalPanel() {
  const tool = useStore((s) => s.tool)
  const points = useStore((s) => s.points)
  const selectedId = useStore((s) => s.selectedId)
  const pending = useStore((s) => s.pendingPointType)
  const set = useStore((s) => s.set)
  const replaceAll = useStore((s) => s.replaceAll)
  const open = useElecUi((s) => s.panelOpen)
  const setOpen = useElecUi((s) => s.setPanelOpen)
  const heightOverride = useElecUi((s) => s.heightOverride)
  const setHeightOverride = useElecUi((s) => s.setHeightOverride)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [collapsedRooms, setCollapsedRooms] = useState<Record<string, boolean>>({})

  const selected = points.find((p) => p.id === selectedId) ?? null

  const groups = useMemo(() => {
    const m = new Map<string, { name: string; pts: ElectricalPoint[] }>()
    for (const r of planC.rooms) m.set(r.id, { name: r.name, pts: [] })
    m.set('_', { name: 'Unassigned', pts: [] })
    for (const p of points) {
      const r = roomForPoint(planC, p)
      m.get(r?.id ?? '_')!.pts.push(p)
    }
    return [...m.entries()].filter(([, g]) => g.pts.length)
  }, [points])

  if (tool !== 'electrical') return null

  const flash = (t: string) => {
    setMsg(t)
    setTimeout(() => setMsg(null), 2500)
  }

  const arm = (t: PointType) => {
    setHeightOverride(null)
    set({ pendingPointType: pending === t ? null : t })
  }

  const loadSuggested = () => {
    if (points.length && !window.confirm(`Replace your ${points.length} points with the suggested starter set?`)) return
    const pts = suggestedPoints(planC).map((p) => ({ ...p, id: newId('pt') }))
    replaceAll({ points: pts })
    flash(`Loaded ${pts.length} suggested points`)
  }

  const pre = pending ? PRESETS[pending] : null
  const counts = countByType(points)

  return (
    <div style={S.panel} data-panel="electrical">
      <div style={S.header} onClick={() => setOpen(!open)}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: ACCENT }} />
        <b style={{ flex: 1 }}>Electrical points</b>
        <span style={{ opacity: 0.6 }}>{points.length}</span>
        <span style={{ opacity: 0.8 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={S.body}>
          <Section title="Place a point">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {POINT_TYPES.map((t) => (
                <button
                  key={t}
                  title={PRESETS[t].hint}
                  style={{ ...active(pending === t), display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', padding: '4px 6px' }}
                  onClick={() => arm(t)}
                >
                  <Thumb type={t} size={26} />
                  <span style={{ lineHeight: 1.15 }}>
                    {PRESETS[t].label}
                    <br />
                    <span style={{ opacity: 0.55, fontSize: 11 }}>
                      {PRESETS[t].mount === 'ceiling' ? 'ceiling' : `${PRESETS[t].defaultHeight} cm`}
                      {counts[t] ? ` · ${counts[t]}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {pre && (
              <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(224,166,74,0.12)', display: 'grid', gap: 6 }}>
                <div>
                  <b>{pre.label}</b>: {pre.hint}
                </div>
                {pre.mount !== 'ceiling' && (
                  <>
                    <div style={S.row}>
                      <span>Height</span>
                      <NumField value={heightOverride ?? pre.defaultHeight} min={5} max={planC.ceilingHeight - 5} onChange={setHeightOverride} />
                      {heightOverride !== null && (
                        <button style={{ ...S.btn, minHeight: 26, padding: '2px 7px' }} onClick={() => setHeightOverride(null)}>
                          default
                        </button>
                      )}
                    </div>
                    <div style={{ ...S.row, gap: 4 }}>
                      {pre.quickHeights.map((q) => (
                        <button
                          key={q.label}
                          style={{ ...active((heightOverride ?? pre.defaultHeight) === q.h), padding: '3px 7px', minHeight: 26 }}
                          onClick={() => setHeightOverride(q.h)}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {pre.mount === 'ceiling'
                    ? 'Tap the ceiling (or floor when ceilings are hidden). Snaps to the room centre.'
                    : pre.mount === 'either'
                      ? 'Tap a wall for a wall light, or the ceiling/floor for a ceiling light.'
                      : 'Tap a wall to place. Hold Shift to use the cursor height.'}{' '}
                  Esc / tap the button again to stop.
                </div>
              </div>
            )}
          </Section>

          {selected && <Inspector key={selected.id} p={selected} />}

          <Section title="Plan">
            <div style={{ ...S.row }}>
              <button style={{ ...S.btn, borderColor: ACCENT }} onClick={loadSuggested}>
                Load suggested points
              </button>
              <button
                style={S.btn}
                disabled={!points.length}
                onClick={() => {
                  if (window.confirm(`Delete all ${points.length} points?`)) replaceAll({ points: [] })
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ ...S.row, marginTop: 6 }}>
              <button style={S.btn} disabled={!points.length} onClick={() => download('electrical-points-flat-C.csv', pointsToCsv(points, planC), 'text/csv')}>
                Export CSV
              </button>
              <button style={S.btn} disabled={!points.length} onClick={() => download('electrical-points-flat-C.json', pointsToJson(points), 'application/json')}>
                Export JSON
              </button>
              <button style={S.btn} onClick={() => fileRef.current?.click()}>
                Import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    const pts = parsePointsJson(await f.text())
                    if (points.length && !window.confirm(`Replace your ${points.length} points with ${pts.length} from the file?`)) return
                    replaceAll({ points: pts })
                    flash(`Imported ${pts.length} points`)
                  } catch (err) {
                    flash(`Import failed: ${(err as Error).message}`)
                  }
                }}
              />
            </div>
            {msg && <div style={{ marginTop: 6, color: ACCENT }}>{msg}</div>}
          </Section>

          <Section title={`Points by room (${points.length})`}>
            {!points.length && <div style={{ opacity: 0.6 }}>No points yet. Pick a type above and tap a wall, or load the suggested set.</div>}
            {groups.map(([rid, g]) => (
              <div key={rid} style={{ marginBottom: 4 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '4px 0', fontWeight: 600 }}
                  onClick={() => setCollapsedRooms((c) => ({ ...c, [rid]: !c[rid] }))}
                >
                  <span>
                    {collapsedRooms[rid] ? '▸' : '▾'} {g.name}
                  </span>
                  <span style={{ opacity: 0.55 }}>{g.pts.length}</span>
                </div>
                {!collapsedRooms[rid] &&
                  g.pts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => goTo(p)}
                      title={p.note}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '3px 6px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: p.id === selectedId ? 'rgba(224,166,74,0.22)' : 'transparent',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: PRESETS[p.type].color, flex: 'none' }} />
                      <span style={{ flex: 'none' }}>{PRESETS[p.type].short}</span>
                      <span style={{ flex: 1, opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {p.note || sideLabel(wallSide(p.nx, p.nz))}
                      </span>
                      <span style={{ opacity: 0.8, fontSize: 12, flex: 'none' }}>{isCeilingPoint(p) ? 'ceil' : `${Math.round(p.y)}`}</span>
                    </div>
                  ))}
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
  )
}
