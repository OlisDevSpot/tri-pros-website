'use client'

import type { ReactNode } from 'react'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { OverrideProposalValues } from '@/features/proposal-flow/types'
import type { Proposal } from '@/shared/db/schema'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { useProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import { deepMergeFormDefaults } from '@/features/proposal-flow/lib/deep-merge-form-defaults'
import { baseDefaultValues } from '@/features/proposal-flow/schemas/form-schema'
import { useIdleReady } from '@/shared/hooks/use-idle-ready'
import { useTRPC } from '@/trpc/helpers'
import { EditProposalBody } from './edit-proposal-body'
import { EditProposalOverview } from './edit-proposal-overview'
import { PhoneSummaryRow } from './phone-summary-row'

interface Props {
  proposalId: string
  status: Proposal['status']
  customer: { id: string, name: string } | null
  meetingId: string | null
  meetingScheduledFor: string | null
  initialValues: OverrideProposalValues | undefined
  isLoading: boolean
  locked: boolean
  viewHref: string
  lockNotice: ReactNode
  onSubmit: (data: ProposalFormSchema) => void
  onSave: (data: ProposalFormSchema) => void
}

export function EditProposalShell({
  proposalId,
  status,
  customer,
  meetingId,
  meetingScheduledFor,
  initialValues,
  isLoading,
  locked,
  viewHref,
  lockNotice,
  onSubmit,
  onSave,
}: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const actions = useProposalFormActions({ onSubmit, onSave })
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const isIdle = useIdleReady()
  const customerId = customer?.id

  // The reads behind the pill's panel, fetched once the page settles so the panel opens on its data and never grows under the rep.
  useEffect(() => {
    if (isIdle && customerId) {
      void queryClient.prefetchQuery(trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }))
    }
    if (isIdle && meetingId) {
      void queryClient.prefetchQuery(trpc.meetingsRouter.participants.getParticipants.queryOptions({ meetingId }))
    }
  }, [isIdle, customerId, meetingId, queryClient, trpc])

  useEffect(() => {
    if (initialValues) {
      form.reset(deepMergeFormDefaults(baseDefaultValues, initialValues))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues])

  return (
    <form
      id="proposal-form"
      onSubmit={(event) => {
        event.preventDefault()
        actions.saveAndPreview()
      }}
      className="flex h-full min-h-0 flex-col gap-(--gutter)"
    >
      <EditProposalOverview
        status={status}
        customer={customer}
        meetingId={meetingId}
        meetingScheduledFor={meetingScheduledFor}
        isLoading={isLoading || locked}
        viewHref={viewHref}
        actions={actions}
      />
      {lockNotice}
      <EditProposalBody proposalId={proposalId} />
      <PhoneSummaryRow proposalId={proposalId} status={status} isLoading={isLoading || locked} viewHref={viewHref} actions={actions} />
    </form>
  )
}
