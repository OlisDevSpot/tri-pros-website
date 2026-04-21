'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { EntityActionDropdown } from '@/shared/components/entity-actions/ui/entity-action-dropdown'
import { useLeadSourceActionConfigs } from '@/shared/entities/lead-sources/hooks/use-lead-source-action-configs'
import { cn } from '@/shared/lib/utils'

type LeadSourceRow = AppRouterOutputs['leadSourcesRouter']['getById']

export function LeadSourceDetailHeader({ source }: { source: LeadSourceRow }) {
  const { actions, DeleteConfirmDialog } = useLeadSourceActionConfigs<LeadSourceRow>()

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <StatusPill isActive={source.isActive} />
            <h2 className="truncate text-lg font-semibold text-foreground">{source.name}</h2>
          </div>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            /
            {source.slug}
          </p>
        </div>
        <EntityActionDropdown entity={source} actions={actions} orientation="horizontal" />
      </header>
      <DeleteConfirmDialog />
    </>
  )
}

function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums',
        isActive
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border-border/60 bg-muted/40 text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40')}
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
