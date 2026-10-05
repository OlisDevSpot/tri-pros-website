import type { JSX } from 'react'
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ROOTS } from '@/shared/config/roots'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { mainSiteUrl } from '@/shared/lib/main-site-url'
import { PROPOSAL_ACTIONS } from '@/shared/modules/proposals/core/constants/actions'
import { useTRPC } from '@/trpc/helpers'

interface ProposalEntity {
  id: string
  token: string | null
}

function buildShareableUrl(proposalId: string, token: string | null, utmSource: 'email' | 'sms'): string {
  const base = mainSiteUrl(ROOTS.public.proposalReview(proposalId))
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
  window.open(ROOTS.public.proposalReview(entity.id), '_blank')
}

export function useProposalActionConfigs<T extends ProposalEntity>(
  overrides: ProposalActionOverrides<T> = {},
): ProposalActionConfigsResult<T> {
  const trpc = useTRPC()
  const router = useRouter()
  const { invalidateProposal } = useInvalidation()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete proposal',
    message: 'This will permanently delete this proposal. This cannot be undone.',
  })

  const defaultNavigate = (entity: { id: string }) => router.push(ROOTS.dashboard.proposals.byId(entity.id))

  const duplicateProposal = useMutation(
    trpc.proposalsRouter.crud.duplicate.mutationOptions({
      onSuccess: () => {
        invalidateProposal()
        toast.success('Proposal duplicated')
      },
      onError: () => toast.error('Failed to duplicate proposal'),
    }),
  )

  const deleteProposal = useMutation(
    trpc.proposalsRouter.crud.delete.mutationOptions({
      onSuccess: () => {
        invalidateProposal()
        toast.success('Proposal deleted')
      },
      onError: () => toast.error('Failed to delete proposal'),
    }),
  )

  // The configs' callbacks close over this render's mutations; only the loading flag should re-render rows.
  const actions = useStableCallbacks<EntityActionConfig<T>[]>([
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
      onAction: entity => duplicateProposal.mutate({ id: entity.id }),
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
          deleteProposal.mutate({ id: entity.id })
        }
      },
      isLoading: deleteProposal.isPending,
    },
  ])

  return { actions, DeleteConfirmDialog }
}
