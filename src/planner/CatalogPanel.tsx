// OWNER: Furniture Planner agent (A4). DOM side panel: catalog, inspector, layout actions.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { CatalogItem, PlacedItem } from '../data/schema'
import { useStore } from '../store'
import { CATALOG, CATEGORY_LABELS, TV_SIZES, getEntry, itemDims } from './catalog'
import { loadDefaultLayout } from './defaultLayout'
import { usePlanner } from './plannerStore'

const ACCENT = '#e0a64a'
const SWATCHES = ['#2f5370', '#3d5a40', '#7b2f2f', '#c96a4a', '#d9d4cc', '#efe9df', '#8a8f96', '#2b2d31', '#c8a273', '#6b4a32', '#2f6f6a', '#b98ab0']
const CATS = Object.keys(CATEGORY_LABELS) as CatalogItem['category'][]

const S = {
  panel: {
    position: 'fixed',
    left: 12,
    top: 64,
    width: 300,
    maxWidth: 'calc(100vw - 24px)',
    background: 'rgba(20,22,26,0.82)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: 10,
    color: '#fff',
    font: '13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  } as CSSProperties,
  head: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', userSelect: 'none' } as CSSProperties,
  body: { overflowY: 'auto', padding: '0 12px 12px', WebkitOverflowScrolling: 'touch' } as CSSProperties,
  btn: {
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 7,
    padding: '6px 9px',
    font: 'inherit',
    cursor: 'pointer',
  } as CSSProperties,
  input: {
    background: 'rgba(0,0,0,0.35)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 6,
    padding: '5px 7px',
    font: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,
  section: { marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)' } as CSSProperties,
  label: { fontSize: 11, opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 } as CSSProperties,
  dim: { opacity: 0.6, fontSize: 12, whiteSpace: 'nowrap' } as CSSProperties,
}

const accentBtn: CSSProperties = { ...S.btn, background: ACCENT, color: '#1a1a1a', border: 'none', fontWeight: 600 }
const fmt = (n: number) => String(Math.round(n * 10) / 10)

function NumField({ label, value, onCommit, min = 0, step = 1, disabled }: { label: string; value: number; onCommit: (v: number) => void; min?: number; step?: number; disabled?: boolean }) {
  const [txt, setTxt] = useState(fmt(value))
  useEffect(() => setTxt(fmt(value)), [value])
  const commit = () => {
    const v = Number(txt)
    if (Number.isFinite(v) && v >= min) onCommit(v)
    else setTxt(fmt(value))
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 11, opacity: 0.65 }}>{label}</span>
      <input
        style={{ ...S.input, opacity: disabled ? 0.5 : 1 }}
        type="number"
        inputMode="decimal"
        step={step}
        value={txt}
        disabled={disabled}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setTxt(fmt(value))
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
    </label>
  )
}

