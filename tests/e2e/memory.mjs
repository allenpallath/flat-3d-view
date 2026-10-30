// OWNER: UI & QA agent (A6).
// `npm run e2e:memory`: GPU-resource leak regression test.
// Builds the app, serves it with `vite preview` on port 5194, opens it in headless Chromium with `?perf`
// (needs <PerfProbe/> mounted in the Canvas: it exposes window.__perf), then:
//   1. warm-up cycle (first use of every catalog model / material uploads textures + shaders that are
//      legitimately cached for the rest of the session), then records the baseline renderer.info.memory;
//   2. adds 60 furniture items and removes them, toggles quality high/low 6 times (each toggle waits for
//      the texture regeneration to finish) and cycles walk/dollhouse/plan modes;
//   3. waits, and checks geometries and textures are back to baseline within ±5% (JS heap: report only).
// Exits 1 on failure.
//
// Env: MEM_PORT (default 5194), MEM_ROOT (project to build, default this repo), SKIP_BUILD=1 (reuse MEM_DIST),
//      MEM_DIST (build output dir, default <tmp>/flat-3d-view-memtest), MEM_ITEMS (default 60), MEM_TOL (default 0.05).
import { createRequire } from 'module'
import { execSync, spawn } from 'child_process'
import { readFileSync } from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const root = path.resolve(process.env.MEM_ROOT ?? repo)
const PORT = Number(process.env.MEM_PORT ?? 5194)
const DIST = path.resolve(process.env.MEM_DIST ?? path.join(os.tmpdir(), 'flat-3d-view-memtest'))
const N_ITEMS = Number(process.env.MEM_ITEMS ?? 60)
const TOL = Number(process.env.MEM_TOL ?? 0.05)

let pw
try {
  pw = require('playwright')
} catch {
  pw = require(execSync('npm root -g').toString().trim() + '/playwright')
}
const { chromium } = pw

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(`[memory ${new Date().toISOString().slice(11, 19)}]`, ...a)

// catalog ids (static entries; templated ones such as tv${inches} are skipped)
const catalogSrc = readFileSync(path.join(root, 'src/planner/catalog.ts'), 'utf8')
const CATALOG = [...new Set([...catalogSrc.matchAll(/\bid:\s*'([A-Za-z0-9_-]+)'/g)].map((m) => m[1]))]
if (CATALOG.length === 0) throw new Error('no catalog ids found in src/planner/catalog.ts')

// ------------------------------------------------------------------ build + preview server
if (!process.env.SKIP_BUILD) {
  log('building to', DIST)
  execSync(`npx vite build --outDir "${DIST}" --emptyOutDir --logLevel warn`, { cwd: root, stdio: 'inherit' })
}
const server = spawn('npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
})
let serverOut = ''
server.stdout.on('data', (d) => (serverOut += d))
server.stderr.on('data', (d) => (serverOut += d))
const killServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    /* already gone */
  }
}
process.on('exit', killServer)
process.on('SIGINT', () => process.exit(130))

const URL_ = `http://localhost:${PORT}/?perf`
for (let i = 0; ; i++) {
  try {
    const r = await fetch(`http://localhost:${PORT}/`)
    if (r.ok) break
  } catch {
    /* not up yet */
  }
  if (i > 60) {
    console.error(serverOut)
    throw new Error('vite preview did not start')
  }
  await sleep(500)
}

