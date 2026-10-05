export type LeadStatus = 'eligible' | 'enrolled' | 'removed' | 'dnc'

export interface LeadStatusMeta {
  label: string
  /** Tailwind class for the status dot (semantic color). */
  dotClass: string
  /** Tailwind class for the badge text/border tint. */
  toneClass: string
}

export const LEAD_STATUS_META: Record<LeadStatus, LeadStatusMeta> = {
  enrolled: { label: 'Enrolled', dotClass: 'bg-status-success-dot', toneClass: 'text-status-success-fg border-status-success-dot/40' },
  eligible: { label: 'Eligible', dotClass: 'bg-muted-foreground', toneClass: 'text-muted-foreground border-border' },
  removed: { label: 'Removed', dotClass: 'bg-status-pending-dot', toneClass: 'text-status-pending-fg border-status-pending-dot/40' },
  dnc: { label: 'DNC', dotClass: 'bg-status-danger-dot', toneClass: 'text-status-danger-fg border-status-danger-dot/40' },
}

export const LEAD_STATUS_OPTIONS: { label: string, value: LeadStatus }[] = [
  { label: 'Eligible', value: 'eligible' },
  { label: 'Enrolled', value: 'enrolled' },
  { label: 'Removed', value: 'removed' },
  { label: 'DNC', value: 'dnc' },
]
