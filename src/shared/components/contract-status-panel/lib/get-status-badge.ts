import type { ProposalStatus } from '@/shared/constants/enums'
import type { ZohoRequestStatus } from '@/shared/services/providers/zoho-sign/types'

interface StatusBadge {
  label: string
  className: string
}

export function getEnvelopeStatusBadge(requestStatus: ZohoRequestStatus | undefined): StatusBadge | null {
  switch (requestStatus) {
    case 'draft':
      return { label: 'Draft', className: 'bg-muted text-muted-foreground' }
    case 'inprogress':
      return { label: 'Awaiting Signatures', className: 'bg-status-pending-bg text-status-pending-fg' }
    case 'completed':
      return { label: 'Signed', className: 'bg-status-success-bg text-status-success-fg' }
    case 'declined':
      return { label: 'Declined', className: 'bg-status-danger-bg text-status-danger-fg' }
    case 'recalled':
      return { label: 'Recalled', className: 'bg-muted text-muted-foreground' }
    case 'expired':
      return { label: 'Expired', className: 'bg-status-danger-bg text-status-danger-fg' }
    default:
      return null
  }
}

export function getProposalStatusBadge(proposalStatus: ProposalStatus | undefined): StatusBadge | null {
  switch (proposalStatus) {
    case 'draft':
      return { label: 'Draft', className: 'bg-muted text-muted-foreground' }
    case 'sent':
      return { label: 'Sent', className: 'bg-status-attention-bg text-status-attention-fg' }
    case 'approved':
      return { label: 'Approved', className: 'bg-status-success-bg text-status-success-fg' }
    case 'declined':
      return { label: 'Declined', className: 'bg-status-danger-bg text-status-danger-fg' }
    default:
      return null
  }
}

export function isEnvelopeActive(requestStatus: ZohoRequestStatus | undefined): boolean {
  return requestStatus === 'draft' || requestStatus === 'inprogress'
}
