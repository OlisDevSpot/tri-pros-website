'use client'

import type { ProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import type { Proposal } from '@/shared/db/schema'
import { useEditLoading } from '@/features/proposal-flow/contexts/edit-loading-context'
import { ProposalContextPillPlaceholder } from './proposal-context-pill-placeholder'
import { ProposalContextTrigger } from './proposal-context-trigger'
import { ProposalNameInput } from './proposal-name-input'
import { ProposalToolbar } from './proposal-toolbar'

interface Props {
  proposalId: string
  status: Proposal['status'] | null
  customer: { id: string, name: string } | null
  meetingId?: string | null
  meetingScheduledFor?: string | null
  isLoading: boolean
  viewHref: string
  actions: ProposalFormActions
}

export function EditProposalOverview({ proposalId, status, customer, meetingId = null, meetingScheduledFor = null, isLoading, viewHref, actions }: Props) {
  const loading = useEditLoading()

  return (
    <div className="surface grid shrink-0 grid-cols-1 gap-2 rounded-xl border px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="min-w-0 md:col-start-1 md:row-start-1">
        <ProposalNameInput status={status} />
      </div>
      {(loading || customer) && (
        <div className="flex min-w-0 md:col-span-2 md:row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-self-center">
          {loading || !customer
            ? <ProposalContextPillPlaceholder />
            : <ProposalContextTrigger proposalId={proposalId} customer={customer} meetingId={meetingId} meetingScheduledFor={meetingScheduledFor} />}
        </div>
      )}
      <div className="hidden md:col-start-2 md:row-start-1 md:flex md:justify-self-end lg:col-start-3">
        <ProposalToolbar isLoading={isLoading} viewHref={viewHref} actions={actions} />
      </div>
    </div>
  )
}
