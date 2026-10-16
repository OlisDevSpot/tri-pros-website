'use client'

import type { ProposalStatus } from '@/shared/constants/enums'

import type { ProposalRow, ProposalTableMeta } from '@/shared/modules/proposals/core/lib/columns-registry'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { toast } from 'sonner'
import { CreateProjectModal } from '@/features/customer-pipelines/ui/components/create-project-modal'
import { PROPOSALS_TABLE_QUERY_CONFIG } from '@/features/proposal-flow/constants/proposals-table-query-config'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { useColumnVisibility } from '@/shared/components/data-table/lib/use-column-visibility'
import { useEntityColumns } from '@/shared/components/data-table/lib/use-entity-columns'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { DataView } from '@/shared/components/data-view/core/data-view'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { ROOTS } from '@/shared/config/roots'
import { usePaginatedQuery } from '@/shared/dal/client/hooks/use-paginated-query'
import { fromPaginatedQuery } from '@/shared/dal/client/lib/from-paginated-query'
import { openCustomerProfile } from '@/shared/modules/customers/core/lib/open-customer-profile'

import { useProposalActionConfigs } from '@/shared/modules/proposals/core/hooks/use-proposal-action-configs'
import { useProposalActions } from '@/shared/modules/proposals/core/hooks/use-proposal-actions'
import { PROPOSAL_COLUMNS } from '@/shared/modules/proposals/core/lib/columns-registry'
import { useTRPC } from '@/trpc/helpers'

const SHOW_COLUMNS = ['label', 'price', 'status', 'createdAt', 'sentAt', 'viewCount'] as const

interface ProjectPrompt {
  proposalId: string
  customerId: string
  customerName: string
  meetingId: string
}

export function PastProposalsTable() {
  const trpc = useTRPC()
  const router = useRouter()
  const { updateProposal } = useProposalActions()
  const [projectPrompt, setProjectPrompt] = useState<ProjectPrompt | null>(null)

  const pagination = usePaginatedQuery<Record<string, never>, ProposalRow>(
    trpc.proposalsRouter.business.list.queryOptions,
    {},
    PROPOSALS_TABLE_QUERY_CONFIG,
  )
  const query = fromPaginatedQuery(pagination)

  const handleView = useCallback((entity: ProposalRow) => {
    window.open(ROOTS.public.proposalReview(entity.id), '_blank')
  }, [])

  const handleEdit = useCallback((entity: ProposalRow) => {
    router.push(ROOTS.dashboard.proposals.byId(entity.id))
  }, [router])

  const { actions: sharedActions, DeleteConfirmDialog } = useProposalActionConfigs<ProposalRow>({
    onView: handleView,
    onEdit: handleEdit,
  })

  const handleStatusChange = useCallback((id: string, status: ProposalStatus) => {
    if (status === 'approved') {
      const row = pagination.rows.find(p => p.id === id)
      if (!row?.meetingId || !row.customerId) {
        return
      }

      // Skip the create-project modal when a project already exists on the
      // meeting. This intentionally checks `meetingProjectId` (current
      // meeting state) rather than `proposal.kind` (frozen at insert): an
      // initial-sale proposal that was previously approved, then later
      // unapproved/re-approved, still has its project — opening the modal
      // again would attempt a duplicate. Kind alone can't distinguish
      // first-approval-of-initial-sale from re-approval-of-initial-sale.
      if (row.meetingProjectId) {
        updateProposal.mutate(
          { id, data: { status: 'approved' as ProposalStatus, approvedAt: new Date().toISOString() } },
          { onSuccess: () => toast.success('Proposal approved') },
        )
        return
      }

      // No project yet — open the create project modal
      setProjectPrompt({
        proposalId: id,
        customerId: row.customerId,
        customerName: row.customerName ?? 'Customer',
        meetingId: row.meetingId,
      })
      return
    }

    updateProposal.mutate(
      { id, data: { status } },
      { onSuccess: () => toast.success('Status updated') },
    )
  }, [pagination.rows, updateProposal])

  const handleProjectCreated = useCallback((selectedProposalId: string, projectId?: string) => {
    updateProposal.mutate({
      id: selectedProposalId,
      data: { status: 'approved' as ProposalStatus, approvedAt: new Date().toISOString() },
    })
    setProjectPrompt(null)

    if (projectId) {
      toast.success('Project created', {
        description: 'Proposal approved and project is ready.',
        action: {
          label: 'View Project',
          onClick: () => {
            router.push(ROOTS.dashboard.projects.byId(projectId))
          },
        },
      })
    }
  }, [router, updateProposal])

  const columns = useEntityColumns(PROPOSAL_COLUMNS, { show: SHOW_COLUMNS })
  const visibility = useColumnVisibility('proposals', columns)

  const meta = useMemo<ProposalTableMeta>(() => ({
    rowActions: sharedActions,
    onUpdateStatus: handleStatusChange,
    onUpdateCreatedAt: (id, date) => updateProposal.mutate(
      { id, data: { createdAt: date.toISOString() } },
      { onSuccess: () => toast.success('Created date updated') },
    ),
    onViewProfile: (customerId) => {
      openCustomerProfile({ customerId })
    },
  }), [sharedActions, handleStatusChange, updateProposal])

  return (
    <DataView query={query} entityName="proposals">
      <DeleteConfirmDialog />
      <div className="flex h-full min-h-0 flex-col gap-(--gutter)">
        <DataView.Bar>
          {/* The row is always one button tall, so it sits at the same height as the pages with actions. */}
          <header className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <DataView.Title className="text-lg font-semibold tracking-tight">Proposals</DataView.Title>
              <DataView.Count className="text-xs text-muted-foreground tabular-nums" />
            </div>
          </header>
          <DataView.Toolbar>
            <QueryToolbar.Standard searchPlaceholder="Search by label or customer…" visibility={visibility} />
          </DataView.Toolbar>
        </DataView.Bar>
        <DataView.Body empty>
          <DataTable
            tableId="proposals"
            data={pagination.rows}
            columns={columns}
            meta={meta}
            entityName="proposal"
            rowDataAttribute="data-proposal-row"
            skeletonRowClassName="h-[58.5px]"
            serverPagination={toDataTablePagination(query)}
            serverSorting={toDataTableSorting(query)}
            columnVisibility={visibility.columnVisibility}
          />
        </DataView.Body>
      </div>

      {projectPrompt && (
        <CreateProjectModal
          isOpen
          customerId={projectPrompt.customerId}
          customerName={projectPrompt.customerName}
          proposalId={projectPrompt.proposalId}
          meetingId={projectPrompt.meetingId}
          onSuccess={handleProjectCreated}
          onClose={() => setProjectPrompt(null)}
        />
      )}
    </DataView>
  )
}
