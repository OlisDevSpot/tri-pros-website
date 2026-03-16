'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { CustomerProfileModal } from '@/features/pipeline/ui/components/customer-profile-modal'
import { proposalTableFilters } from '@/features/proposal-flow/constants/table-filter-config'
import { useProposalActions } from '@/features/proposal-flow/hooks/use-proposal-actions'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { getColumns } from './columns'

type ProposalRow = inferRouterOutputs<AppRouter>['proposalRouter']['getProposals'][number]

const columns = getColumns()
const defaultSort = [{ id: 'createdAt', desc: true }]

interface Props {
  data: ProposalRow[]
  onFilteredCountChange?: (count: number) => void
}

export function PastProposalsTable({ data, onFilteredCountChange }: Props) {
  const { duplicateProposal, updateProposal } = useProposalActions()
  const { open: openModal, setModal } = useModalStore()

  const meta = {
    onDuplicate: (id: string) => duplicateProposal.mutate({ proposalId: id }),
    isDuplicating: duplicateProposal.isPending,
    onUpdateStatus: (id: string, status: string) => updateProposal.mutate({ proposalId: id, data: { status: status as 'draft' | 'sent' | 'approved' | 'declined' } }),
    onUpdateCreatedAt: (id: string, date: Date) => updateProposal.mutate({ proposalId: id, data: { createdAt: date.toISOString() } }),
    onViewProfile: (customerId: string) => {
      setModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId } })
      openModal()
    },
  }

  return (
    <DataTable
      data={data}
      columns={columns}
      meta={meta}
      filterConfig={proposalTableFilters}
      defaultSort={defaultSort}
      entityName="proposal"
      rowDataAttribute="data-proposal-row"
      onFilteredCountChange={onFilteredCountChange}
    />
  )
}
