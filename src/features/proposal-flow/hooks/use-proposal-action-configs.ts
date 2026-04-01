import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { toast } from 'sonner'

import { PROPOSAL_ACTIONS } from '@/shared/components/entity-actions/constants/proposal-actions'
import { ROOTS } from '@/shared/config/roots'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { useTRPC } from '@/trpc/helpers'

interface ProposalEntity {
  id: string
  token: string | null
}

interface ProposalActionHandlers<T extends ProposalEntity> {
  onView: (entity: T) => void
  onEdit: (entity: T) => void
  onAssignOwner?: (entity: T) => void
}

function buildShareableUrl(proposalId: string, token: string | null, utmSource: 'email' | 'sms'): string {
  const base = `${ROOTS.public.proposals({ absolute: true, isProduction: true })}/proposal/${proposalId}`
  const params = new URLSearchParams()
  if (token) {
    params.set('token', token)
  }
  params.set('utm_source', utmSource)
  return `${base}?${params.toString()}`
}

export function useProposalActionConfigs<T extends ProposalEntity>(
  handlers: ProposalActionHandlers<T>,
): EntityActionConfig<T>[] {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries(trpc.proposalsRouter.getProposals.queryFilter())
    void queryClient.invalidateQueries(trpc.customerPipelinesRouter.getCustomerProfile.queryFilter())
  }

  const duplicateProposal = useMutation(
    trpc.proposalsRouter.duplicateProposal.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast.success('Proposal duplicated')
      },
      onError: () => toast.error('Failed to duplicate proposal'),
    }),
  )

  const deleteProposal = useMutation(
    trpc.proposalsRouter.deleteProposal.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast.success('Proposal deleted')
      },
      onError: () => toast.error('Failed to delete proposal'),
    }),
  )

  return useMemo((): EntityActionConfig<T>[] => {
    const configs: EntityActionConfig<T>[] = [
      {
        action: PROPOSAL_ACTIONS.view,
        onAction: handlers.onView,
      },
      {
        action: PROPOSAL_ACTIONS.edit,
        onAction: handlers.onEdit,
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
    ]

    if (handlers.onAssignOwner) {
      configs.push({
        action: PROPOSAL_ACTIONS.assignOwner,
        onAction: handlers.onAssignOwner,
      })
    }

    configs.push({
      action: PROPOSAL_ACTIONS.delete,
      onAction: entity => deleteProposal.mutate({ proposalId: entity.id }),
      isLoading: deleteProposal.isPending,
    })

    return configs
  }, [handlers.onView, handlers.onEdit, handlers.onAssignOwner, duplicateProposal, deleteProposal])
}
