'use client'

import type { ProjectRow } from '@/shared/entities/projects/lib/columns-registry'

import { FolderOpenIcon, MapPinIcon } from 'lucide-react'

import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { useProjectActionConfigs } from '@/shared/entities/projects/hooks/use-project-action-configs'
import { cn } from '@/shared/lib/utils'

interface DashboardProjectCardProps {
  row: ProjectRow
  className?: string
}

/**
 * Dense project row for the dashboard's Open projects roster. `ProjectRow`
 * (the `projects.crud.list` row) is a flat `Project` + `scopeIds` — it has no
 * nested `meetings`/`proposals`, so this can't compose the full
 * `ProjectEntityCard` (which requires `CustomerProfileProject`, the richer
 * shape the customer-profile DAL assembles with a per-project meetings join).
 * Fetching that per dashboard row would mean N+1 joins for data this roster
 * doesn't show. Instead this mirrors `ProjectEntityCard`'s own status/
 * pipelineStage badge treatment (border-l accent + green status badge +
 * secondary pipelineStage badge — the only "color mapping" this entity
 * actually has; there's no separate stage-color-map module for projects) and
 * reuses the same `useProjectActionConfigs` + `EntityActionMenu` action
 * plumbing every other project surface (table, `ProjectEntityCard`) uses, so
 * actions can't drift between surfaces. Matches `DashboardMeetingCard`/
 * `DashboardProposalCard`'s row treatment (`rounded-lg border bg-card p-2.5`)
 * so the dashboard's list modules read as one visual family.
 */
export function DashboardProjectCard({ row, className }: DashboardProjectCardProps) {
  const { actions: projectActions, DeleteConfirmDialog } = useProjectActionConfigs<ProjectRow>()

  return (
    <>
      <DeleteConfirmDialog />
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5',
          className,
        )}
      >
        <FolderOpenIcon className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{row.title}</span>
          {row.address && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon className="size-3 shrink-0" />
              <span className="truncate">{row.address}</span>
            </span>
          )}
        </div>
        <Badge
          variant="outline"
          className="shrink-0 border-green-500/30 bg-green-500/10 text-xs text-green-700 dark:border-green-500/20 dark:text-green-300"
        >
          {row.status}
        </Badge>
        {row.pipelineStage && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            {row.pipelineStage.replace(/_/g, ' ')}
          </Badge>
        )}
        <EntityActionMenu entity={row} actions={projectActions} mode="compact" className="shrink-0 opacity-60 transition-opacity hover:opacity-100" />
      </div>
    </>
  )
}