function Inspector({ item }: { item: PlacedItem }) {
  const updateItem = useStore((s) => s.updateItem)
  const removeItem = useStore((s) => s.removeItem)
  const addItem = useStore((s) => s.addItem)
  const gizmoMode = usePlanner((s) => s.gizmoMode)
  const setP = usePlanner((s) => s.set)
  const e = getEntry(item.catalogId)
  const dims = itemDims(item)
  const isTv = e?.model === 'tv'
  const up = (p: Partial<PlacedItem>) => updateItem(item.id, p)

  const setTv = (inches: number) => {
    const ne = getEntry(`tv${inches}`)
    if (!ne) return
    const centre = item.y + dims.h / 2
    up({ catalogId: ne.id, w: undefined, d: undefined, h: undefined, y: Math.max(0, Math.round(centre - ne.h / 2)) })
  }

  return (
    <div style={S.section}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{e?.name ?? item.catalogId}</div>
        <button style={{ ...S.btn, padding: '2px 8px' }} title="Deselect (Esc)" onClick={() => useStore.getState().set({ selectedId: null })}>
          ✕
        </button>
      </div>
      {isTv && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ opacity: 0.75 }}>TV size</span>
          <select style={{ ...S.input, width: 'auto', flex: 1 }} value={e?.inches ?? 55} onChange={(ev) => setTv(Number(ev.target.value))}>
            {TV_SIZES.map((s) => {
              const t = getEntry(`tv${s}`)!
              return (
                <option key={s} value={s}>
                  {s}" — {t.w}×{t.h} cm
                </option>
              )
            })}
          </select>
        </label>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
        <NumField label="W cm" value={dims.w} min={1} disabled={isTv} onCommit={(v) => up({ w: v })} />
        <NumField label="D cm" value={dims.d} min={0.5} onCommit={(v) => up({ d: v })} />
        <NumField label="H cm" value={dims.h} min={0.5} disabled={isTv} onCommit={(v) => up({ h: v })} />
        <NumField label="Elev cm" value={item.y} onCommit={(v) => up({ y: v })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6, alignItems: 'end' }}>
        <NumField label="X cm" value={item.x} min={-1000} onCommit={(v) => up({ x: v })} />
        <NumField label="Z cm" value={item.z} min={-1000} onCommit={(v) => up({ z: v })} />
        <NumField label="Rot °" value={item.rot} min={-720} step={15} onCommit={(v) => up({ rot: ((((v + 180) % 360) + 360) % 360) - 180 })} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button style={S.btn} title="Rotate −90° (Shift+R)" onClick={() => up({ rot: norm(item.rot - 90) })}>
          ⟳ −90°
        </button>
        <button style={S.btn} title="Rotate +90° (R)" onClick={() => up({ rot: norm(item.rot + 90) })}>
          ⟲ +90°
        </button>
        <div style={{ display: 'flex', marginLeft: 'auto', borderRadius: 7, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)' }} title="Gizmo mode (G)">
          {(['translate', 'rotate'] as const).map((m) => (
            <button
              key={m}
              style={{ ...S.btn, border: 'none', borderRadius: 0, background: gizmoMode === m ? ACCENT : 'transparent', color: gizmoMode === m ? '#1a1a1a' : '#fff' }}
              onClick={() => setP({ gizmoMode: m })}
            >
              {m === 'translate' ? 'Move' : 'Rotate'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ ...S.label, marginTop: 10 }}>Colour</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        <button style={{ ...S.btn, padding: '3px 7px', borderColor: !item.color ? ACCENT : 'rgba(255,255,255,0.14)' }} onClick={() => up({ color: undefined })}>
          Default
        </button>
        {SWATCHES.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => up({ color: c })}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              background: c,
              cursor: 'pointer',
              border: item.color === c ? `2px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.3)',
              padding: 0,
            }}
          />
        ))}
        <input type="color" value={item.color ?? e?.color ?? '#888888'} onChange={(ev) => up({ color: ev.target.value })} style={{ width: 28, height: 24, border: 'none', background: 'none', padding: 0 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button
          style={{ ...S.btn, flex: 1 }}
          onClick={() => {
            const { id: _id, ...rest } = item
            void _id
            addItem({ ...rest, x: item.x + 30, z: item.z + 30 })
          }}
        >
          Duplicate
        </button>
        <button style={{ ...S.btn, flex: 1, background: 'rgba(220,70,70,0.25)', borderColor: 'rgba(220,70,70,0.5)' }} onClick={() => removeItem(item.id)}>
          Delete
        </button>
      </div>
    </div>
  )
}

const norm = (d: number) => {
  let r = ((d % 360) + 360) % 360
  if (r > 180) r -= 360
  return r
}

function Group({ title, children, open, onToggle }: { title: string; children: ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 0', userSelect: 'none', fontWeight: 600 }}>
        <span style={{ display: 'inline-block', width: 10, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▸</span>
        {title}
      </div>
      {open && <div>{children}</div>}
    </div>
  )
}

export default function CatalogPanel() {
  const tool = useStore((s) => s.tool)
  const items = useStore((s) => s.items)
  const selectedId = useStore((s) => s.selectedId)
  const pending = useStore((s) => s.pendingCatalogId)
  const set = useStore((s) => s.set)
  const ghostBlocked = usePlanner((s) => s.ghostBlocked)
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 600)
  const [q, setQ] = useState('')
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ living: true })
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: coarse)')
    if (!mq) return
    setCoarse(mq.matches)
    const f = () => setCoarse(mq.matches)
    mq.addEventListener?.('change', f)
    return () => mq.removeEventListener?.('change', f)
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? CATALOG.filter((c) => c.name.toLowerCase().includes(s) || c.category.includes(s)) : CATALOG
  }, [q])

  if (tool !== 'furniture') return null
  const selected = items.find((i) => i.id === selectedId)
  const pendingEntry = pending ? getEntry(pending) : undefined

  const pick = (id: string) => set({ pendingCatalogId: pending === id ? null : id, selectedId: null })

  return (
    <div style={{ ...S.panel, maxHeight: coarse ? 'calc(100% - 64px - 190px)' : 'calc(100% - 64px - 16px)' }} data-panel="furniture">
      <div style={S.head} onClick={() => setCollapsed((c) => !c)}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Furniture</span>
        <span style={S.dim}>{items.length} placed</span>
        <span style={{ marginLeft: 'auto', opacity: 0.8 }}>{collapsed ? '▾' : '▴'}</span>
      </div>
      {pendingEntry && (
        <div style={{ margin: '0 12px 8px', padding: '7px 9px', borderRadius: 7, background: ghostBlocked ? 'rgba(255,77,77,0.2)' : 'rgba(224,166,74,0.18)', border: `1px solid ${ghostBlocked ? '#ff4d4d' : ACCENT}` }}>
          <div>
            Placing <b>{pendingEntry.name}</b>
            {ghostBlocked && <span style={{ color: '#ff8a8a' }}> — overlaps</span>}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
            {pendingEntry.wallMounted ? 'Point at a wall' : 'Click on the floor'} to place · R rotate · Esc cancel
          </div>
          <button style={{ ...S.btn, marginTop: 6, padding: '3px 8px' }} onClick={() => set({ pendingCatalogId: null })}>
            Cancel
          </button>
        </div>
      )}
      {!collapsed && (
        <div style={S.body}>
          {selected && <Inspector key={selected.id} item={selected} />}
          <div style={selected ? S.section : undefined}>
            <input style={S.input} placeholder="Search furniture…" value={q} onChange={(e) => setQ(e.target.value)} />
            {CATS.map((cat) => {
              const list = filtered.filter((c) => c.category === cat)
              if (!list.length) return null
              const open = q.trim() ? true : !!openCats[cat]
              return (
                <Group key={cat} title={`${CATEGORY_LABELS[cat]} (${list.length})`} open={open} onToggle={() => setOpenCats((o) => ({ ...o, [cat]: !o[cat] }))}>
                  {list.map((c) => {
                    const active = pending === c.id
                    return (
                      <div
                        key={c.id}
                        onClick={() => pick(c.id)}
                        title={active ? 'Click again to cancel' : 'Click, then click in the scene to place'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          margin: '2px 0',
                          borderRadius: 7,
                          cursor: 'pointer',
                          background: active ? 'rgba(224,166,74,0.25)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? ACCENT : 'transparent'}`,
                        }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flex: 'none', border: '1px solid rgba(255,255,255,0.25)' }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={S.dim}>
                          {c.w}×{c.d}×{c.h}
                        </span>
                      </div>
                    )
                  })}
                </Group>
              )
            })}
          </div>
          <div style={{ ...S.section, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              style={{ ...accentBtn, flex: 1 }}
              onClick={() => {
                if (items.length === 0 || window.confirm('Replace all furniture with the suggested layout from the drawing?')) loadDefaultLayout()
              }}
            >
              Load suggested layout
            </button>
            <button
              style={{ ...S.btn, flex: 1 }}
              onClick={() => {
                if (items.length && window.confirm(`Remove all ${items.length} furniture items?`)) useStore.getState().replaceAll({ items: [] })
              }}
            >
              Clear all furniture
            </button>
          </div>
          <div style={{ ...S.section, fontSize: 11.5, opacity: 0.7, lineHeight: 1.55 }}>
            Click an item to select · drag gizmo to move (5 cm snap) · <b>G</b> move/rotate gizmo (15°, Shift = 90°) · <b>R</b> rotate 90° · <b>Alt+arrows</b> nudge 5 cm (Shift = 1 cm) · <b>Del</b> remove ·{' '}
            <b>Esc</b> deselect. Labels show clear distance to the nearest walls.
          </div>
        </div>
      )}
    </div>
  )
}
