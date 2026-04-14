export interface ContractStatusPanelProps {
  proposalId: string
  token?: string
  variant: 'full' | 'compact'
  isAgent: boolean
  customerAge?: number | null
  customerId?: string | null
  onSendProposalEmail?: (message: string) => void
  isSendingEmail?: boolean
  proposalStatus?: string
  proposalSentAt?: string | null
}
