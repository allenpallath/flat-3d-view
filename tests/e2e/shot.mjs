// Usage: node tests/e2e/shot.mjs <url> <out.png> [jsToEvalBeforeShot]
// Example: node tests/e2e/shot.mjs http://localhost:5181 /tmp/a.png "__store.getState().requestTeleport(150,300,-90)"
import { createRequire } from 'module'
import { execSync } from 'child_process'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright') }
const { chromium } = pw
const [url, out, js] = process.argv.slice(2)
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const logs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
if (js) { await page.evaluate(js); await page.waitForTimeout(2000) }
await page.screenshot({ path: out })
console.log(logs.slice(0, 20).join('\n') || 'no console errors')
await browser.close()
