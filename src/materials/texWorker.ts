// OWNER: Materials & Lighting agent (A2).
// Web Worker: generates procedural texture sets off the main thread and transfers the buffers back.
import { GENERATORS, type TexSetName } from './generators'

self.onmessage = (e: MessageEvent<{ names: TexSetName[] }>) => {
  for (const name of e.data.names) {
    const raw = GENERATORS[name]()
    const transfer = [raw.col.buffer, raw.rough?.buffer, raw.normal?.buffer].filter(Boolean) as ArrayBuffer[]
    ;(self as unknown as Worker).postMessage({ name, raw }, transfer)
  }
}