// ------------------------------------------------------------------ browser
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-precise-memory-info',
    '--js-flags=--expose-gc',
  ],
})
const page = await browser.newPage({ viewport: { width: 800, height: 500 } })
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`)
})

let failed = false
try {
  await page.goto(URL_, { waitUntil: 'load' })
  try {
    await page.waitForFunction(() => window.__store && window.__perf, null, { timeout: 60000 })
  } catch {
    throw new Error('window.__perf missing: mount <PerfProbe /> inside <Canvas> in src/App.tsx')
  }
  await page.evaluate(() => window.__store.getState().set({ quality: 'high', mode: 'walk', tool: 'none' }))
  await waitTextures()

  log('warm-up cycle')
  await cycle(Math.min(N_ITEMS, CATALOG.length), 2, 1)
  const base = await measure()
  log('baseline', fmt(base))

  log(`main cycle: ${N_ITEMS} items, 6 quality toggles, 2 mode loops`)
  await cycle(N_ITEMS, 6, 2)
  await sleep(3000)
  const end = await measure()
  log('after   ', fmt(end))

  const check = (k) => {
    const lim = Math.max(1, Math.ceil(base[k] * TOL))
    const ok = Math.abs(end[k] - base[k]) <= lim
    log(`${ok ? 'PASS' : 'FAIL'} ${k}: ${base[k]} -> ${end[k]} (allowed ±${lim})`)
    return ok
  }
  const okGeo = check('geometries')
  const okTex = check('textures')
  if (base.heap != null) log(`heap (report only): ${mb(base.heap)} -> ${mb(end.heap)} MB`)
  if (errors.length) log('page errors:\n' + errors.slice(0, 10).join('\n'))
  failed = !(okGeo && okTex) || errors.some((e) => e.startsWith('[pageerror]'))
} catch (e) {
  console.error(e)
  failed = true
} finally {
  await browser.close()
  killServer()
}
log(failed ? 'FAILED' : 'OK')
process.exit(failed ? 1 : 0)

// ------------------------------------------------------------------ helpers
function mb(b) {
  return b == null ? 'n/a' : (b / 1048576).toFixed(1)
}
function fmt(m) {
  return `geometries=${m.geometries} textures=${m.textures} programs=${m.programs} heap=${mb(m.heap)} MB`
}

/** Render a few frames (works with frameloop="demand") and wait until at least one has been drawn. */
async function frames(n = 2) {
  for (let i = 0; i < n; i++) {
    const before = await page.evaluate(() => window.__perf.lastFrame())
    await page.evaluate(() => window.__perf.invalidate())
    await page
      .waitForFunction((t) => window.__perf.lastFrame() > t, before, { timeout: 90000, polling: 100 })
      .catch(() => log('warning: no frame rendered within 90 s'))
  }
}

async function waitTextures() {
  await sleep(400) // quality changes are debounced (250 ms) before regeneration starts
  await page.waitForFunction(() => window.__perf.texturesPending() === 0, null, { timeout: 120000, polling: 250 })
  await frames(2)
}

async function measure() {
  await frames(3)
  await sleep(1000)
  await page.evaluate(() => window.gc?.())
  return page.evaluate(() => ({ ...window.__perf.memory(), programs: window.__perf.programs(), heap: window.__perf.heap() }))
}

async function cycle(nItems, toggles, modeLoops) {
  // add furniture spread over the flat, render, then remove it
  const ids = await page.evaluate(
    ({ n, catalog }) => {
      const s = window.__store.getState()
      const out = []
      for (let i = 0; i < n; i++) {
        const catalogId = catalog[i % catalog.length]
        out.push(s.addItem({ catalogId, x: 80 + (i % 8) * 50, z: 80 + Math.floor(i / 8) * 60, y: 0, rot: (i * 90) % 360 }))
      }
      return out
    },
    { n: nItems, catalog: CATALOG },
  )
  await frames(2)
  await page.evaluate((list) => {
    const s = window.__store.getState()
    for (const id of list) s.removeItem(id)
    s.set({ selectedId: null })
  }, ids)
  await frames(2)

  // quality toggles (ends on the starting quality: high)
  for (let i = 0; i < toggles; i++) {
    const q = i % 2 === 0 ? 'low' : 'high'
    await page.evaluate((quality) => window.__store.getState().set({ quality }), q)
    await waitTextures()
  }
  if (toggles % 2) {
    await page.evaluate(() => window.__store.getState().set({ quality: 'high' }))
    await waitTextures()
  }

  // view modes (ends in walk)
  for (let i = 0; i < modeLoops; i++) {
    for (const mode of ['dollhouse', 'plan', 'walk']) {
      await page.evaluate((m) => window.__store.getState().setMode(m), mode)
      await frames(2)
    }
  }
}
