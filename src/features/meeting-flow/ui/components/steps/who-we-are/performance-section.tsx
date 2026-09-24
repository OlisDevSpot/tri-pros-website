'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { useHomeownerQuotes } from '@/features/meeting-flow/hooks/use-homeowner-quotes'
import { BeforeAfterCompare } from '@/features/meeting-flow/ui/components/steps/who-we-are/before-after-compare'
import { GrowthLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/growth-layout'
import { HomeownerQuote } from '@/features/meeting-flow/ui/components/steps/who-we-are/homeowner-quote'
import { ProofRail } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-rail'
import { ReputationMark } from '@/features/meeting-flow/ui/components/steps/who-we-are/reputation-mark'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type PerformanceSectionProps = SlideProps<WhoWeAreContentOf<'performance'>>

/**
 * Point 6: a room the homeowner can drag from before to after, the record and the public
 * standing under it, then a portfolio homeowner in their own words. The compare fills what the
 * record and quote leave; on a short screen the slide grows rather than clip the quote.
 */
export function PerformanceSection({ content, ...slide }: PerformanceSectionProps) {
  const quotes = useHomeownerQuotes()

  return (
    <Slide {...slide}>
      <GrowthLayout className="grid-rows-[1fr_auto_auto] gap-presentation-tight">
        <div className="grid content-center">
          <BeforeAfterCompare media={content.media} />
        </div>
        <Reveal className="grid gap-presentation-tight" order={0}>
          <ProofRail rail={content.rail} />
          <ul className="flex flex-wrap gap-x-[2.2cqw] gap-y-1 text-presentation-body">
            {content.reputation.map(mark => (
              <ReputationMark key={mark.kind === 'fact' ? mark.value : mark.platform} mark={mark} />
            ))}
          </ul>
        </Reveal>
        {quotes.length > 0 && (
          <Reveal order={1}>
            <HomeownerQuote quotes={quotes} />
          </Reveal>
        )}
      </GrowthLayout>
    </Slide>
  )
}
