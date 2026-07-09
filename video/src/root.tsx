import { Composition } from 'remotion'
import { ShowcaseReel } from './compositions/showcase-reel'
import { showcaseReelSchema } from './lib/schema'
import { FPS } from './lib/tokens'

export function RemotionRoot() {
  return (
    <Composition
      id="ShowcaseReel"
      component={ShowcaseReel}
      schema={showcaseReelSchema}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={600}
      calculateMetadata={({ props }) => ({
        durationInFrames:
          props.clips.reduce((sum, c) => sum + c.durationInFrames, 0) + props.endCardFrames,
      })}
      defaultProps={{
        clips: [
          { src: 'clips/kitchen-01.mp4', kind: 'video' as const, durationInFrames: 150, layout: 'full' as const, aspect: 0.5625, label: null, kenBurns: 'in' as const },
          { src: 'clips/kitchen-02.mp4', kind: 'video' as const, durationInFrames: 150, layout: 'full' as const, aspect: 0.5625, label: null, kenBurns: 'in' as const },
          { src: 'clips/kitchen-03.mp4', kind: 'video' as const, durationInFrames: 150, layout: 'framed' as const, aspect: 1.5706, label: null, kenBurns: 'in' as const },
        ],
        hook: 'We’re Selecting 5 Kitchens in Your Area',
        hookStartFrame: 0,
        hookDurationInFrames: 75,
        checkmarks: ['AAA-grade materials', 'Beautiful AND functional', 'Built to be photographed'],
        checkmarkClipIndex: 2,
        captions: [],
        wordCaptions: [],
        voStartFrame: 15,
        captionVertical: 0.58,
        punchIns: [],
        flashFrames: [],
        sfx: [],
        voiceoverSrc: null,
        musicSrc: null,
        watermarkSrc: 'brand/logo-dark.svg',
        watermarkWidth: 110,
        logoIntro: null,
        zoomOutReveals: [],
        musicVolume: 0.12,
        endCard: {
          headline: 'Could Your Kitchen Be One of the 5?',
          sub: 'AAA-grade work, at a Showcase price. Homeowners only.',
          cta: 'See If Your Home Qualifies',
        },
        endCardFrames: 120,
      }}
    />
  )
}
