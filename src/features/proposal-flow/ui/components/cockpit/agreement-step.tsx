'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useContractStatus } from '@/shared/components/contract-status-panel/hooks/use-contract-status'
import { deriveTimelineState } from '@/shared/components/contract-status-panel/lib/derive-timeline-state'
import { getEnvelopeStatusBadge } from '@/shared/components/contract-status-panel/lib/get-status-badge'
import { AgreementTimeline } from '@/shared/components/contract-status-panel/ui/agreement-timeline'
import { EnvelopeCard } from '@/shared/components/contract-status-panel/ui/envelope-card'
import { companyInfo } from '@/shared/constants/company'

import { CockpitStep } from './cockpit-step'

export function AgreementStep() {
  const { proposal } = useProposalDocument()
  const { data: contractStatus } = useContractStatus(proposal.id, proposal.token ?? undefined)
  const envelopeBadge = getEnvelopeStatusBadge(contractStatus?.requestStatus)
  const customer = proposal.customer?.name?.trim() || 'the customer'
  const signers = proposal.kind === 'initial-sale' ? `${companyInfo.nickname}, then ${customer}` : customer

  return (
    <CockpitStep
      number={3}
      title="Agreement"
      status={envelopeBadge?.label ?? (proposal.kind === 'initial-sale' ? 'Initial sale' : 'Additional work')}
    >
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Signers</dt>
        <dd className="font-bold">{signers}</dd>
      </dl>
      {envelopeBadge && <AgreementTimeline steps={deriveTimelineState(contractStatus ?? null)} />}
      <EnvelopeCard
        proposalId={proposal.id}
        contractStatus={contractStatus ?? null}
        customerName={proposal.customer?.name ?? null}
        proposalKind={proposal.kind}
        configurationLayout="inline"
      />
    </CockpitStep>
  )
}
