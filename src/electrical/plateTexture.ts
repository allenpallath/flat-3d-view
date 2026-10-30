// Procedural canvas drawings of Indian modular switch/socket plates (front face).
import * as THREE from 'three'
import type { PointType } from '../data/schema'
import { MODULE_WIDTH, PRESETS, type ModuleKind } from './presets'

const PX = 28 // canvas pixels per cm

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function hole(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
  g.addColorStop(0, '#1a1a1a')
  g.addColorStop(1, '#4a4a4a')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** Draws one module into the box (x,y,w,h) in cm units. */
function drawModule(ctx: CanvasRenderingContext2D, kind: ModuleKind, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2
  const cy = y + h / 2
  // module bezel
  ctx.fillStyle = '#ecebe7'
  rr(ctx, x + 0.08, y + 0.08, w - 0.16, h - 0.16, 0.25)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 0.04
  ctx.stroke()
  switch (kind) {
    case 'rocker': {
      const rw = w - 0.55
      const rh = Math.min(h - 0.6, 4.4)
      const ry = cy - rh / 2
      const g = ctx.createLinearGradient(0, ry, 0, ry + rh)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.48, '#f2f1ed')
      g.addColorStop(0.52, '#dddcd6')
      g.addColorStop(1, '#f6f5f1')
      ctx.fillStyle = g
      rr(ctx, cx - rw / 2, ry, rw, rh, 0.3)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'
      ctx.stroke()
      // indicator
      ctx.fillStyle = '#e8743b'
      rr(ctx, cx - 0.35, ry + 0.35, 0.7, 0.18, 0.08)
      ctx.fill()
      break
    }
    case 'sock6':
    case 'sock16': {
      const big = kind === 'sock16'
      const r = Math.min(w, h) / 2 - 0.35
      const g = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.2, cx, cy, r)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(1, '#e2e1dc')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.stroke()
      const s = r / 1.9
      hole(ctx, cx, cy - s * 0.85, big ? 0.38 : 0.28) // earth (top, larger)
      hole(ctx, cx - s * 0.75, cy + s * 0.55, big ? 0.3 : 0.2)
      hole(ctx, cx + s * 0.75, cy + s * 0.55, big ? 0.3 : 0.2)
      if (!big) {
        // universal 2-pin holes
        hole(ctx, cx - s * 0.45, cy + s * 0.05, 0.12)
        hole(ctx, cx + s * 0.45, cy + s * 0.05, 0.12)
      }
      break
    }
    case 'reg': {
      const r = Math.min(w, h) / 2 - 0.5
      ctx.fillStyle = '#d9d8d2'
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (0.8 + i * 0.35)
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * (r + 0.2), cy + Math.sin(a) * (r + 0.2), 0.08 + i * 0.02, 0, Math.PI * 2)
        ctx.fillStyle = '#888'
        ctx.fill()
      }
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(1, '#cfcec8')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.stroke()
      ctx.strokeStyle = '#777'
      ctx.lineWidth = 0.15
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx - r * 0.5, cy - r * 0.45)
      ctx.stroke()
      break
    }
    case 'hdmi': {
      ctx.fillStyle = '#222'
      ctx.beginPath()
      ctx.moveTo(cx - 0.75, cy - 0.3)
      ctx.lineTo(cx + 0.75, cy - 0.3)
      ctx.lineTo(cx + 0.75, cy + 0.05)
      ctx.lineTo(cx + 0.5, cy + 0.3)
      ctx.lineTo(cx - 0.5, cy + 0.3)
      ctx.lineTo(cx - 0.75, cy + 0.05)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#c8a94a'
      ctx.fillRect(cx - 0.55, cy - 0.12, 1.1, 0.1)
      label(ctx, 'HDMI', cx, cy + 1.1)
      break
    }
    case 'coax': {
      ctx.fillStyle = '#bfc2c6'
      ctx.beginPath()
      ctx.arc(cx, cy, 0.55, 0, Math.PI * 2)
      ctx.fill()
      hole(ctx, cx, cy, 0.38)
      ctx.fillStyle = '#d4b04c'
      ctx.beginPath()
      ctx.arc(cx, cy, 0.09, 0, Math.PI * 2)
      ctx.fill()
      label(ctx, 'TV', cx, cy + 1.1)
      break
    }
    case 'rj45': {
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(cx - 0.65, cy - 0.55, 1.3, 1.0)
      ctx.fillRect(cx - 0.25, cy + 0.45, 0.5, 0.2)
      ctx.fillStyle = '#c8a94a'
      for (let i = 0; i < 8; i++) ctx.fillRect(cx - 0.55 + i * 0.145, cy - 0.5, 0.07, 0.3)
      label(ctx, 'LAN', cx, cy + 1.3)
      break
    }
    case 'usb': {
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(cx - 1.4, cy - 0.3, 1.2, 0.5)
      rr(ctx, cx + 0.35, cy - 0.25, 0.9, 0.4, 0.18)
      ctx.fill()
      ctx.fillStyle = '#3f6fd8'
      ctx.fillRect(cx - 1.3, cy - 0.22, 1.0, 0.16)
      label(ctx, 'USB A · C', cx, cy + 1.1)
      break
    }
  }
}

