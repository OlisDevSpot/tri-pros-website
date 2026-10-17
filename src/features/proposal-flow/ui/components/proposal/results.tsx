'use client'

import Link from 'next/link'
import { usePortfolioMatch } from '@/features/proposal-flow/contexts/portfolio-match-context'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ROOTS } from '@/shared/config/roots'

import { ChapterHeader } from './chapter-header'
import { ChapterInner } from './chapter-inner'
import { ResultsFeatured } from './results-featured'
import { ResultsStrip } from './results-strip'

export function Results() {
  const { proposal } = useProposalDocument()
  const { matches, isPending, isFallback, tradeLabel } = usePortfolioMatch()
  const isEmpty = !isPending && matches.length === 0
  const trade = isFallback || isEmpty ? null : tradeLabel
  const featured = matches[0]
  // With mixed trades, the kicker names the part the featured project matched.
  const featuredTrade = featured && !isFallback
    ? proposal.projectJSON.data.sow.find(section => featured.matchedTradeIds.includes(section.trade.id))?.trade.label ?? tradeLabel
    : null
  const kicker = isFallback ? 'Recent work' : featuredTrade ? `Closest match · ${featuredTrade}` : 'Closest match'

  return (
    <ChapterInner>
      <ChapterHeader
        chapter="results"
        title={trade ? `${trade} work we’ve already finished` : 'Work we’ve already finished'}
        lede={isFallback || isEmpty ? 'A few of our recent projects.' : 'Matched to the trades in your proposal.'}
      />
      {/* A homeowner never meets an empty chapter: with no public project, one line points at the portfolio. */}
      {isEmpty
        ? (
            <p className="text-muted-foreground">
              {'Browse our finished projects in the '}
              <Link href={ROOTS.landing.portfolioProjects()} className="font-semibold text-foreground underline underline-offset-4">portfolio</Link>
              .
            </p>
          )
        : (
            <div className="grid gap-12">
              <ResultsFeatured matches={matches} kicker={kicker} />
              <ResultsStrip matches={matches.slice(1, 3)} heading={trade ? `More ${trade} work` : 'More of our work'} />
            </div>
          )}
    </ChapterInner>
  )
}
