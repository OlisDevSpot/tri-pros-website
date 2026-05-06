'use client'

import type { ProposalRow, ProposalTableMeta } from './columns'
import type { ProposalStatus } from '@/shared/constants/enums'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components'
import { CreateProjectModal } from '@/features/customer-pipelines/ui/components/create-project-modal'
import { PROPOSAL_FILTER_CONFIG, PROPOSAL_PAGE_SIZE_OPTIONS } from '@/features/proposal-flow/constants/proposal-table-filter-config'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { ROOTS } from '@/shared/config/roots'
import { usePaginatedQuery } from '@/shared/dal/client/query/use-paginated-query'
import { useProposalActionConfigs } from '@/shared/entities/proposals/hooks/use-proposal-action-configs'
import { useProposalActions } from '@/shared/entities/proposals/hooks/use-proposal-actions'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

import { getColumns } from './columns'

const columns = getColumns()

interface ProjectPrompt {
  proposalId: string
  customerId: string
  customerName: string
  meetingId: string
}

export function PastProposalsTable() {
  const trpc = useTRPC()
  const { updateProposal } = useProposalActions()
  const { open: openModal, setModal } = useModalStore()
  const [projectPrompt, setProjectPrompt] = useState<ProjectPrompt | null>(null)

  const pagination = usePaginatedQuery<Record<string, never>, ProposalRow>(
    trpc.proposalsRouter.crud.list.queryOptions,
    {},
    {
      paramPrefix: 'pp',
      pageSize: 20,
      pageSizeOptions: PROPOSAL_PAGE_SIZE_OPTIONS,
      filters: PROPOSAL_FILTER_CONFIG,
    },
  )

  const handleView = useCallback((entity: ProposalRow) => {
    window.open(`${ROOTS.public.proposals()}/proposal/${entity.id}`, '_blank')
  }, [])

  const handleEdit = useCallback((entity: ProposalRow) => {
    window.location.href = ROOTS.dashboard.proposals.byId(entity.id)
  }, [])

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

      // If the meeting already has a project, just approve — no new project needed
      if (row.meetingProjectId) {
        updateProposal.mutate(
          { proposalId: id, data: { status: 'approved' as ProposalStatus, approvedAt: new Date().toISOString() } },
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
      { proposalId: id, data: { status } },
      { onSuccess: () => toast.success('Status updated') },
    )
  }, [pagination.rows, updateProposal])

  const handleProjectCreated = useCallback((selectedProposalId: string, projectId?: string) => {
    updateProposal.mutate({
      proposalId: selectedProposalId,
      data: { status: 'approved' as ProposalStatus, approvedAt: new Date().toISOString() },
    })
    setProjectPrompt(null)

    if (projectId) {
      toast.success('Project created', {
        description: 'Proposal approved and project is ready.',
        action: {
          label: 'View Project',
          onClick: () => {
            window.location.href = ROOTS.dashboard.projects.byId(projectId)
          },
        },
      })
    }
  }, [updateProposal])

  const meta: ProposalTableMeta = useMemo(() => ({
    proposalActions: () => sharedActions,
    onUpdateStatus: handleStatusChange,
    onUpdateCreatedAt: (id: string, date: Date) => updateProposal.mutate(
      { proposalId: id, data: { createdAt: date.toISOString() } },
      { onSuccess: () => toast.success('Created date updated') },
    ),
    onViewProfile: (customerId: string) => {
      setModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId } })
      openModal()
    },
  }), [sharedActions, handleStatusChange, updateProposal, setModal, openModal])

  return (
    <>
      <DeleteConfirmDialog />

      <RecordsPageShell
        header={<RecordsPageHeader title="Proposals" pagination={pagination} />}
        toolbar={(
          <QueryToolbar pagination={pagination} entityName="proposals">
            <QueryToolbar.Bar>
              <QueryToolbar.Search placeholder="Search by label or customer…" />
              <QueryToolbar.FilterTrigger />
              <QueryToolbar.PageSize />
            </QueryToolbar.Bar>
            <QueryToolbar.ChipRail />
            <QueryToolbar.LiveStatus />
          </QueryToolbar>
        )}
        table={(
          <DataTable
            tableId="proposals"
            data={pagination.rows}
            columns={columns}
            meta={meta}
            entityName="proposal"
            rowDataAttribute="data-proposal-row"
            serverPagination={toDataTablePagination(pagination)}
            serverSorting={toDataTableSorting(pagination, { fallbackVisual: { id: 'createdAt', desc: true } })}
          />
        )}
      />

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
    </>
  )
}
