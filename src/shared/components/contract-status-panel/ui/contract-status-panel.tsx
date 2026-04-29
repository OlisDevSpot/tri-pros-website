'use client'

import type { ContractStatusPanelProps } from '../types'
import { useContractStatus } from '../hooks/use-contract-status'
import { AgentContractView } from './agent-contract-view'
import { HomeownerContractView } from './homeowner-contract-view'

export function ContractStatusPanel({
  proposalId,
  token,
  variant: _variant,
  isAgent,
  customerAge,
  customerId,
  envelopeDocumentIds,
  onSendProposalEmail,
  isSendingEmail,
  proposalStatus,
  proposalSentAt,
}: ContractStatusPanelProps) {
  const isSent = proposalStatus === 'sent'
  const { data: contractStatus, isLoading, isDraftSyncing } = useContractStatus(proposalId, token, isSent)

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
      </div>
    )
  }

  if (isAgent) {
    return (
      <AgentContractView
        proposalId={proposalId}
        contractStatus={contractStatus ?? null}
        customerAge={customerAge ?? null}
        customerId={customerId ?? null}
        envelopeDocumentIds={envelopeDocumentIds ?? null}
        onSendProposalEmail={onSendProposalEmail}
        isSendingEmail={isSendingEmail}
        proposalStatus={proposalStatus}
        proposalSentAt={proposalSentAt}
        isDraftSyncing={isDraftSyncing}
      />
    )
  }

  return (
    <HomeownerContractView
      proposalId={proposalId}
      token={token ?? ''}
      contractStatus={contractStatus ?? null}
      customerAge={customerAge ?? null}
      customerId={customerId ?? null}
    />
  )
}
