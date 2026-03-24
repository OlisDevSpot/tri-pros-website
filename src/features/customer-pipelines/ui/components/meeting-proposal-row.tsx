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
import { useAbility } from '@/shared/permissions/hooks'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  proposal: CustomerProfileProposal
  onMutationSuccess: () => void
}

export function MeetingProposalRow({ proposal, onMutationSuccess }: Props) {
  const trpc = useTRPC()
  const ability = useAbility()

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
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className={PROPOSAL_STATUS_COLORS[proposal.status] ?? ''}>
          {proposal.status}
        </Badge>
        <span className="truncate max-w-32">{proposal.label || 'Untitled'}</span>
        {proposal.trade && (
          <span className="text-xs text-muted-foreground">{proposal.trade}</span>
        )}
        {proposal.value != null && proposal.value > 0 && (
          <span className="text-green-600 font-medium text-xs">
            $
            {proposal.value.toLocaleString()}
          </span>
        )}
        {proposal.viewCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <EyeIcon className="h-3 w-3" />
            {proposal.viewCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <EntityViewButton
          href={`/proposal-flow?proposalId=${proposal.id}`}
          external
        />
        <EntityEditButton
          href={`/dashboard/proposals/${proposal.id}/edit`}
        />
        <EntityDuplicateButton
          onClick={() => duplicateMutation.mutate({ proposalId: proposal.id })}
          disabled={duplicateMutation.isPending}
        />
        {ability.can('delete', 'Proposal') && (
          <EntityDeleteButton
            onClick={() => deleteMutation.mutate({ proposalId: proposal.id })}
            disabled={deleteMutation.isPending}
          />
        )}
      </div>
    </div>
  )
}
