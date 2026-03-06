import type { Proposal } from '@/shared/db/schema'

export const PROPOSAL_STATUS_COLORS: Record<Proposal['status'], string> = {
  draft: 'bg-neutral-700 text-neutral-100',
  sent: 'bg-yellow-800 text-yellow-100',
  approved: 'bg-green-800 text-green-100',
  declined: 'bg-red-800 text-red-100',
}
