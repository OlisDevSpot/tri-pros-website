'use client'

import type { CustomerProfileMeeting } from '@/features/customer-pipelines/types'

import { format, formatDistanceToNow } from 'date-fns'
import { FileTextIcon } from 'lucide-react'
import { useCallback } from 'react'

import { MEETING_LIST_STATUS_COLORS } from '@/features/customer-pipelines/constants/meeting-status-colors'
import { MeetingProposalRow } from '@/features/customer-pipelines/ui/components/meeting-proposal-row'
import { useMeetingActionConfigs } from '@/features/meetings/hooks/use-meeting-action-configs'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { cn } from '@/shared/lib/utils'

interface Props {
  meeting: CustomerProfileMeeting
  isHighlighted?: boolean
  onMutationSuccess: () => void
  onNavigate?: () => void
  onAssignRep?: (meetingId: string, currentRepId: string | null) => void
}

export function MeetingEntityCard({ meeting, isHighlighted, onMutationSuccess, onNavigate, onAssignRep }: Props) {
  const handleView = useCallback(() => {
    onNavigate?.()
    window.location.href = `${ROOTS.dashboard.meetings()}/${meeting.id}`
  }, [meeting.id, onNavigate])

  const handleEdit = useCallback(() => {
    onNavigate?.()
    window.location.href = `${ROOTS.dashboard.meetings()}/${meeting.id}`
  }, [meeting.id, onNavigate])

  const handleAssignOwner = useCallback(() => {
    onAssignRep?.(meeting.id, meeting.ownerId ?? null)
  }, [meeting.id, meeting.ownerId, onAssignRep])

  const meetingActions = useMeetingActionConfigs<CustomerProfileMeeting>({
    onView: handleView,
    onEdit: handleEdit,
    ...(onAssignRep && { onAssignOwner: handleAssignOwner }),
  })

  return (
    <Card className={cn('group', isHighlighted && 'outline-2 outline-primary -outline-offset-2 shadow-sm')}>
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
          <EntityActionMenu
            entity={meeting}
            actions={meetingActions}
            mode="bar"
          />
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
