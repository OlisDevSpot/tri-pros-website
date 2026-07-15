import type { ShowcaseReelProps } from '../lib/schema'
import { normalizeKenBurns } from '../lib/schema'
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import { BrandBlock } from '../components/brand-block'
import { CaptionTrack } from '../components/caption-track'
import { CheckmarkList } from '../components/checkmark-list'
import { PhotoBurst } from '../components/photo-burst'
import { KaraokeCaptions } from '../components/karaoke-captions'
import { ClipMedia } from '../components/clip-media'
import { EndCard } from '../components/end-card'
import { FramedClip } from '../components/framed-clip'
import { HookTitle } from '../components/hook-title'
import { DOCK_FRAMES, LogoIntro } from '../components/logo-intro'
import { SafeZone } from '../components/safe-zone'

/**
 * The Showcase 9:16 reel: hook headline over clip 1 → proof clips (full-bleed
 * portrait or framed editorial card for landscape sources) with burned-in
 * captions → branded end card. All timing derives from props so one
 * composition serves every trade/variant.
 */
export function ShowcaseReel(props: ShowcaseReelProps) {
  const frame = useCurrentFrame()
  const clipsTotal = props.clips.reduce((sum, c) => sum + c.durationInFrames, 0)
  const total = clipsTotal + props.endCardFrames
  const hookEnd = props.hookStartFrame + props.hookDurationInFrames

  // Duck the music bed while the voiceover talks.
  const voActive = props.wordCaptions.length > 0
    ? (() => {
        const audioMs = ((frame - props.voStartFrame) / 30) * 1000
        return props.wordCaptions.some(w => audioMs >= w.startMs - 200 && audioMs < w.endMs + 200)
      })()
    : props.captions.some(c => frame >= c.startFrame && frame < c.endFrame)
  const musicLevel = voActive ? props.musicVolume : Math.min(0.35, props.musicVolume * 2)

  // Fade transitions: an incoming `fade` clip ramps opacity over the still-
  // running previous clip (its Sequence is extended beneath), so cuts read
  // fluid instead of popping. `none` stays a hard cut for the snap moment.
  const FADE_FRAMES = 10
  let clipStart = 0
  const clipSequences = props.clips.map((clip, index) => {
    const from = clipStart
    clipStart += clip.durationInFrames
    const next = props.clips[index + 1]
    const holdUnder = next?.transitionIn === 'fade' ? FADE_FRAMES : 0
    const enterOpacity = clip.transitionIn === 'fade'
      ? interpolate(frame, [from, from + FADE_FRAMES], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1
    return { ...clip, from, index, holdUnder, enterOpacity }
  })

  // Punch-in: hard scale jump on the hit frame, decaying back over 10f.
  const punchScale = props.punchIns.reduce((acc, p) => {
    const elapsed = frame - p.frame
    if (elapsed < 0)
      return acc
    return Math.max(acc, interpolate(elapsed, [0, 10], [p.scale, 1], { extrapolateRight: 'clamp' }))
  }, 1)

  // Zoom-out reveal: after-shot arrives oversized and settles — gentle
  // (135% over 18f, eased) so it reads as a reveal, never a choppy pop.
  const revealScale = props.zoomOutReveals.reduce((acc, f) => {
    const elapsed = frame - f
    if (elapsed < 0)
      return acc
    return Math.max(acc, interpolate(elapsed, [0, 18], [1.35, 1], {
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }))
  }, 1)

  // Luma flash: white overlay peaking exactly ON each flash frame (6f total).
  const flashOpacity = props.flashFrames.reduce(
    (acc, f) => Math.max(acc, interpolate(frame, [f - 3, f, f + 3], [0, 0.9, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })),
    0,
  )

  return (
    <AbsoluteFill style={{ background: '#000000' }}>
      <AbsoluteFill style={{ transform: `scale(${punchScale * revealScale})` }}>
        {clipSequences.map(clip => (
        <Sequence key={clip.src} from={clip.from} durationInFrames={clip.durationInFrames + clip.holdUnder}>
          <AbsoluteFill style={{ opacity: clip.enterOpacity }}>
            {clip.layout === 'framed'
              ? (
                  <FramedClip
                    src={clip.src}
                    kind={clip.kind}
                    durationInFrames={clip.durationInFrames}
                    aspect={clip.aspect}
                    label={clip.label}
                    kenBurns={normalizeKenBurns(clip.kenBurns).zoom}
                    above={
                      props.checkmarkClipIndex === clip.index && props.checkmarks.length > 0
                        ? (
                            <div style={{ transform: 'scale(0.72)', transformOrigin: 'bottom center' }}>
                              <CheckmarkList items={props.checkmarks} />
                            </div>
                          )
                        : undefined
                    }
                  />
                )
              : (
                  <AbsoluteFill>
                    <ClipMedia src={clip.src} kind={clip.kind} durationInFrames={clip.durationInFrames} kenBurns={normalizeKenBurns(clip.kenBurns).zoom} />
                  </AbsoluteFill>
                )}
            {props.photoBurst?.clipIndex === clip.index && (
              <PhotoBurst
                photos={props.photoBurst.photos.map(p => ({ ...p, frame: p.frame - clip.from }))}
              />
            )}
            {props.brandClipIndex === clip.index && props.brandBlock && (
              <BrandBlock
                logoSrc={props.brandBlock.logoSrc}
                line1={props.brandBlock.line1}
                line2={props.brandBlock.line2}
              />
            )}
          </AbsoluteFill>
        </Sequence>
        ))}
      </AbsoluteFill>

      {/* Hook scrim: dark overlay so the cold-open headline + logo read over
          bright footage; fades out as the hook exits. */}
      {props.hookScrimOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 45%, rgba(0,0,0,0.75) 100%)',
            opacity: interpolate(
              frame,
              [0, 8, hookEnd, hookEnd + 12],
              [0, props.hookScrimOpacity, props.hookScrimOpacity, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            ),
          }}
        />
      )}

      {props.watermarkSrc && (() => {
        const watermarkFrom = props.logoIntro ? props.logoIntro.dockFrame + DOCK_FRAMES : 0
        return (
          <Sequence from={watermarkFrom} durationInFrames={clipsTotal - watermarkFrom}>
            <div style={{ position: 'absolute', top: '14%', right: '6%', opacity: 0.85 }}>
              <Img src={staticFile(props.watermarkSrc)} style={{ width: props.watermarkWidth }} />
            </div>
          </Sequence>
        )
      })()}

      {props.logoIntro && (
        <Sequence durationInFrames={props.logoIntro.dockFrame + DOCK_FRAMES}>
          <LogoIntro
            src={props.logoIntro.src}
            enterFrame={props.logoIntro.enterFrame}
            dockFrame={props.logoIntro.dockFrame}
            watermarkWidth={props.watermarkWidth}
          />
        </Sequence>
      )}

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

      <Sequence from={props.hookStartFrame} durationInFrames={props.hookDurationInFrames}>
        <SafeZone>
          <HookTitle text={props.hook} />
        </SafeZone>
      </Sequence>

      {props.wordCaptions.length > 0
        ? (
            <Sequence durationInFrames={clipsTotal}>
              <SafeZone>
                <KaraokeCaptions
                  wordCaptions={props.wordCaptions}
                  voStartFrame={props.voStartFrame}
                  hideBeforeFrame={hookEnd}
                  vertical={props.captionVertical}
                />
              </SafeZone>
            </Sequence>
          )
        : (
            <Sequence from={hookEnd} durationInFrames={clipsTotal - hookEnd}>
              <SafeZone>
                <CaptionTrack
                  vertical={props.captionVertical}
                  captions={props.captions.map(c => ({
                    ...c,
                    startFrame: c.startFrame - hookEnd,
                    endFrame: c.endFrame - hookEnd,
                  }))}
                />
              </SafeZone>
            </Sequence>
          )}

      <Sequence from={clipsTotal} durationInFrames={props.endCardFrames}>
        <EndCard content={props.endCard} />
      </Sequence>

      {props.voiceoverSrc && (
        <Sequence from={props.voStartFrame}>
          <Audio src={staticFile(props.voiceoverSrc)} />
        </Sequence>
      )}
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
      {props.sfx.map(cue => (
        <Sequence key={`${cue.src}-${cue.frame}`} from={cue.frame}>
          <Audio src={staticFile(cue.src)} volume={cue.volume} />
        </Sequence>
      ))}

      {/* Luma flash sits above everything except nothing — it masks the cut. */}
      {flashOpacity > 0 && (
        <AbsoluteFill style={{ background: '#ffffff', opacity: flashOpacity }} />
      )}
    </AbsoluteFill>
  )
}
