'use client'

import type { CustomerProfileMeeting } from '@/features/customer-pipelines/types'

import { formatDistanceToNow } from 'date-fns'
import { ExternalLinkIcon, FileTextIcon } from 'lucide-react'

import { MEETING_LIST_STATUS_COLORS } from '@/features/customer-pipelines/constants/meeting-status-colors'
import { EntityViewButton } from '@/shared/components/entity-actions/entity-view-button'
import { EmptyState } from '@/shared/components/states/empty-state'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'

interface Props {
  meetings: CustomerProfileMeeting[]
}

export function CustomerMeetingsList({ meetings }: Props) {
  if (meetings.length === 0) {
    return <EmptyState title="No meetings" description="No meetings scheduled for this customer" />
  }

  return (
    <div className="space-y-3">
      {meetings.map(meeting => (
        <Card key={meeting.id}>
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={MEETING_LIST_STATUS_COLORS[meeting.status] ?? ''}>
                  {meeting.status.replace('_', ' ')}
                </Badge>
                {meeting.program && (
                  <span className="text-sm text-muted-foreground">{meeting.program}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(meeting.createdAt), { addSuffix: true })}
                </span>
                <EntityViewButton
                  icon={ExternalLinkIcon}
                  href={`${ROOTS.dashboard.meetings()}/${meeting.id}`}
                />
              </div>
            </div>

            {meeting.proposals.length > 0 && (
              <div className="pl-3 border-l-2 border-muted space-y-1">
                {meeting.proposals.map(proposal => (
                  <div key={proposal.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <FileTextIcon size={12} className="text-muted-foreground" />
                      <span className="truncate max-w-48">{proposal.label || 'Untitled'}</span>
                      <Badge variant="outline" className="text-[10px]">{proposal.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {proposal.value != null && proposal.value > 0 && (
                        <span className="text-green-600 font-medium text-xs">
                          $
                          {proposal.value.toLocaleString()}
                        </span>
                      )}
                      <EntityViewButton
                        className="h-6 w-6"
                        icon={ExternalLinkIcon}
                        href={`${ROOTS.dashboard.root}?step=edit-proposal&proposalId=${proposal.id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
