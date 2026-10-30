// OWNER: Materials & Lighting agent (A2).
// High quality only: N8AO ambient occlusion (metric radius), subtle bloom on lights / bright windows,
// AgX tone mapping (the composer disables renderer tone mapping, so we apply it here), SMAA, light vignette.
import { useEffect, useRef } from 'react'
import { HalfFloatType } from 'three'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useStore } from '../store'

export default function PostFX() {
  const quality = useStore((s) => s.quality)
  const mode = useStore((s) => s.mode)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ao = useRef<any>(null)
  useEffect(() => {
    // N8AO's post pass gamma-corrects its output by default; we are mid-chain in linear HDR.
    if (ao.current?.configuration) ao.current.configuration.gammaCorrection = false
  })
  if (quality !== 'high') return null
  const overview = mode !== 'walk'
  return (
    <EffectComposer multisampling={0} frameBufferType={HalfFloatType}>
      <N8AO
        ref={ao}
        aoRadius={overview ? 1.2 : 0.6}
        distanceFalloff={overview ? 1 : 0.5}
        intensity={overview ? 2.5 : 2.2}
        aoSamples={12}
        denoiseSamples={4}
        denoiseRadius={10}
        halfRes
        quality="performance"
      />
      <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.3} intensity={0.35} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
      <Vignette offset={0.32} darkness={0.38} />
    </EffectComposer>
  )
}
