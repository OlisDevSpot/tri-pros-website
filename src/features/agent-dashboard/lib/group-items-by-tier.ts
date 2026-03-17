import type { ActionTier } from '@/features/agent-dashboard/constants/action-tiers'
import type { ActionItem } from '@/features/agent-dashboard/dal/server/get-action-queue'
import { actionTiers } from '@/features/agent-dashboard/constants/action-tiers'

export function groupByTier(items: ActionItem[]): Map<ActionTier, ActionItem[]> {
  const groups = new Map<ActionTier, ActionItem[]>()

  for (const tier of actionTiers) {
    const tierItems = items.filter(item => item.tier === tier)
    if (tierItems.length > 0) {
      groups.set(tier, tierItems)
    }
  }

  return groups
}
