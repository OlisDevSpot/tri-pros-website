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
          { src: 'clips/kitchen-01.mp4', durationInFrames: 150, layout: 'full' as const, aspect: 0.5625, label: null },
          { src: 'clips/kitchen-02.mp4', durationInFrames: 150, layout: 'full' as const, aspect: 0.5625, label: null },
          { src: 'clips/kitchen-03.mp4', durationInFrames: 150, layout: 'framed' as const, aspect: 1.5706, label: null },
        ],
        hook: 'We’re Selecting 5 Kitchens in Your Area',
        checkmarks: ['AAA-grade materials', 'Beautiful AND functional', 'Built to be photographed'],
        checkmarkClipIndex: 2,
        captions: [],
        voiceoverSrc: null,
        musicSrc: null,
        musicVolume: 0.18,
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
