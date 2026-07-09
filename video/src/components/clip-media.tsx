import { Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion'

/**
 * Renders a clip source: video plays as-is; image gets a slow Ken Burns push
 * so stills read as footage inside the reel.
 */
export function ClipMedia({
  src,
  kind,
  durationInFrames,
}: {
  src: string
  kind: 'video' | 'image'
  durationInFrames: number
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

  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateRight: 'clamp',
  })
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
