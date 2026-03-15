'use client'

import type { CustomerProfileMeeting } from '@/features/pipeline/types'

import { formatDistanceToNow } from 'date-fns'
import { ExternalLinkIcon, FileTextIcon } from 'lucide-react'
import Link from 'next/link'

import { EmptyState } from '@/shared/components/states/empty-state'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'

interface Props {
  meetings: CustomerProfileMeeting[]
}

const STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-yellow-500/10 text-yellow-600',
  converted: 'bg-green-500/10 text-green-600',
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
                <Badge variant="secondary" className={STATUS_COLORS[meeting.status] ?? ''}>
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
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <Link href={`/dashboard/meetings/${meeting.id}`}>
                    <ExternalLinkIcon size={14} />
                  </Link>
                </Button>
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
                      <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                        <Link href={`/dashboard?step=edit-proposal&proposalId=${proposal.id}`}>
                          <ExternalLinkIcon size={12} />
                        </Link>
                      </Button>
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
