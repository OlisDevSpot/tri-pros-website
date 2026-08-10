import type { ActionTier } from '@/features/agent-dashboard/constants/action-tiers'
import type { ActionItem } from '@/features/agent-dashboard/dal/server/get-action-queue'

/**
 * Caps a tier-grouped `Map` (see `group-items-by-tier.ts`) to a total item
 * count across all tiers, preserving tier order and truncating the last
 * tier's items to land exactly on the cap. Used by dashboard modules that
 * render a top-N slice of the action queue (the full queue lives in the
 * Action Center).
 */
export function capGroupedTierItems(
  grouped: Map<ActionTier, ActionItem[]>,
  cap: number,
): Array<[ActionTier, ActionItem[]]> {
  const result: Array<[ActionTier, ActionItem[]]> = []
  let remaining = cap

  for (const [tier, items] of grouped) {
    if (remaining <= 0) {
      break
    }
    result.push([tier, items.slice(0, remaining)])
    remaining -= Math.min(items.length, remaining)
  }

  return result
}
