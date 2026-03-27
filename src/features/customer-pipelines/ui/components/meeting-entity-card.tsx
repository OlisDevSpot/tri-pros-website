'use client'

import type { CustomerProfileMeeting } from '@/features/customer-pipelines/types'

import { useMutation } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { FileTextIcon } from 'lucide-react'

import { MEETING_LIST_STATUS_COLORS } from '@/features/customer-pipelines/constants/meeting-status-colors'
import { MeetingProposalRow } from '@/features/customer-pipelines/ui/components/meeting-proposal-row'
import { EntityDeleteButton } from '@/shared/components/entity-actions/entity-delete-button'
import { EntityDuplicateButton } from '@/shared/components/entity-actions/entity-duplicate-button'
import { EntityEditButton } from '@/shared/components/entity-actions/entity-edit-button'
import { EntityStartButton } from '@/shared/components/entity-actions/entity-start-button'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { cn } from '@/shared/lib/utils'
import { useAbility } from '@/shared/permissions/hooks'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  meeting: CustomerProfileMeeting
  isHighlighted?: boolean
  onMutationSuccess: () => void
  onNavigate?: () => void
}

export function MeetingEntityCard({ meeting, isHighlighted, onMutationSuccess, onNavigate }: Props) {
  const trpc = useTRPC()
  const ability = useAbility()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete meeting',
    message: 'This will permanently delete this meeting and cannot be undone.',
  })

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
    <Card className={cn(isHighlighted && 'outline-2 outline-primary -outline-offset-2 shadow-sm')}>
      <DeleteConfirmDialog />
      <CardContent className="p-0">
        {/* Meeting Header */}
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Info */}
          <div className="space-y-1.5 min-w-0">
            {/* Badges + Date */}
            <div className="flex flex-wrap items-center gap-2">
              {meeting.meetingType && (
                <Badge variant="secondary" className="text-xs font-medium">
                  {meeting.meetingType}
                </Badge>
              )}
              <Badge variant="outline" className={MEETING_LIST_STATUS_COLORS[meeting.meetingOutcome] ?? ''}>
                {meeting.meetingOutcome.replace(/_/g, ' ')}
              </Badge>
              {meeting.scheduledFor && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(meeting.scheduledFor), 'MMM d, yyyy · h:mm a')}
                </span>
              )}
            </div>

            {/* Created */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                Created
                {' '}
                {formatDistanceToNow(new Date(meeting.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <EntityStartButton
              href={meetingHref}
              showLabel
              label="Open"
              size="sm"
              className="h-7 w-auto gap-1 px-2.5 text-xs"
              onClick={onNavigate}
            />
            <EntityEditButton href={meetingHref} onClick={onNavigate} />
            <EntityDuplicateButton
              onClick={() => duplicateMutation.mutate({ id: meeting.id })}
              disabled={duplicateMutation.isPending}
            />
            {ability.can('delete', 'Meeting') && (
              <EntityDeleteButton
                onClick={async () => {
                  const ok = await confirmDelete()
                  if (ok) {
                    deleteMutation.mutate({ id: meeting.id })
                  }
                }}
                disabled={deleteMutation.isPending}
              />
            )}
          </div>
        </div>

        {/* Proposals Section */}
        {meeting.proposals.length > 0 && (
          <div className="border-t px-4 py-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileTextIcon className="h-3.5 w-3.5" />
              <span>
                Proposals (
                {meeting.proposals.length}
                )
              </span>
            </div>
            <div className="space-y-1.5">
              {meeting.proposals.map(proposal => (
                <MeetingProposalRow
                  key={proposal.id}
                  onNavigate={onNavigate}
                  proposal={proposal}
                  onMutationSuccess={onMutationSuccess}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
