'use client'

import type { ContractStatusPanelProps } from '../types'
import { useContractStatus } from '../hooks/use-contract-status'
import { AgentContractView } from './agent-contract-view'
import { HomeownerContractView } from './homeowner-contract-view'

export function ContractStatusPanel({ proposalId, token, variant, isAgent }: ContractStatusPanelProps) {
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
        contractStatus={contractStatus ?? null}
      />
    )
  }

  return (
    <HomeownerContractView
      proposalId={proposalId}
      token={token ?? ''}
      contractStatus={contractStatus ?? null}
    />
  )
}
