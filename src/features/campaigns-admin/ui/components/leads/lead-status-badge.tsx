'use client'

import type { LeadStatus } from '@/features/campaigns-admin/constants/lead-status'

import { LEAD_STATUS_META } from '@/features/campaigns-admin/constants/lead-status'

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const meta = LEAD_STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.toneClass}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${meta.dotClass}`} />
      {meta.label}
    </span>
  )
}
