'use client'

import type { EnvelopeDocumentId, ProposalKind, ProposalStatus } from '@/shared/constants/enums'
import { useContractStatus } from '../hooks/use-contract-status'
import { AgentContractView } from './agent-contract-view'
import { HomeownerContractView } from './homeowner-contract-view'

export interface ContractStatusPanelProps {
  proposalId: string
  token?: string
  isAgent: boolean
  customerAge?: number | null
  /**
   * Agent-picked envelope document selection — the `envelope_document_ids`
   * column (W3; `applyEnvelopeContext` is its single writer).
   * Null = not yet configured (gates the agent draft-config form).
   */
  envelopeDocumentIds?: readonly EnvelopeDocumentId[] | null
  /** Frozen at proposal insert. Drives the agent-side pre-send review. */
  proposalKind?: ProposalKind
  /** Customer name for the agent pre-send review summary. */
  customerName?: string | null
  /** Customer email — used by the agent-side send-proposal flow. */
  customerEmail?: string | null
  proposalStatus?: ProposalStatus
  proposalSentAt?: string | null
}

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
