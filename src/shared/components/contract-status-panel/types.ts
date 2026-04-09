export interface ContractStatusPanelProps {
  proposalId: string
  token?: string
  variant: 'full' | 'compact'
  isAgent: boolean
  onSendProposalEmail?: (message: string) => void
  isSendingEmail?: boolean
  proposalStatus?: string
  proposalSentAt?: string | null
}
