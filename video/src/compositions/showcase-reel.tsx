import type { ShowcaseReelProps } from '../lib/schema'
import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import { CaptionTrack } from '../components/caption-track'
import { CheckmarkList } from '../components/checkmark-list'
import { EndCard } from '../components/end-card'
import { HookTitle } from '../components/hook-title'
import { SafeZone } from '../components/safe-zone'

/**
 * The Showcase 9:16 reel: hook headline over clip 1 → b-roll with captions
 * (+ optional checkmark overlay on clip 2) → branded end card.
 * All timing derives from props so one composition serves every trade/variant.
 */
export function ShowcaseReel(props: ShowcaseReelProps) {
  const frame = useCurrentFrame()
  const clipsTotal = props.clips.reduce((sum, c) => sum + c.durationInFrames, 0)
  const total = clipsTotal + props.endCardFrames
  const hookFrames = Math.min(75, props.clips[0]!.durationInFrames)

  // Duck the music bed while a caption (≈ the voiceover) is active.
  const captionActive = props.captions.some(c => frame >= c.startFrame && frame < c.endFrame)
  const musicLevel = captionActive ? props.musicVolume : Math.min(0.35, props.musicVolume * 2)

  let clipStart = 0
  const clipSequences = props.clips.map((clip) => {
    const from = clipStart
    clipStart += clip.durationInFrames
    return { ...clip, from }
  })

  return (
    <AbsoluteFill style={{ background: '#000000' }}>
      {clipSequences.map(clip => (
        <Sequence key={clip.src} from={clip.from} durationInFrames={clip.durationInFrames}>
          <AbsoluteFill>
            <OffthreadVideo
              src={staticFile(clip.src)}
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </AbsoluteFill>
        </Sequence>
      ))}

      {/* Subtle bottom gradient keeps captions legible over bright footage. */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 34%)',
          opacity: interpolate(frame, [clipsTotal - 10, clipsTotal], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />

      <Sequence durationInFrames={hookFrames}>
        <SafeZone>
          <HookTitle text={props.hook} />
        </SafeZone>
      </Sequence>

      {props.checkmarks.length > 0 && clipSequences[1] && (
        <Sequence from={clipSequences[1].from} durationInFrames={clipSequences[1].durationInFrames}>
          <SafeZone>
            <CheckmarkList items={props.checkmarks} />
          </SafeZone>
        </Sequence>
      )}

      <Sequence from={hookFrames} durationInFrames={clipsTotal - hookFrames}>
        <SafeZone>
          <CaptionTrack
            captions={props.captions.map(c => ({
              ...c,
              startFrame: c.startFrame - hookFrames,
              endFrame: c.endFrame - hookFrames,
            }))}
          />
        </SafeZone>
      </Sequence>

      <Sequence from={clipsTotal} durationInFrames={props.endCardFrames}>
        <EndCard content={props.endCard} />
      </Sequence>

      {props.voiceoverSrc && <Audio src={staticFile(props.voiceoverSrc)} />}
      {props.musicSrc && (
        <Audio
          src={staticFile(props.musicSrc)}
          volume={f =>
            interpolate(f, [total - 30, total], [musicLevel, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}
        />
      )}
    </AbsoluteFill>
  )
}
