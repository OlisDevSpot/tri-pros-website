'use client'

import type { CustomerProfileProposal } from '@/features/customer-pipelines/types'

import { useMutation } from '@tanstack/react-query'
import { EyeIcon } from 'lucide-react'

import { PROPOSAL_STATUS_COLORS } from '@/features/customer-pipelines/constants/proposal-status-colors'
import { EntityDeleteButton } from '@/shared/components/entity-actions/entity-delete-button'
import { EntityDuplicateButton } from '@/shared/components/entity-actions/entity-duplicate-button'
import { EntityEditButton } from '@/shared/components/entity-actions/entity-edit-button'
import { EntityViewButton } from '@/shared/components/entity-actions/entity-view-button'
import { Badge } from '@/shared/components/ui/badge'
import { ROOTS } from '@/shared/config/roots'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useAbility } from '@/shared/permissions/hooks'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  proposal: CustomerProfileProposal
  onMutationSuccess: () => void
  onNavigate?: () => void
}

export function MeetingProposalRow({ proposal, onMutationSuccess, onNavigate }: Props) {
  const trpc = useTRPC()
  const ability = useAbility()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete proposal',
    message: 'This will permanently delete this proposal and cannot be undone.',
  })

  const duplicateMutation = useMutation(
    trpc.proposalsRouter.duplicateProposal.mutationOptions({
      onSuccess: () => {
        onMutationSuccess()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.proposalsRouter.deleteProposal.mutationOptions({
      onSuccess: () => {
        onMutationSuccess()
      },
    }),
  )

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border/50 bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <DeleteConfirmDialog />
      {/* Info */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Badge variant="outline" className={PROPOSAL_STATUS_COLORS[proposal.status] ?? ''}>
          {proposal.status}
        </Badge>
        <span className="truncate max-w-48 text-sm font-medium">{proposal.label || 'Untitled'}</span>
        {proposal.trade && (
          <span className="text-xs text-muted-foreground">{proposal.trade}</span>
        )}
      </div>

      {/* Stats + Actions */}
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {/* Stats */}
        <div className="flex items-center gap-2.5">
          {proposal.value != null && proposal.value > 0 && (
            <span className="text-sm font-semibold text-green-600">
              $
              {proposal.value.toLocaleString()}
            </span>
          )}
          {proposal.viewCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <EyeIcon className="h-3 w-3" />
              {proposal.viewCount}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <EntityViewButton
            href={`${ROOTS.public.proposals()}/proposal/${proposal.id}`}
            external
          />
          <EntityEditButton
            href={`${ROOTS.dashboard.root}?step=edit-proposal&proposalId=${proposal.id}`}
            onClick={onNavigate}
          />
          <EntityDuplicateButton
            onClick={() => duplicateMutation.mutate({ proposalId: proposal.id })}
            disabled={duplicateMutation.isPending}
          />
          {ability.can('delete', 'Proposal') && (
            <EntityDeleteButton
              onClick={async () => {
                const ok = await confirmDelete()
                if (ok) {
                  deleteMutation.mutate({ proposalId: proposal.id })
                }
              }}
              disabled={deleteMutation.isPending}
            />
          )}
        </div>
      </div>
    </div>
  )
}
