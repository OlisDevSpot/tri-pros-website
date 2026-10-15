'use client'

import { FileSignatureIcon } from 'lucide-react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useContractStatus } from '@/shared/components/contract-status-panel/hooks/use-contract-status'
import { deriveTimelineState } from '@/shared/components/contract-status-panel/lib/derive-timeline-state'
import { AgreementTimeline } from '@/shared/components/contract-status-panel/ui/agreement-timeline'
import { EnvelopeCard } from '@/shared/components/contract-status-panel/ui/envelope-card'
import { OverviewCard } from '@/shared/components/entities/overview-card/overview-card'

export function CockpitAgreementCard() {
  const { proposal } = useProposalDocument()
  const { data: contractStatus } = useContractStatus(proposal.id, proposal.token ?? undefined)
  return (
    <OverviewCard>
      <OverviewCard.Header icon={<FileSignatureIcon className="size-4" />} eyebrow="Agreement" title={proposal.kind === 'initial-sale' ? 'Initial sale' : 'Additional work'} />
      <OverviewCard.Body>
        <AgreementTimeline steps={deriveTimelineState(contractStatus ?? null)} />
        <EnvelopeCard
          proposalId={proposal.id}
          contractStatus={contractStatus ?? null}
          customerName={proposal.customer?.name ?? null}
          proposalKind={proposal.kind}
          className="rounded-none border-0 bg-transparent p-0 sm:p-0"
          concealAge
        />
      </OverviewCard.Body>
    </OverviewCard>
  )
}
