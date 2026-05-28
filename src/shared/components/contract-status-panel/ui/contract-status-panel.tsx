'use client'

import type { ContractStatusPanelProps } from '../types'
import { useContractStatus } from '../hooks/use-contract-status'
import { AgentContractView } from './agent-contract-view'
import { HomeownerContractView } from './homeowner-contract-view'

export function ContractStatusPanel({
  proposalId,
  token,
  isAgent,
  customerAge,
  proposalKind,
  customerName,
  customerEmail,
  proposalStatus,
  proposalSentAt,
}: ContractStatusPanelProps) {
  const { data: contractStatus, isLoading } = useContractStatus(proposalId, token)

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
        token={token ?? ''}
        customerEmail={customerEmail ?? null}
        contractStatus={contractStatus ?? null}
        proposalKind={proposalKind}
        customerName={customerName ?? null}
        proposalStatus={proposalStatus}
        proposalSentAt={proposalSentAt}
      />
    )
  }

  return (
    <HomeownerContractView
      proposalId={proposalId}
      token={token ?? ''}
      contractStatus={contractStatus ?? null}
      customerAge={customerAge ?? null}
    />
  )
}
