'use client'

import type { CustomerProfileProject } from '@/features/customer-pipelines/types'

import { formatDistanceToNow } from 'date-fns'
import { FolderOpenIcon, MapPinIcon } from 'lucide-react'

import { MeetingEntityCard } from '@/features/customer-pipelines/ui/components/meeting-entity-card'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'

interface Props {
  project: CustomerProfileProject
  onMutationSuccess: () => void
  onNavigate?: () => void
  onAssignRep?: (meetingId: string, currentRepId: string | null) => void
  highlightMeetingId?: string
}

export function ProjectEntityCard({ project, onMutationSuccess, onNavigate, onAssignRep, highlightMeetingId }: Props) {
  return (
    <Card className="border-l-4 border-l-green-500/60 dark:border-l-green-400/40">
      <CardContent className="p-0">
        {/* Project Header — compact */}
        <div className="flex items-center gap-2 px-3 py-2">
          <FolderOpenIcon className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
          <span className="text-sm font-semibold truncate flex-1">{project.title}</span>
          <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-[10px] text-green-700 dark:border-green-500/20 dark:text-green-300 px-1.5 py-0">
            {project.status}
          </Badge>
          {project.pipelineStage && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {project.pipelineStage.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>

        {/* Project meta */}
        <div className="flex items-center gap-3 px-3 pb-2 text-[10px] text-muted-foreground">
          {project.address && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="size-2.5" />
              {project.address}
            </span>
          )}
          <span>
            {'Created '}
            {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* Meetings within this project — tight spacing */}
        {project.meetings.length > 0 && (
          <div className="border-t px-3 py-2 space-y-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">
              {`Meetings (${project.meetings.length})`}
            </span>
            <div className="space-y-1.5">
              {project.meetings.map(meeting => (
                <MeetingEntityCard
                  key={meeting.id}
                  isHighlighted={meeting.id === highlightMeetingId}
                  meeting={meeting}
                  onAssignRep={onAssignRep}
                  onMutationSuccess={onMutationSuccess}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
