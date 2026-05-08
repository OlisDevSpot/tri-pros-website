import type { JSX } from 'react'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { useMutation } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { ROOTS } from '@/shared/config/roots'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { PROPOSAL_ACTIONS } from '@/shared/entities/proposals/constants/actions'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { useTRPC } from '@/trpc/helpers'

interface ProposalEntity {
  id: string
  token: string | null
}

function buildShareableUrl(proposalId: string, token: string | null, utmSource: 'email' | 'sms'): string {
  const base = `${ROOTS.public.proposals({ absolute: true })}/proposal/${proposalId}`
  const params = new URLSearchParams()
  if (token) {
    params.set('token', token)
  }
  params.set('utm_source', utmSource)
  return `${base}?${params.toString()}`
}

interface ProposalActionOverrides<T extends ProposalEntity> {
  onView?: (entity: T) => void
  onEdit?: (entity: T) => void
  onAssignOwner?: (entity: T) => void
}

interface ProposalActionConfigsResult<T extends ProposalEntity> {
  actions: EntityActionConfig<T>[]
  DeleteConfirmDialog: () => JSX.Element
}

function defaultView(entity: { id: string }) {
  window.open(`${ROOTS.public.proposals()}/proposal/${entity.id}`, '_blank')
}

function defaultNavigate(entity: { id: string }) {
  window.location.href = ROOTS.dashboard.proposals.byId(entity.id)
}

export function useProposalActionConfigs<T extends ProposalEntity>(
  overrides: ProposalActionOverrides<T> = {},
): ProposalActionConfigsResult<T> {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete proposal',
    message: 'This will permanently delete this proposal. This cannot be undone.',
  })

  const duplicateProposal = useMutation(
    trpc.proposalsRouter.crud.duplicateProposal.mutationOptions({
      onSuccess: () => {
        invalidateProposal()
        toast.success('Proposal duplicated')
      },
      onError: () => toast.error('Failed to duplicate proposal'),
    }),
  )

  const deleteProposal = useMutation(
    trpc.proposalsRouter.crud.deleteProposal.mutationOptions({
      onSuccess: () => {
        invalidateProposal()
        toast.success('Proposal deleted')
      },
      onError: () => toast.error('Failed to delete proposal'),
    }),
  )

  const actions = useMemo((): EntityActionConfig<T>[] => [
    {
      action: PROPOSAL_ACTIONS.view,
      onAction: overrides.onView ?? defaultView,
    },
    {
      action: PROPOSAL_ACTIONS.edit,
      onAction: overrides.onEdit ?? defaultNavigate,
    },
    {
      action: PROPOSAL_ACTIONS.shareByEmail,
      onAction: (entity) => {
        const url = buildShareableUrl(entity.id, entity.token, 'email')
        copyToClipboard(url, 'Proposal link (email)')
      },
    },
    {
      action: PROPOSAL_ACTIONS.shareBySms,
      onAction: (entity) => {
        const url = buildShareableUrl(entity.id, entity.token, 'sms')
        copyToClipboard(url, 'Proposal link (SMS)')
      },
    },
    {
      action: PROPOSAL_ACTIONS.duplicate,
      onAction: entity => duplicateProposal.mutate({ proposalId: entity.id }),
      isLoading: duplicateProposal.isPending,
    },
    {
      action: PROPOSAL_ACTIONS.assignOwner,
      onAction: overrides.onAssignOwner ?? defaultNavigate,
    },
    {
      action: PROPOSAL_ACTIONS.delete,
      onAction: async (entity) => {
        const ok = await confirmDelete()
        if (ok) {
          deleteProposal.mutate({ proposalId: entity.id })
        }
      },
      isLoading: deleteProposal.isPending,
    },
  ], [overrides.onView, overrides.onEdit, overrides.onAssignOwner, duplicateProposal, deleteProposal, confirmDelete])

  return { actions, DeleteConfirmDialog }
}