function label(ctx: CanvasRenderingContext2D, t: string, x: number, y: number) {
  ctx.fillStyle = '#8a8a86'
  ctx.font = '0.5px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(t, x, y)
}

const canvasCache = new Map<string, HTMLCanvasElement>()

/** Front face of a point type's plate drawn on a canvas (PX px/cm), cached per type. */
export function plateCanvas(type: PointType): HTMLCanvasElement {
  const hit = canvasCache.get(type)
  if (hit) return hit
  const pre = PRESETS[type]
  const { w, h } = pre.plate
  const c = document.createElement('canvas')
  c.width = Math.round(w * PX)
  c.height = Math.round(h * PX)
  const ctx = c.getContext('2d')!
  ctx.scale(PX, PX)
  if (pre.plate.shape === 'round') {
    const r = w / 2
    const g = ctx.createRadialGradient(r - r * 0.3, r - r * 0.3, r * 0.1, r, r, r)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(1, '#e6e5e0')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(r, r, r - 0.05, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 0.08
    ctx.beginPath()
    ctx.arc(r, r, r * 0.55, 0, Math.PI * 2)
    ctx.stroke()
    if (type === 'fanPoint') {
      // hook + terminal block
      ctx.strokeStyle = '#555'
      ctx.lineWidth = 0.35
      ctx.beginPath()
      ctx.arc(r, r, r * 0.22, 0, Math.PI * 1.6)
      ctx.stroke()
    } else {
      // lamp holder
      hole(ctx, r, r, r * 0.25)
      ctx.fillStyle = '#fff6d8'
      ctx.beginPath()
      ctx.arc(r, r, r * 0.15, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    // plate with subtle bevel
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(1, '#efeeea')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 0.12
    rr(ctx, 0.06, 0.06, w - 0.12, h - 0.12, 0.5)
    ctx.stroke()
    const totalM = pre.modules.reduce((a, m) => a + MODULE_WIDTH[m], 0)
    const margin = 0.9
    const mw = Math.min((w - 2 * margin) / totalM, 2.3)
    const mh = Math.min(h - 2 * margin, 6.2)
    let x = (w - mw * totalM) / 2
    const y = (h - mh) / 2
    // frame around the module row
    ctx.fillStyle = '#e4e3de'
    rr(ctx, x - 0.12, y - 0.12, mw * totalM + 0.24, mh + 0.24, 0.3)
    ctx.fill()
    for (const m of pre.modules) {
      const mwm = MODULE_WIDTH[m] * mw
      drawModule(ctx, m, x, y, mwm, mh)
      x += mwm
    }
    if (type === 'acPoint') label(ctx, 'AC', w - 0.6, h - 0.45)
    if (type === 'socket16A') label(ctx, '16A', w - 0.7, h - 0.45)
  }
  canvasCache.set(type, c)
  return c
}

const texCache = new Map<string, THREE.CanvasTexture>()

/** The plate drawing as a shared texture for the 3D plates (cached, never disposed). */
export function plateTexture(type: PointType): THREE.CanvasTexture {
  const hit = texCache.get(type)
  if (hit) return hit
  const t = new THREE.CanvasTexture(plateCanvas(type))
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  texCache.set(type, t)
  return t
}

const urlCache = new Map<string, string>()

/** PNG data URL of the plate (palette thumbnails), cached. */
export function plateDataUrl(type: PointType): string {
  const hit = urlCache.get(type)
  if (hit) return hit
  const u = plateCanvas(type).toDataURL()
  urlCache.set(type, u)
  return u
}
