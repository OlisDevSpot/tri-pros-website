import type { ProposalStatus } from '@/shared/constants/enums'
import type { ZohoRequestStatus } from '@/shared/services/providers/zoho-sign/types'
import { toneClasses } from '@/shared/constants/status-tones'

interface StatusBadge {
  label: string
  className: string
}

export function getEnvelopeStatusBadge(requestStatus: ZohoRequestStatus | undefined): StatusBadge | null {
  switch (requestStatus) {
    case 'draft':
      return { label: 'Draft', className: 'border-border bg-muted text-muted-foreground' }
    case 'inprogress':
      return { label: 'Awaiting Signatures', className: toneClasses('pending').fill }
    case 'completed':
      return { label: 'Signed', className: toneClasses('success').fill }
    case 'declined':
      return { label: 'Declined', className: toneClasses('danger').fill }
    case 'recalled':
      return { label: 'Recalled', className: 'border-border bg-muted text-muted-foreground' }
    case 'expired':
      return { label: 'Expired', className: toneClasses('danger').fill }
    default:
      return null
  }
}

export function getProposalStatusBadge(proposalStatus: ProposalStatus | undefined): StatusBadge | null {
  switch (proposalStatus) {
    case 'draft':
      return { label: 'Draft', className: 'border-border bg-muted text-muted-foreground' }
    case 'sent':
      return { label: 'Sent', className: toneClasses('attention').fill }
    case 'approved':
      return { label: 'Approved', className: toneClasses('success').fill }
    case 'declined':
      return { label: 'Declined', className: toneClasses('danger').fill }
    default:
      return null
  }
}

export function isEnvelopeActive(requestStatus: ZohoRequestStatus | undefined): boolean {
  return requestStatus === 'draft' || requestStatus === 'inprogress'
}
