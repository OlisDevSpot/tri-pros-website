import type { AlertCircleIcon } from 'lucide-react'

import { ClockIcon, FileXIcon, FlameIcon, SnowflakeIcon, TrendingUpIcon } from 'lucide-react'

export const actionTiers = ['HOT_NOW', 'HOT_LEAD', 'FOLLOW_UP_DUE', 'STALE', 'NO_PROPOSAL'] as const

export type ActionTier = (typeof actionTiers)[number]

interface TierConfig {
  label: string
  color: string
  icon: typeof AlertCircleIcon
}

export const actionTierConfig: Record<ActionTier, TierConfig> = {
  HOT_NOW: { label: 'Hot Now', color: 'red', icon: FlameIcon },
  HOT_LEAD: { label: 'Hot Lead', color: 'orange', icon: TrendingUpIcon },
  FOLLOW_UP_DUE: { label: 'Follow Up Due', color: 'yellow', icon: ClockIcon },
  STALE: { label: 'Stale', color: 'blue', icon: SnowflakeIcon },
  NO_PROPOSAL: { label: 'No Proposal', color: 'muted', icon: FileXIcon },
}
