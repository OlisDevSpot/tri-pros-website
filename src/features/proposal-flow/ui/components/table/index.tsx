'use client'

import type { ProposalRow, ProposalTableMeta } from './columns'
import type { ProposalStatus } from '@/shared/constants/enums'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components'
import { CreateProjectModal } from '@/features/customer-pipelines/ui/components/create-project-modal'
import { proposalTableFilters } from '@/features/proposal-flow/constants/table-filter-config'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { ROOTS } from '@/shared/config/roots'
import { useProposalActionConfigs } from '@/shared/entities/proposals/hooks/use-proposal-action-configs'
import { useProposalActions } from '@/shared/entities/proposals/hooks/use-proposal-actions'
import { useModalStore } from '@/shared/hooks/use-modal-store'

import { getColumns } from './columns'

const columns = getColumns()
const defaultSort = [{ id: 'createdAt', desc: true }]

interface Props {
  data: ProposalRow[]
  onFilteredCountChange?: (count: number) => void
}

interface ProjectPrompt {
  proposalId: string
  customerId: string
  customerName: string
  meetingId: string
}

export function PastProposalsTable({ data, onFilteredCountChange }: Props) {
  const { updateProposal } = useProposalActions()
  const { open: openModal, setModal } = useModalStore()
  const [projectPrompt, setProjectPrompt] = useState<ProjectPrompt | null>(null)

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
      const row = data.find(p => p.id === id)
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
  }, [data, updateProposal])

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

  const meta: ProposalTableMeta = {
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
  }

  return (
    <>
      <DeleteConfirmDialog />
      <DataTable
        tableId="proposals"
        data={data}
        columns={columns}
        meta={meta}
        filterConfig={proposalTableFilters}
        defaultSort={defaultSort}
        entityName="proposal"
        rowDataAttribute="data-proposal-row"
        onFilteredCountChange={onFilteredCountChange}
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
