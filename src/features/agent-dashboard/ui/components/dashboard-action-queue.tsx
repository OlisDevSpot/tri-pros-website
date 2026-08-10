'use client'

import type { ActionItem } from '@/features/agent-dashboard/dal/server/get-action-queue'

import { useQuery } from '@tanstack/react-query'
import { CheckCircleIcon } from 'lucide-react'
import { useState } from 'react'

import { actionTierConfig } from '@/features/agent-dashboard/constants/action-tiers'
import { DASHBOARD_LIMITS } from '@/features/agent-dashboard/constants/dashboard-queries'
import { capGroupedTierItems } from '@/features/agent-dashboard/lib/cap-grouped-tier-items'
import { groupByTier } from '@/features/agent-dashboard/lib/group-items-by-tier'
import { ActionCard } from '@/features/agent-dashboard/ui/components/action-card'
import { ActionCenterSheet } from '@/features/agent-dashboard/ui/components/action-center-sheet'
import { ActionDetailSheet } from '@/features/agent-dashboard/ui/components/action-detail-sheet'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

/**
 * Action queue module — urgent triage only (see
 * docs/superpowers/specs/2026-08-06-adaptive-agent-dashboard-design.md#3).
 * Reuses the exact grouping + card rendering the Action Center sheet already
 * uses (`groupByTier` + `ActionCard`), just capped to a top-N slice across
 * tiers (`DASHBOARD_LIMITS.actionQueue`) with a "See all →" that opens the
 * same `ActionCenterSheet` the sidebar/mobile-nav use — there's no dedicated
 * route for the Action Center, only the sheet.
 */
export function DashboardActionQueue() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.dashboardRouter.getActionQueue.queryOptions())
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null)
  const [isActionCenterOpen, setIsActionCenterOpen] = useState(false)

  const items = data ?? []
  const grouped = groupByTier(items)
  const capped = capGroupedTierItems(grouped, DASHBOARD_LIMITS.actionQueue)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-sans text-lg font-semibold text-foreground">Needs attention</h2>
        <button
          type="button"
          onClick={() => setIsActionCenterOpen(true)}
          className="-mr-2 -my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
        >
          See all →
        </button>
      </div>

      {isLoading
        ? <ActionQueueSkeleton />
        : items.length === 0
          ? <ActionQueueEmptyState />
          : (
              <div className="flex flex-col gap-4">
                {capped.map(([tier, tierItems]) => {
                  const config = actionTierConfig[tier]
                  return (
                    <div key={tier} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 px-1">
                        <config.icon size={14} className="text-muted-foreground" />
                        <h3 className="text-xs font-medium text-muted-foreground">{config.label}</h3>
                        <span className="text-xs text-muted-foreground/70">
                          (
                          {tierItems.length}
                          )
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {tierItems.map(item => (
                          <ActionCard key={item.id} item={item} onSelect={setSelectedItem} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

      <ActionDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
      <ActionCenterSheet isOpen={isActionCenterOpen} onClose={() => setIsActionCenterOpen(false)} />
    </div>
  )
}

/** 3 card-shaped rows, matching `ActionCard`'s resting height. */
function ActionQueueSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map(i => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}

/** Positive empty state — matches `ActionCenterView`'s own "all caught up" treatment. */
function ActionQueueEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <CheckCircleIcon size={32} className="text-green-500" />
      <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
      <p className="text-xs text-muted-foreground">No urgent follow-ups right now</p>
    </div>
  )
}
