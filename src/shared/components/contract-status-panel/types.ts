import type { EnvelopeDocumentId, ProposalKind, ProposalStatus } from '@/shared/constants/enums'

export interface ContractStatusPanelProps {
  proposalId: string
  token?: string
  isAgent: boolean
  customerAge?: number | null
  /**
   * Agent-picked envelope document selection from `formMetaJSON`.
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
