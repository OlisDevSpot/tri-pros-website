'use client'

import type { ReactNode } from 'react'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { OverrideProposalValues } from '@/features/proposal-flow/types'
import type { Proposal } from '@/shared/db/schema'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { EDIT_LOADING_FORM_CLASS } from '@/features/proposal-flow/constants/edit-loading'
import { EditLoadingProvider } from '@/features/proposal-flow/contexts/edit-loading-context'
import { useProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import { canReadLeadSource } from '@/features/proposal-flow/lib/can-read-lead-source'
import { deepMergeFormDefaults } from '@/features/proposal-flow/lib/deep-merge-form-defaults'
import { baseDefaultValues } from '@/features/proposal-flow/schemas/form-schema'
import { useAbility } from '@/shared/domains/permissions/client'
import { useIdleReady } from '@/shared/hooks/use-idle-ready'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'
import { EditProposalBody } from './edit-proposal-body'
import { EditProposalOverview } from './edit-proposal-overview'
import { PhoneSummaryRow } from './phone-summary-row'

interface Props {
  proposalId: string
  status: Proposal['status'] | null
  customer: { id: string, name: string } | null
  meetingId?: string | null
  meetingScheduledFor?: string | null
  initialValues: OverrideProposalValues | undefined
  // The proposal read is in flight: the shell draws with bars in place of every value.
  loading: boolean
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
  meetingId = null,
  meetingScheduledFor = null,
  initialValues,
  loading,
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
  const ability = useAbility()
  const withLeadSource = canReadLeadSource(ability)
  const customerId = customer?.id

  // The reads behind the pill's panel, fetched once the page settles so the panel opens on its data and never grows under the rep.
  useEffect(() => {
    if (isIdle && customerId) {
      queryClient.fetchQuery(trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }))
        .then((profile) => {
          const leadSourceId = profile.customer.leadSourceId
          if (withLeadSource && leadSourceId) {
            void queryClient.prefetchQuery(trpc.leadSourcesRouter.getById.queryOptions({ id: leadSourceId }))
          }
        })
        // A failed profile read is the panel's to show, with its own retry; this only warms the cache.
        .catch(() => {})
    }
    if (isIdle && meetingId) {
      void queryClient.prefetchQuery(trpc.meetingsRouter.participants.getParticipants.queryOptions({ meetingId }))
    }
  }, [isIdle, customerId, meetingId, withLeadSource, queryClient, trpc])

  // The bars stay up until the loaded values are in the form, so no default figure paints for a frame.
  const [resetApplied, setResetApplied] = useState(false)
  useEffect(() => {
    if (initialValues) {
      form.reset(deepMergeFormDefaults(baseDefaultValues, initialValues))
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- marks the reset this same effect ran
      setResetApplied(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues])
  const pending = loading || !resetApplied
  const actionsBlocked = pending || isLoading || locked

  return (
    <EditLoadingProvider loading={pending}>
      <form
        id="proposal-form"
        data-loading={pending || undefined}
        onSubmit={(event) => {
          // React bubbles a submit from a portaled form (a dialog the pill's panel opened) up to here; only the proposal form's own submit saves.
          if (event.target !== event.currentTarget) {
            return
          }
          event.preventDefault()
          actions.saveAndPreview()
        }}
        className={cn('flex h-full min-h-0 flex-col gap-(--gutter)', pending && EDIT_LOADING_FORM_CLASS)}
      >
        <EditProposalOverview
          proposalId={proposalId}
          status={status}
          customer={customer}
          meetingId={meetingId}
          meetingScheduledFor={meetingScheduledFor}
          isLoading={actionsBlocked}
          viewHref={viewHref}
          actions={actions}
        />
        {lockNotice}
        <EditProposalBody proposalId={proposalId} />
        <PhoneSummaryRow proposalId={proposalId} status={status} isLoading={actionsBlocked} viewHref={viewHref} actions={actions} />
      </form>
    </EditLoadingProvider>
  )
}
