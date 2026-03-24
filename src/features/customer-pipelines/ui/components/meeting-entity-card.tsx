'use client'

import type { CustomerProfileMeeting } from '@/features/customer-pipelines/types'

import { useMutation } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'

import { MEETING_LIST_STATUS_COLORS } from '@/features/customer-pipelines/constants/meeting-status-colors'
import { MeetingProposalRow } from '@/features/customer-pipelines/ui/components/meeting-proposal-row'
import { EntityDeleteButton } from '@/shared/components/entity-actions/entity-delete-button'
import { EntityDuplicateButton } from '@/shared/components/entity-actions/entity-duplicate-button'
import { EntityEditButton } from '@/shared/components/entity-actions/entity-edit-button'
import { EntityStartButton } from '@/shared/components/entity-actions/entity-start-button'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/permissions/hooks'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  meeting: CustomerProfileMeeting
  onMutationSuccess: () => void
}

export function MeetingEntityCard({ meeting, onMutationSuccess }: Props) {
  const trpc = useTRPC()
  const ability = useAbility()

  const meetingHref = `${ROOTS.dashboard.meetings()}/${meeting.id}`

  const duplicateMutation = useMutation(
    trpc.meetingsRouter.duplicate.mutationOptions({
      onSuccess: () => {
        onMutationSuccess()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.meetingsRouter.delete.mutationOptions({
      onSuccess: () => {
        onMutationSuccess()
      },
    }),
  )

  return (
    <Card>
      <CardContent className="py-3 px-4 space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {meeting.type && (
              <Badge variant="secondary" className="text-xs">
                {meeting.type}
              </Badge>
            )}
            {meeting.scheduledFor && (
              <span className="text-sm text-muted-foreground">
                {format(new Date(meeting.scheduledFor), 'MMM d, yyyy h:mm a')}
              </span>
            )}
            <Badge variant="outline" className={MEETING_LIST_STATUS_COLORS[meeting.status] ?? ''}>
              {meeting.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <EntityStartButton
              onClick={() => { window.location.href = meetingHref }}
            />
            <EntityEditButton href={meetingHref} />
            <EntityDuplicateButton
              onClick={() => duplicateMutation.mutate({ id: meeting.id })}
              disabled={duplicateMutation.isPending}
            />
            {ability.can('delete', 'Meeting') && (
              <EntityDeleteButton
                onClick={() => deleteMutation.mutate({ id: meeting.id })}
                disabled={deleteMutation.isPending}
              />
            )}
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {meeting.program && (
            <span>{meeting.program}</span>
          )}
          <span>
            Created
            {' '}
            {formatDistanceToNow(new Date(meeting.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* Nested proposals */}
        {meeting.proposals.length > 0 && (
          <div className="pl-3 border-l-2 border-muted space-y-0.5 mt-1">
            {meeting.proposals.map(proposal => (
              <MeetingProposalRow
                key={proposal.id}
                proposal={proposal}
                onMutationSuccess={onMutationSuccess}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
