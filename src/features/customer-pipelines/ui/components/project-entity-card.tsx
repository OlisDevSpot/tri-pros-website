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
        {/* Project Header */}
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <FolderOpenIcon className="size-4 shrink-0 text-green-600 dark:text-green-400" />
              <span className="text-sm font-semibold">{project.title}</span>
              <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-xs text-green-700 dark:border-green-500/20 dark:text-green-300">
                {project.status}
              </Badge>
              {project.pipelineStage && (
                <Badge variant="secondary" className="text-xs">
                  {project.pipelineStage.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {project.address && (
                <span className="flex items-center gap-1">
                  <MapPinIcon className="size-3" />
                  {project.address}
                </span>
              )}
              <span>
                {'Created '}
                {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Meetings within this project */}
        {project.meetings.length > 0 && (
          <div className="space-y-3 border-t px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">
              {`Meetings (${project.meetings.length})`}
            </span>
            <div className="space-y-2">
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
