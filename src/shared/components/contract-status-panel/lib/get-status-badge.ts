import type { ZohoRequestStatus } from '@/shared/services/providers/zoho-sign/types'

interface StatusBadge {
  label: string
  className: string
}

export function getEnvelopeStatusBadge(requestStatus: string | undefined): StatusBadge | null {
  switch (requestStatus) {
    case 'draft':
      return { label: 'Draft', className: 'bg-muted text-muted-foreground' }
    case 'inprogress':
      return { label: 'Awaiting Signatures', className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' }
    case 'completed':
      return { label: 'Signed', className: 'bg-green-500/10 text-green-700 dark:text-green-400' }
    case 'declined':
      return { label: 'Declined', className: 'bg-red-500/10 text-red-700 dark:text-red-400' }
    case 'recalled':
      return { label: 'Recalled', className: 'bg-muted text-muted-foreground' }
    case 'expired':
      return { label: 'Expired', className: 'bg-red-500/10 text-red-700 dark:text-red-400' }
    default:
      return null
  }
}

export function getProposalStatusBadge(proposalStatus: string | undefined): StatusBadge | null {
  switch (proposalStatus) {
    case 'draft':
      return { label: 'Draft', className: 'bg-muted text-muted-foreground' }
    case 'sent':
      return { label: 'Sent', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' }
    case 'approved':
      return { label: 'Approved', className: 'bg-green-500/10 text-green-700 dark:text-green-400' }
    case 'declined':
      return { label: 'Declined', className: 'bg-red-500/10 text-red-700 dark:text-red-400' }
    default:
      return null
  }
}

export function isEnvelopeActive(requestStatus: string | undefined, isDraftSyncing: boolean): boolean {
  if (isDraftSyncing) {
    return true
  }
  return requestStatus === 'draft' || requestStatus === 'inprogress'
}

export type { ZohoRequestStatus }
