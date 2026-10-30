// Web Worker (started by materials.ts): generates procedural texture sets off the main thread and transfers the buffers back.
import { GENERATORS, type TexSetName } from './generators'
import { setTextureScale } from './textures'

self.onmessage = (e: MessageEvent<{ names: TexSetName[]; scale?: number; gen?: number }>) => {
  setTextureScale(e.data.scale ?? 1)
  for (const name of e.data.names) {
    const raw = GENERATORS[name]()
    const transfer = [raw.col.buffer, raw.rough?.buffer, raw.normal?.buffer].filter(Boolean) as ArrayBuffer[]
    ;(self as unknown as Worker).postMessage({ name, raw, gen: e.data.gen }, transfer)
  }
}
