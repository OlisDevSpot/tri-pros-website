'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { ProjectRowActionBar } from '@/features/records-management/ui/components/project-row-panel/project-row-action-bar'
import { ProjectRowDetails } from '@/features/records-management/ui/components/project-row-panel/project-row-details'
import { ProjectSalesHistoryPane } from '@/features/records-management/ui/components/project-row-panel/project-sales-history-pane'
import { ProjectScopesPane } from '@/features/records-management/ui/components/project-row-panel/project-scopes-pane'
import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { useTRPC } from '@/trpc/helpers'

interface ProjectRowPanelProps {
  project: ProjectRow
  actions: EntityActionConfig<ProjectRow>[]
}

export function ProjectRowPanel({ project, actions }: ProjectRowPanelProps) {
  const trpc = useTRPC()
  const sales = useQuery({
    ...trpc.meetingsRouter.reads.listForProject.queryOptions({ projectId: project.id }),
    enabled: project.hasMeetings,
  })

  const meetings = useMemo(() => {
    const linked = sales.data ?? []
    const soldIt = (meeting: (typeof linked)[number]) => meeting.proposals.some(proposal => proposal.status === 'approved')
    // The meeting that sold the project leads.
    return [...linked].sort((a, b) => Number(soldIt(b)) - Number(soldIt(a)))
  }, [sales.data])

  return (
    <ExpandedRowPanel>
      <ExpandedRowPanel.ActionBar>
        <ProjectRowActionBar project={project} actions={actions} />
      </ExpandedRowPanel.ActionBar>
      <ExpandedRowPanel.Details>
        <ProjectRowDetails project={project} />
      </ExpandedRowPanel.Details>
      {sales.isError && (
        <ExpandedRowPanel.Error
          title="Couldn't load this project's sales history"
          description="Trades and scopes still show; retry to load the meetings."
          onRetry={() => void sales.refetch()}
        />
      )}
      {/* Scopes come from the row itself, so a failed read hides only the sales history. */}
      <ExpandedRowPanel.Panes className={sales.isError ? undefined : '@min-[600px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]'}>
        <ProjectScopesPane project={project} />
        {!sales.isError && (
          <ProjectSalesHistoryPane
            meetings={meetings}
            isLoading={sales.isLoading}
            onMutationSuccess={() => void sales.refetch()}
          />
        )}
      </ExpandedRowPanel.Panes>
    </ExpandedRowPanel>
  )
}
