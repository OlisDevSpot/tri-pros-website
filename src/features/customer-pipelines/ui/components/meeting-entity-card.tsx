'use client'

import type { CustomerProfileMeeting } from '@/features/customer-pipelines/types'

import { format, formatDistanceToNow } from 'date-fns'
import { FileTextIcon } from 'lucide-react'
import { useCallback } from 'react'

import { MEETING_LIST_STATUS_COLORS } from '@/features/customer-pipelines/constants/meeting-status-colors'
import { MeetingProposalRow } from '@/features/customer-pipelines/ui/components/meeting-proposal-row'
import { MEETING_OUTCOME_LABELS } from '@/features/meetings/constants/status-colors'
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
    window.location.href = ROOTS.dashboard.meetings.byId(meeting.id)
  }, [meeting.id, onNavigate])

  const handleAssignOwner = useCallback(() => {
    onAssignRep?.(meeting.id, meeting.ownerId ?? null)
  }, [meeting.id, meeting.ownerId, onAssignRep])

  const { actions: meetingActions, DeleteConfirmDialog } = useMeetingActionConfigs<CustomerProfileMeeting>({
    onView: handleView,
    ...(onAssignRep && { onAssignOwner: handleAssignOwner }),
  })

  return (
    <>
      <DeleteConfirmDialog />
      <Card className={cn('group', isHighlighted && 'outline-2 outline-primary -outline-offset-2 shadow-sm')}>
        <CardContent className="p-0">
          {/* Meeting Header — compact */}
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
              {meeting.meetingType && (
                <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0">
                  {meeting.meetingType}
                </Badge>
              )}
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', MEETING_LIST_STATUS_COLORS[meeting.meetingOutcome] ?? '')}>
                {MEETING_OUTCOME_LABELS[meeting.meetingOutcome] ?? meeting.meetingOutcome.replace(/_/g, ' ')}
              </Badge>
              {meeting.scheduledFor && (
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(meeting.scheduledFor), 'MMM d, yyyy · h:mm a')}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/60">
                {formatDistanceToNow(new Date(meeting.createdAt), { addSuffix: true })}
              </span>
            </div>

            {/* Actions — always visible, subtle hover effect */}
            <EntityActionMenu
              entity={meeting}
              actions={meetingActions}
              mode="compact"
              className="opacity-60 hover:opacity-100 transition-opacity"
            />
          </div>

          {/* Proposals Section — compact */}
          {meeting.proposals.length > 0 && (
            <div className="border-t px-3 py-2 space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <FileTextIcon className="size-3" />
                <span>
                  {`Proposals (${meeting.proposals.length})`}
                </span>
              </div>
              <div className="space-y-0.5">
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
    </>
  )
}
