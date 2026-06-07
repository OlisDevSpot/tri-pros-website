export type LeadStatus = 'eligible' | 'enrolled' | 'removed' | 'dnc'

export interface LeadStatusMeta {
  label: string
  /** Tailwind class for the status dot (semantic color). */
  dotClass: string
  /** Tailwind class for the badge text/border tint. */
  toneClass: string
}

export const LEAD_STATUS_META: Record<LeadStatus, LeadStatusMeta> = {
  enrolled: { label: 'Enrolled', dotClass: 'bg-green-500', toneClass: 'text-green-700 dark:text-green-400 border-green-500/30' },
  eligible: { label: 'Eligible', dotClass: 'bg-muted-foreground', toneClass: 'text-muted-foreground border-border' },
  removed: { label: 'Removed', dotClass: 'bg-amber-500', toneClass: 'text-amber-700 dark:text-amber-400 border-amber-500/30' },
  dnc: { label: 'DNC', dotClass: 'bg-red-500', toneClass: 'text-red-700 dark:text-red-400 border-red-500/30' },
}

export const LEAD_STATUS_OPTIONS: { label: string, value: LeadStatus }[] = [
  { label: 'Eligible', value: 'eligible' },
  { label: 'Enrolled', value: 'enrolled' },
  { label: 'Removed', value: 'removed' },
  { label: 'DNC', value: 'dnc' },
]
