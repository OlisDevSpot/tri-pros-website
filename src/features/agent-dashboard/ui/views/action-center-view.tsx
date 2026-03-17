'use client'

import type { ActionItem } from '@/features/agent-dashboard/dal/server/get-action-queue'

import { useQuery } from '@tanstack/react-query'
import { CheckCircleIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

import { actionTierConfig } from '@/features/agent-dashboard/constants/action-tiers'
import { groupByTier } from '@/features/agent-dashboard/lib/group-items-by-tier'
import { ActionCard } from '@/features/agent-dashboard/ui/components/action-card'
import { ActionDetailSheet } from '@/features/agent-dashboard/ui/components/action-detail-sheet'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useTRPC } from '@/trpc/helpers'

export function ActionCenterView() {
  const trpc = useTRPC()
  const actionQueue = useQuery(trpc.dashboardRouter.getActionQueue.queryOptions())
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null)

  if (actionQueue.isLoading) {
    return (
      <LoadingState
        title="Loading Action Queue"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!actionQueue.data) {
    return (
      <ErrorState
        title="Error: Could not load action queue"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  if (actionQueue.data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ delay: 0.25, duration: 0.25 }}
        className="w-full h-full flex items-center justify-center"
      >
        <EmptyState
          title="All caught up!"
          description="No actions needed right now"
          className="bg-card"
        >
          <CheckCircleIcon size={48} className="text-green-500 mb-2" />
        </EmptyState>
      </motion.div>
    )
  }

  const grouped = groupByTier(actionQueue.data)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-6 overflow-y-auto"
    >
      {Array.from(grouped.entries()).map(([tier, items]) => {
        const config = actionTierConfig[tier]
        return (
          <div key={tier} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <config.icon size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">
                {config.label}
              </h3>
              <span className="text-xs text-muted-foreground/70">
                (
                {items.length}
                )
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map(item => (
                <ActionCard
                  key={item.id}
                  item={item}
                  onSelect={setSelectedItem}
                />
              ))}
            </div>
          </div>
        )
      })}

      <ActionDetailSheet
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </motion.div>
  )
}
