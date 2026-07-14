import type { KenBurns } from '../lib/schema'
import { Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion'
import { normalizeKenBurns } from '../lib/schema'

/**
 * Renders a clip source: video plays as-is; image gets a slow Ken Burns move
 * (zoom in/out, optional pan drift) so stills read as footage inside the reel.
 */
export function ClipMedia({
  src,
  kind,
  durationInFrames,
  kenBurns = 'in',
}: {
  src: string
  kind: 'video' | 'image'
  durationInFrames: number
  kenBurns?: KenBurns
}) {
  const frame = useCurrentFrame()

  if (kind === 'video') {
    return (
      <OffthreadVideo
        src={staticFile(src)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }

  const { zoom, pan } = normalizeKenBurns(kenBurns)
  const zoomRange = zoom === 'in' ? [1, 1.08] : [1.08, 1]
  // Panning needs headroom or the drift exposes the frame edge.
  const minScale = pan === 'none' ? 1 : 1.06
  const scale = Math.max(
    minScale,
    interpolate(frame, [0, durationInFrames], zoomRange, { extrapolateRight: 'clamp' }),
  )
  const drift = interpolate(frame, [0, durationInFrames], [0, 2.5], { extrapolateRight: 'clamp' })
  const tx = pan === 'left' ? -drift : pan === 'right' ? drift : 0
  const ty = pan === 'up' ? -drift : pan === 'down' ? drift : 0
  return (
    <Img
      src={staticFile(src)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
      }}
    />
  )
}
