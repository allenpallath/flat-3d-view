// OWNER: Electrical Planner agent (A5).
// Per point-type presets: labels, colours, default mounting heights (cm) following
// common Indian residential practice, and the visual plate size of each modular plate.
import type { PointType } from '../data/schema'

/** One module of a modular plate (Indian 1M ≈ 22.5 mm aperture). */
export type ModuleKind = 'rocker' | 'sock6' | 'sock16' | 'reg' | 'hdmi' | 'coax' | 'rj45' | 'usb'

/** Width in modules of each module kind. */
export const MODULE_WIDTH: Record<ModuleKind, number> = {
  rocker: 1,
  sock6: 2,
  sock16: 3,
  reg: 2,
  hdmi: 1,
  coax: 1,
  rj45: 1,
  usb: 2,
}

export type Mount = 'wall' | 'ceiling' | 'either'

export interface QuickHeight {
  label: string
  h: number
}

export interface PointPreset {
  type: PointType
  label: string
  /** short label for lists / CSV */
  short: string
  /** accent colour (lists, outline ring in edit mode) */
  color: string
  mount: Mount
  /** default height above finished floor (cm); for ceiling-only types this is ignored (ceiling height is used) */
  defaultHeight: number
  quickHeights: QuickHeight[]
  /** plate size (cm). shape 'round' uses w as diameter */
  plate: { w: number; h: number; shape: 'rect' | 'round' }
  /** module layout left→right (rect plates only) */
  modules: ModuleKind[]
  /** short practice note shown in the palette */
  hint: string
}

export const PRESETS: Record<PointType, PointPreset> = {
  socket6A: {
    type: 'socket6A',
    label: '6A socket',
    short: '6A',
    color: '#4caf50',
    mount: 'wall',
    defaultHeight: 30,
    quickHeights: [
      { label: 'Floor 30', h: 30 },
      { label: 'Bedside 60', h: 60 },
      { label: 'Desk 90', h: 90 },
      { label: 'Counter 110', h: 110 },
    ],
    plate: { w: 11.5, h: 8.6, shape: 'rect' },
    modules: ['rocker', 'sock6'],
    hint: '30 cm general · 60 beside beds · 110 above counters',
  },
  socket16A: {
    type: 'socket16A',
    label: '16A power socket',
    short: '16A',
    color: '#e53935',
    mount: 'wall',
    defaultHeight: 30,
    quickHeights: [
      { label: 'Fridge 30', h: 30 },
      { label: 'Washer 110', h: 110 },
      { label: 'Microwave 110', h: 110 },
      { label: 'Geyser 200', h: 200 },
    ],
    plate: { w: 14.6, h: 8.6, shape: 'rect' },
    modules: ['rocker', 'sock16'],
    hint: 'Fridge 30 · washer/microwave 110 · geyser 200',
  },
  switchboard: {
    type: 'switchboard',
    label: 'Switchboard',
    short: 'SB',
    color: '#e0a64a',
    mount: 'wall',
    defaultHeight: 120,
    quickHeights: [
      { label: '120', h: 120 },
      { label: '135', h: 135 },
      { label: 'Bedside 75', h: 75 },
    ],
    plate: { w: 20, h: 12, shape: 'rect' },
    modules: ['rocker', 'rocker', 'rocker', 'rocker', 'rocker', 'rocker', 'reg'],
    hint: '8-module, 120–135 cm, latch side of the door',
  },
  tvPoint: {
    type: 'tvPoint',
    label: 'TV point',
    short: 'TV',
    color: '#7e57c2',
    mount: 'wall',
    defaultHeight: 120,
    quickHeights: [
      { label: 'Wall TV 120', h: 120 },
      { label: 'TV unit 60', h: 60 },
    ],
    plate: { w: 20, h: 12, shape: 'rect' },
    modules: ['rocker', 'sock6', 'rocker', 'sock6', 'hdmi', 'coax'],
    hint: 'Power + HDMI + coax · 120 behind wall TV · 60 over a TV unit',
  },
  dataPoint: {
    type: 'dataPoint',
    label: 'Data / LAN',
    short: 'LAN',
    color: '#29b6f6',
    mount: 'wall',
    defaultHeight: 30,
    quickHeights: [
      { label: '30', h: 30 },
      { label: 'Desk 90', h: 90 },
      { label: 'Router 200', h: 200 },
    ],
    plate: { w: 8.6, h: 8.6, shape: 'rect' },
    modules: ['rj45', 'rj45'],
    hint: 'RJ45, 30 cm (90 above a desk)',
  },
  acPoint: {
    type: 'acPoint',
    label: 'AC point',
    short: 'AC',
    color: '#00acc1',
    mount: 'wall',
    defaultHeight: 220,
    quickHeights: [
      { label: '210', h: 210 },
      { label: '220', h: 220 },
      { label: '230', h: 230 },
    ],
    plate: { w: 14.6, h: 8.6, shape: 'rect' },
    modules: ['rocker', 'sock16'],
    hint: '16/20A, 210–230 cm beside the split AC indoor unit',
  },
  lightPoint: {
    type: 'lightPoint',
    label: 'Light point',
    short: 'Light',
    color: '#ffd54f',
    mount: 'either',
    defaultHeight: 200,
    quickHeights: [
      { label: 'Wall 200', h: 200 },
      { label: 'Mirror 190', h: 190 },
      { label: 'Wall 220', h: 220 },
    ],
    plate: { w: 10, h: 10, shape: 'round' },
    modules: [],
    hint: 'Wall light 200 cm, or click the ceiling for a ceiling light',
  },
  fanPoint: {
    type: 'fanPoint',
    label: 'Fan point',
    short: 'Fan',
    color: '#90a4ae',
    mount: 'ceiling',
    defaultHeight: 285,
    quickHeights: [],
    plate: { w: 13, h: 13, shape: 'round' },
    modules: [],
    hint: 'Ceiling hook box, snaps to the room centre',
  },
  usbSocket: {
    type: 'usbSocket',
    label: 'USB socket',
    short: 'USB',
    color: '#8bc34a',
    mount: 'wall',
    defaultHeight: 60,
    quickHeights: [
      { label: 'Bedside 60', h: 60 },
      { label: 'Desk 90', h: 90 },
      { label: 'Counter 110', h: 110 },
    ],
    plate: { w: 8.6, h: 8.6, shape: 'rect' },
    modules: ['usb'],
    hint: 'USB A+C charger, 60 bedside / 90 desk',
  },
}

export const POINT_TYPES = Object.keys(PRESETS) as PointType[]

/** Standard 16:9 TV sizes offered in the TV planner (inches). */
export const TV_SIZES = [43, 50, 55, 65, 75] as const

/** 16:9 panel size (cm) for a diagonal in inches (screen only + ~1 cm bezel). */
export function tvSizeCm(inches: number) {
  const d = inches * 2.54
  return { w: d * 0.8716 + 2, h: d * 0.4903 + 2, diag: d }
}

/**
 * Recommended viewing distance range (cm) for a 4K 16:9 TV:
 * THX ~40° field of view (≈1.2× diagonal) to SMPTE 30° (≈1.6× diagonal).
 */
export function tvViewingRange(inches: number) {
  const d = inches * 2.54
  return { min: Math.round(d * 1.2), max: Math.round(d * 1.6) }
}
