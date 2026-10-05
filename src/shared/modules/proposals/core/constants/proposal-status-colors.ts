import type { StatusTone } from '@/shared/constants/status-tones'
import type { Proposal } from '@/shared/db/schema'

import { TONE_CLASSES } from '@/shared/constants/status-tones'

const PROPOSAL_STATUS_TONE: Record<Proposal['status'], StatusTone> = {
  draft: 'idle',
  sent: 'attention',
  approved: 'success',
  declined: 'danger',
}

export const PROPOSAL_STATUS_COLORS = Object.fromEntries(
  Object.entries(PROPOSAL_STATUS_TONE).map(([status, tone]) => [status, TONE_CLASSES[tone].fill]),
) as Record<Proposal['status'], string>

export const PROPOSAL_STATUS_DOT_COLORS = Object.fromEntries(
  Object.entries(PROPOSAL_STATUS_TONE).map(([status, tone]) => [status, TONE_CLASSES[tone].dot]),
) as Record<Proposal['status'], string>
