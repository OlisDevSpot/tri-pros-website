'use client'

import type { ReactNode } from 'react'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { OverrideProposalValues } from '@/features/proposal-flow/types'
import type { Proposal } from '@/shared/db/schema'
import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { useProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import { deepMergeFormDefaults } from '@/features/proposal-flow/lib/deep-merge-form-defaults'
import { baseDefaultValues } from '@/features/proposal-flow/schemas/form-schema'
import { EditProposalBody } from './edit-proposal-body'
import { EditProposalOverview } from './edit-proposal-overview'

interface Props {
  proposalId: string
  status: Proposal['status']
  customer: { id: string, name: string } | null
  meetingId: string | null
  meetingScheduledFor: string | null
  initialValues: OverrideProposalValues | undefined
  isLoading: boolean
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
  viewHref,
  lockNotice,
  onSubmit,
  onSave,
}: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const actions = useProposalFormActions({ onSubmit, onSave })

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
        isLoading={isLoading}
        viewHref={viewHref}
        actions={actions}
      />
      {lockNotice}
      <EditProposalBody proposalId={proposalId} />
    </form>
  )
}
