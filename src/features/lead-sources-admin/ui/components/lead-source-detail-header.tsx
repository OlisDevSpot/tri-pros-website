'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { motion } from 'motion/react'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { EntityActionDropdown } from '@/shared/components/entity-actions/ui/entity-action-dropdown'
import { useLeadSourceActionConfigs } from '@/shared/entities/lead-sources/hooks/use-lead-source-action-configs'
import { cn } from '@/shared/lib/utils'

type LeadSourceRow = AppRouterOutputs['leadSourcesRouter']['getById']

export function LeadSourceDetailHeader({ source }: { source: LeadSourceRow }) {
  const { actions, DeleteConfirmDialog } = useLeadSourceActionConfigs<LeadSourceRow>()
  const entrance = useEntranceMotion()

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <motion.p
            {...entrance(0, 6)}
            className="text-[11px] text-muted-foreground"
          >
            <span className="font-medium uppercase tracking-[0.18em]">Lead source</span>
            <span aria-hidden="true" className="mx-2 opacity-40">·</span>
            <span className="tabular-nums" translate="no">
              /
              {source.slug}
            </span>
          </motion.p>
          <motion.h2
            {...entrance(0.04, 6)}
            className="truncate text-3xl font-semibold tracking-tight text-foreground"
          >
            {source.name}
          </motion.h2>
        </div>
        <motion.div {...entrance(0.08, 6)} className="flex shrink-0 items-center gap-3">
          <StatusIndicator isActive={source.isActive} />
          <EntityActionDropdown entity={source} actions={actions} orientation="horizontal" />
        </motion.div>
      </header>
      <DeleteConfirmDialog />
    </>
  )
}

function StatusIndicator({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40')}
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
