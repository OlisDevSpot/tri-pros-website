import { Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion'

/**
 * Renders a clip source: video plays as-is; image gets a slow Ken Burns push
 * so stills read as footage inside the reel.
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
  kenBurns?: 'in' | 'out'
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

  const zoom = interpolate(
    frame,
    [0, durationInFrames],
    kenBurns === 'in' ? [1, 1.08] : [1.08, 1],
    { extrapolateRight: 'clamp' },
  )
  return (
    <Img
      src={staticFile(src)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: `scale(${zoom})`,
      }}
    />
  )
}
