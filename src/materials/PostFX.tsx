// Post-processing, high quality only: N8AO ambient occlusion (metric radius), subtle bloom on lights / bright windows,
// AgX tone mapping (the composer disables renderer tone mapping, so we apply it here), SMAA, light vignette.
import { useEffect, useRef } from 'react'
import { HalfFloatType } from 'three'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useStore } from '../store'

/** The effect chain (mounted only on high quality; tuned separately for walk and overview modes). */
export default function PostFX() {
  const quality = useStore((s) => s.quality)
  const mode = useStore((s) => s.mode)
  const ao = useRef<{ configuration?: { gammaCorrection: boolean } }>(null)
  useEffect(() => {
    // N8AO's post pass gamma-corrects its output by default; we are mid-chain in linear HDR.
    if (ao.current?.configuration) ao.current.configuration.gammaCorrection = false
  })
  if (quality !== 'high') return null
  const hiDpi = typeof window !== 'undefined' && window.devicePixelRatio >= 1.75
  const overview = mode !== 'walk'
  return (
    <EffectComposer multisampling={0} frameBufferType={HalfFloatType}>
      {/* Tuned against black flicker while walking: half-res AO is only used on high-DPI screens
          (where half res is still >= 1 CSS px), more samples + a tighter denoise avoid dark
          "boiling" blotches, and a gentler intensity keeps any residual noise invisible. */}
      <N8AO
        ref={ao}
        aoRadius={overview ? 1.2 : 0.5}
        distanceFalloff={1}
        intensity={overview ? 2 : 1.4}
        quality="medium"
        denoiseRadius={6}
        halfRes={hiDpi}
        depthAwareUpsampling
      />
      <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.3} intensity={0.35} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
      <Vignette offset={0.32} darkness={0.38} />
    </EffectComposer>
  )
}
