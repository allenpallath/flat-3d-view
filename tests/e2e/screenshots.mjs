// OWNER: UI & QA agent (A6).
// `npm run e2e`: starts its own Vite dev server on port 5186, opens the app in headless Chromium,
// captures one screenshot per room (via the __store teleport hook) plus dollhouse and plan views
// with the floor-plan overlay on, writes them to screenshots/, and exits 1 on page/console errors.
//
// Env: E2E_PORT (default 5186), E2E_OUT (default <repo>/screenshots), E2E_URL (use an already running server),
//      E2E_QUALITY (low|high, default low: headless software GL is slow), E2E_SIZE (default 1024x640),
//      E2E_FRAMES (frames to wait before each capture, default 2), E2E_FULLPAGE=1 (page screenshots incl. DOM UI).
import { createRequire } from 'module'
import { execSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = Number(process.env.E2E_PORT ?? 5186)
const OUT = path.resolve(process.env.E2E_OUT ?? path.join(root, 'screenshots'))
const QUALITY = process.env.E2E_QUALITY === 'high' ? 'high' : 'low'
const [VW, VH] = (process.env.E2E_SIZE ?? '1024x640').split('x').map(Number)

let pw
try {
  pw = require('playwright')
} catch {
  pw = require(execSync('npm root -g').toString().trim() + '/playwright')
}
const { chromium } = pw

// Messages that are noise from headless software GL, not app bugs.
const IGNORED = [/GPU stall due to ReadPixels/i, /WebGL.*(software|swiftshader)/i, /Automatic fallback to software WebGL/i]

// Same logic as roomViewpoint() in src/ui/format.ts (kept here so this script needs no TS loader).
function roomViewpoint(rect) {
  const w = rect.x2 - rect.x1
  const d = rect.z2 - rect.z1
  if (w >= d) return { x: rect.x1 + Math.min(Math.max(w * 0.15, 25), w / 2), z: (rect.z1 + rect.z2) / 2, yawDeg: -90 }
  return { x: (rect.x1 + rect.x2) / 2, z: rect.z1 + Math.min(Math.max(d * 0.15, 25), d / 2), yawDeg: 180 }
}

async function startServer() {
  if (process.env.E2E_URL) return { url: process.env.E2E_URL, close: async () => {} }
  const { createServer } = await import('vite')
  const server = await createServer({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    logLevel: 'warn',
    server: { port: PORT, strictPort: true, host: '127.0.0.1' },
  })
  await server.listen()
  return { url: `http://127.0.0.1:${PORT}/`, close: () => server.close() }
}

const errors = []
let server
let browser
let code = 0
try {
  mkdirSync(OUT, { recursive: true })
  server = await startServer()
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const page = await browser.newPage({ viewport: { width: VW, height: VH } })
  await page.addInitScript(() => {
    try {
      localStorage.setItem('flat-c-welcome-v1', '1')
    } catch {}
  })
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (!IGNORED.some((r) => r.test(t))) errors.push(`[console] ${t}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
  page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText ?? ''}`))

  console.log(`e2e: opening ${server.url} (${VW}x${VH}, quality ${QUALITY})`)
  await page.goto(server.url, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForFunction(() => !!window.__store && !!document.querySelector('canvas'), null, { timeout: 30_000 })
  await page.waitForTimeout(2500)

  const rooms = await page.evaluate(async () => {
    const mod = await import('/src/data/planC.ts')
    return mod.planC.rooms.map((r) => ({ id: r.id, name: r.name, rect: r.rect }))
  })

  // Wait for a few real animation frames (R3F renders inside rAF), however slow software GL is.
  const frames = (n = Number(process.env.E2E_FRAMES ?? 2)) =>
    page.evaluate(
      (n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f) }),
      n,
    )

  // Default: grab the WebGL canvas (preserveDrawingBuffer) — fast and reliable under headless software GL,
  // where a full compositor screenshot can take minutes. E2E_FULLPAGE=1 captures the whole page incl. DOM UI.
  const FULLPAGE = process.env.E2E_FULLPAGE === '1'
  const shot = async (name, { full = FULLPAGE } = {}) => {
    const file = path.join(OUT, `${name}.png`)
    await frames()
    if (full) {
      await page.screenshot({ path: file, timeout: 180_000 })
    } else {
      const url = await page.evaluate(() => {
        const c = document.querySelector('canvas#scene') ?? document.querySelector('#scene canvas') ?? document.querySelector('canvas')
        return c ? c.toDataURL('image/png') : null
      })
      if (!url) throw new Error('no canvas to capture')
      writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
    }
    console.log(`  saved ${path.relative(root, file)}`)
  }

  await page.evaluate((quality) => window.__store.getState().set({ mode: 'walk', overlay: false, tool: 'none', quality }), QUALITY)
  await page.waitForTimeout(1500)
  for (const r of rooms) {
    const v = roomViewpoint(r.rect)
    await page.evaluate(({ x, z, yawDeg }) => window.__store.getState().requestTeleport(x, z, yawDeg), v)
    await page.waitForTimeout(1200)
    await shot(`walk-${r.id}`)
  }

  for (const mode of ['dollhouse', 'plan']) {
    await page.evaluate((m) => window.__store.getState().set({ mode: m, overlay: true }), mode)
    await page.waitForTimeout(2000)
    await shot(`${mode}-overlay`)
  }
  await page.evaluate(() => window.__store.getState().set({ mode: 'dollhouse', overlay: false }))
  await page.waitForTimeout(1500)
  await shot('dollhouse')

  // UI smoke checks: toolbar + HUD rendered, help modal opens.
  const hasToolbar = await page.locator('[role="toolbar"]').count()
  const hasHud = await page.locator('[data-testid="hud"]').count()
  if (!hasToolbar) errors.push('[ui] toolbar not rendered')
  if (!hasHud) errors.push('[ui] HUD not rendered')
  await page.locator('[data-testid="help"]').click()
  await page.waitForTimeout(300)
  if (!(await page.locator('[role="dialog"][aria-modal="true"]').count())) errors.push('[ui] help modal did not open')
  try {
    await shot('ui-help', { full: true })
  } catch (e) {
    console.warn(`  (skipped full-page UI screenshot: ${String(e.message).split('\n')[0]})`)
  }
  await page.keyboard.press('Escape')
} catch (e) {
  errors.push(`[e2e] ${e?.stack ?? e}`)
} finally {
  await browser?.close().catch(() => {})
  await server?.close().catch(() => {})
}

if (errors.length) {
  console.error(`e2e: ${errors.length} error(s):\n` + errors.slice(0, 30).join('\n'))
  code = 1
} else {
  console.log(`e2e: OK, screenshots in ${path.relative(root, OUT) || OUT}`)
}
process.exit(code)
