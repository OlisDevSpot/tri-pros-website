import type { ShowcaseReelProps } from '../lib/schema'
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
import { RevealCaptions } from '../components/reveal-captions'
import { ClipMedia } from '../components/clip-media'
import { EndCard } from '../components/end-card'
import { FramedClip } from '../components/framed-clip'
import { HookTitle } from '../components/hook-title'
import { DOCK_FRAMES, LogoIntro } from '../components/logo-intro'
import { SafeZone } from '../components/safe-zone'
import { enterStyle, exitStyle, TRANSITION_FRAMES, wipeEdge } from '../lib/transitions'
import { BRAND } from '../lib/tokens'
import { colorPopSaturation, screenShakeOffset } from '../lib/accents'

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

  // Transitions: the incoming clip renders ON TOP of the still-running
  // previous clip (its Sequence extends TRANSITION_FRAMES beneath). The
  // incoming gets enterStyle, the outgoing gets exitStyle (whip/zoomPunch
  // move it out; fade/dissolve/wipe leave it playing until covered).
  let clipStart = 0
  const clipSequences = props.clips.map((clip, index) => {
    const from = clipStart
    clipStart += clip.durationInFrames
    const next = props.clips[index + 1]
    const nextTransition = next?.transitionIn ?? 'none'
    const nextDirection = next?.transitionDirection ?? 'left'
    const nextFrom = from + clip.durationInFrames
    const holdUnder = TRANSITION_FRAMES[nextTransition]
    const enter = enterStyle(clip.transitionIn ?? 'none', clip.transitionDirection ?? 'left', frame - from)
    const exit = exitStyle(nextTransition, nextDirection, frame - nextFrom)
    const edge = wipeEdge(clip.transitionIn ?? 'none', frame - from)
    return { ...clip, from, index, holdUnder, enter, exit, wipeEdgePct: edge }
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

  // Color pop: desaturate leading into pop, snap to full color.
  const saturation = colorPopSaturation(frame, props.colorPops ?? [])

  // Screen shake: impact-driven jitter.
  const shake = screenShakeOffset(frame, props.screenShakes ?? [])

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
      {/* Directional motion-blur filters for whip transitions (referenced by url()). */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="whip-blur-x"><feGaussianBlur stdDeviation="40 0" /></filter>
          <filter id="whip-blur-y"><feGaussianBlur stdDeviation="0 40" /></filter>
        </defs>
      </svg>
      <AbsoluteFill
        style={{
          transform: `translate(${shake.x}px, ${shake.y}px) scale(${punchScale * revealScale})`,
          filter: saturation < 1 ? `saturate(${saturation})` : undefined,
        }}
      >
        {clipSequences.map((clip) => {
          // Burst backdrop blur: once the first burst photo lands, the base
          // clip defocuses (12f ramp) so incoming photos read against a calm
          // ground instead of competing with a moving background (Oliver
          // 2026-07-14). scale(1.04) hides the blur's edge fringing.
          const burstHere = props.photoBurst?.clipIndex === clip.index ? props.photoBurst : null
          const burstStartLocal = burstHere && burstHere.photos.length > 0
            ? Math.min(...burstHere.photos.map(p => p.frame)) - clip.from
            : null
          const burstBlur = burstStartLocal === null
            ? 0
            : interpolate(frame - clip.from, [burstStartLocal, burstStartLocal + 12], [0, 14], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
          return (
        <Sequence key={clip.src} from={clip.from} durationInFrames={clip.durationInFrames + clip.holdUnder}>
          <AbsoluteFill
            style={{
              opacity: clip.enter.opacity * clip.exit.opacity,
              transform: clip.exit.transform !== 'none' ? clip.exit.transform : clip.enter.transform,
              clipPath: clip.enter.clipPath,
              filter: clip.exit.filter ?? clip.enter.filter,
            }}
          >
            <AbsoluteFill style={burstBlur > 0 ? { filter: `blur(${burstBlur}px)`, transform: 'scale(1.04)' } : undefined}>
            {clip.layout === 'framed'
              ? (
                  <FramedClip
                    src={clip.src}
                    kind={clip.kind}
                    durationInFrames={clip.durationInFrames}
                    aspect={clip.aspect}
                    label={clip.label}
                    kenBurns={clip.kenBurns ?? 'in'}
                    cardStyle={clip.cardStyle ?? 'native'}
                    secondarySrc={clip.secondarySrc ?? null}
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
                    <ClipMedia src={clip.src} kind={clip.kind} durationInFrames={clip.durationInFrames} kenBurns={clip.kenBurns ?? 'in'} />
                  </AbsoluteFill>
                )}
            </AbsoluteFill>
            {props.photoBurst?.clipIndex === clip.index && (
              <PhotoBurst
                style={props.photoBurst.style ?? 'fullbleed'}
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
          {/* The divider sits at the exact edge the clip-path above reveals up to, so it
              must live in an unclipped sibling layer — nesting it inside the clipPath'd
              AbsoluteFill would clip the divider itself away along with the hidden strip. */}
          {clip.wipeEdgePct !== null && (clip.transitionDirection ?? 'left') === 'left' && (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${clip.wipeEdgePct}%`, width: 4, background: BRAND.blue }} />
          )}
          {clip.wipeEdgePct !== null && (clip.transitionDirection ?? 'left') === 'right' && (
            <div style={{ position: 'absolute', top: 0, bottom: 0, right: `${clip.wipeEdgePct}%`, width: 4, background: BRAND.blue }} />
          )}
          {clip.wipeEdgePct !== null && (clip.transitionDirection ?? 'left') === 'up' && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: `${clip.wipeEdgePct}%`, height: 4, background: BRAND.blue }} />
          )}
          {clip.wipeEdgePct !== null && (clip.transitionDirection ?? 'left') === 'down' && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${clip.wipeEdgePct}%`, height: 4, background: BRAND.blue }} />
          )}
        </Sequence>
          )
        })}
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
          <HookTitle text={props.hook} style={props.hookStyle ?? 'wordStagger'} />
        </SafeZone>
      </Sequence>

      {props.wordCaptions.length > 0
        ? (
            <Sequence durationInFrames={clipsTotal}>
              <SafeZone>
                <RevealCaptions
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
