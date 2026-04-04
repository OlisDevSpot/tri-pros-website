'use client'

import type { ProposalRow, ProposalTableMeta } from './columns'
import type { ProposalStatus } from '@/shared/types/enums'

import { useCallback, useState } from 'react'

import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components'
import { CreateProjectModal } from '@/features/customer-pipelines/ui/components/create-project-modal'
import { proposalTableFilters } from '@/features/proposal-flow/constants/table-filter-config'
import { useProposalActionConfigs } from '@/features/proposal-flow/hooks/use-proposal-action-configs'
import { useProposalActions } from '@/features/proposal-flow/hooks/use-proposal-actions'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { ROOTS } from '@/shared/config/roots'
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
    // "Approved" requires project creation first — don't update status yet
    if (status === 'approved') {
      const row = data.find(p => p.id === id)
      if (row?.meetingId && row.customerId) {
        setProjectPrompt({
          proposalId: id,
          customerId: row.customerId,
          customerName: row.customerName ?? 'Customer',
          meetingId: row.meetingId,
        })
      }
      return
    }

    updateProposal.mutate({ proposalId: id, data: { status } })
  }, [data, updateProposal])

  const handleProjectCreated = useCallback((selectedProposalId: string) => {
    // Update the proposal the user selected (may differ from the one that triggered the modal)
    updateProposal.mutate({ proposalId: selectedProposalId, data: { status: 'approved' as ProposalStatus } })
    setProjectPrompt(null)
  }, [updateProposal])

  const meta: ProposalTableMeta = {
    proposalActions: () => sharedActions,
    onUpdateStatus: handleStatusChange,
    onUpdateCreatedAt: (id: string, date: Date) => updateProposal.mutate({ proposalId: id, data: { createdAt: date.toISOString() } }),
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
