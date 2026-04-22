'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { motion } from 'motion/react'
import { useId } from 'react'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { EntityActionDropdown } from '@/shared/components/entity-actions/ui/entity-action-dropdown'
import { Switch } from '@/shared/components/ui/switch'
import { useLeadSourceActionConfigs } from '@/shared/entities/lead-sources/hooks/use-lead-source-action-configs'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'
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
          <ActiveToggle source={source} />
          <EntityActionDropdown entity={source} actions={actions} orientation="horizontal" />
        </motion.div>
      </header>
      <DeleteConfirmDialog />
    </>
  )
}

interface ActiveToggleProps {
  source: Pick<LeadSourceRow, 'id' | 'isActive'>
}

function ActiveToggle({ source }: ActiveToggleProps) {
  const { toggleActive } = useLeadSourceActions()
  const switchId = useId()

  const pendingForThis = toggleActive.isPending && toggleActive.variables?.id === source.id
  const displayActive = pendingForThis
    ? toggleActive.variables?.isActive ?? source.isActive
    : source.isActive

  return (
    <span className="inline-flex items-center gap-2">
      <Switch
        id={switchId}
        checked={displayActive}
        disabled={pendingForThis}
        onCheckedChange={next => toggleActive.mutate({ id: source.id, isActive: next })}
        aria-label={displayActive ? 'Deactivate source' : 'Activate source'}
        className="data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-500"
      />
      <label
        htmlFor={switchId}
        className={cn(
          'cursor-pointer select-none text-xs tabular-nums motion-safe:transition-colors',
          displayActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {displayActive ? 'Active' : 'Inactive'}
      </label>
    </span>
  )
}
