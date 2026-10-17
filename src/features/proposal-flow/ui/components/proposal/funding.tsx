'use client'

import { useMemo } from 'react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useFundingChoice } from '@/features/proposal-flow/hooks/use-funding-choice'
import { PricingBreakdown } from '@/features/proposal-flow/ui/components/pricing-breakdown'
import { ChapterHeader } from '@/features/proposal-flow/ui/components/proposal/chapter-header'
import { ChapterInner } from '@/features/proposal-flow/ui/components/proposal/chapter-inner'
import { PayCard } from '@/features/proposal-flow/ui/components/proposal/pay-card'
import { PaymentScheduleFold } from '@/features/proposal-flow/ui/components/proposal/payment-schedule-fold'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'

export function Funding() {
  const { proposal } = useProposalDocument()
  const funding = useMemo(() => toFundingInputs(proposal), [proposal])
  const choice = useFundingChoice()
  const lede = proposal.priceDisplayMode === 'breakdown'
    ? 'Every part priced, every saving shown. Choose how you’d like to pay.'
    : 'Your price, with every saving shown. Choose how you’d like to pay.'

  return (
    <ChapterInner>
      <ChapterHeader chapter="funding" title="Your investment" lede={lede} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 @min-[1000px]/proposal:grid-cols-2 @min-[1000px]/proposal:items-start @min-[1000px]/proposal:gap-6">
        <PricingBreakdown funding={funding} sow={proposal.projectJSON.data.sow} priceDisplayMode={proposal.priceDisplayMode} />
        <PayCard choice={choice} />
        <PaymentScheduleFold schedule={choice.schedule} finalTcp={choice.finalTcp} />
      </div>
    </ChapterInner>
  )
}
