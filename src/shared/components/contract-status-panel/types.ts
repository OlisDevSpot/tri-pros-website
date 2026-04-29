import type { EnvelopeDocumentId } from '@/shared/constants/enums'

export interface ContractStatusPanelProps {
  proposalId: string
  token?: string
  variant: 'full' | 'compact'
  isAgent: boolean
  customerAge?: number | null
  customerId?: string | null
  /**
   * Agent-picked envelope document selection from `formMetaJSON`.
   * Null = not yet configured (gates the agent draft-config form).
   */
  envelopeDocumentIds?: readonly EnvelopeDocumentId[] | null
  onSendProposalEmail?: (message: string) => void
  isSendingEmail?: boolean
  proposalStatus?: string
  proposalSentAt?: string | null
}
