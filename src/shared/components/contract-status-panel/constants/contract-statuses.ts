import type { ZohoActionStatus, ZohoRequestStatus } from '@/shared/services/zoho-sign/types'

interface RequestStatusConfig {
  label: string
  color: string
  dotClass: string
}

interface ActionStatusConfig {
  label: string
  icon: string
}

export const REQUEST_STATUS_CONFIG: Record<ZohoRequestStatus, RequestStatusConfig> = {
  draft: { label: 'Draft', color: 'text-muted-foreground', dotClass: 'bg-muted-foreground' },
  inprogress: { label: 'Awaiting Signatures', color: 'text-yellow-600', dotClass: 'bg-yellow-500' },
  completed: { label: 'Signed', color: 'text-green-600', dotClass: 'bg-green-500' },
  declined: { label: 'Declined', color: 'text-red-600', dotClass: 'bg-red-500' },
  recalled: { label: 'Recalled', color: 'text-muted-foreground', dotClass: 'bg-muted-foreground' },
  expired: { label: 'Expired', color: 'text-red-600', dotClass: 'bg-red-500' },
}

export const ACTION_STATUS_CONFIG: Record<ZohoActionStatus, ActionStatusConfig> = {
  NOACTION: { label: 'Waiting', icon: 'minus' },
  UNOPENED: { label: 'Unopened', icon: 'mail' },
  VIEWED: { label: 'Viewed', icon: 'eye' },
  SIGNED: { label: 'Signed', icon: 'check-circle' },
}

export const ACTION_TOOLTIPS = {
  sendForSigning: 'Submits the draft agreement to both parties for signing. This will consume 5 Zoho Sign credits.',
  resend: 'Cancels the current agreement and creates a new one with the latest proposal data. Costs 5 credits.',
  recall: 'Cancels the current agreement. Recipients will no longer be able to view or sign it.',
} as const
