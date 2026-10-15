'use client'

import { useContractStatus } from '../hooks/use-contract-status'
import { HomeownerContractView } from './homeowner-contract-view'

export interface ContractStatusPanelProps {
  proposalId: string
  token?: string
  customerAge?: number | null
}

export function ContractStatusPanel({
  proposalId,
  token,
  customerAge,
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

  return (
    <HomeownerContractView
      proposalId={proposalId}
      token={token ?? ''}
      contractStatus={contractStatus ?? null}
      customerAge={customerAge ?? null}
    />
  )
}
