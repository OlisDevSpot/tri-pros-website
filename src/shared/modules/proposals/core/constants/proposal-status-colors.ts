import type { Proposal } from '@/shared/db/schema'

export const PROPOSAL_STATUS_COLORS: Record<Proposal['status'], string> = {
  draft: 'bg-slate-500/10 text-slate-600',
  sent: 'bg-orange-500/10 text-orange-600',
  approved: 'bg-green-500/10 text-green-600',
  declined: 'bg-red-500/10 text-red-600',
}

export const PROPOSAL_STATUS_DOT_COLORS: Record<Proposal['status'], string> = {
  draft: 'bg-slate-400',
  sent: 'bg-amber-500',
  approved: 'bg-green-500',
  declined: 'bg-red-500',
}
