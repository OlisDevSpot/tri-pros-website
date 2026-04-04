'use client'

import type { CustomerProfileData } from '@/features/customer-pipelines/types'

import { MeetingEntityCard } from '@/features/customer-pipelines/ui/components/meeting-entity-card'
import { ProjectEntityCard } from '@/features/customer-pipelines/ui/components/project-entity-card'
import { EmptyState } from '@/shared/components/states/empty-state'

interface Props {
  data: CustomerProfileData
  onMutationSuccess: () => void
  highlightMeetingId?: string
}

export function CustomerProjectsList({ data, onMutationSuccess, highlightMeetingId }: Props) {
  // Meetings NOT assigned to any project
  const unassignedMeetings = data.meetings.filter(m => !m.projectId)

  if (data.projects.length === 0 && unassignedMeetings.length === 0) {
    return <EmptyState description="Projects are created when a meeting is converted" title="No Projects" />
  }

  return (
    <div className="space-y-4">
      {/* Project cards (each wraps its meetings) */}
      {data.projects.map(project => (
        <ProjectEntityCard
          key={project.id}
          highlightMeetingId={highlightMeetingId}
          onMutationSuccess={onMutationSuccess}
          project={project}
        />
      ))}

      {/* Unassigned meetings (Fresh pipeline meetings with no project) */}
      {unassignedMeetings.length > 0 && (
        <div className="space-y-2">
          {data.projects.length > 0 && (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fresh Meetings
            </span>
          )}
          {unassignedMeetings.map(meeting => (
            <MeetingEntityCard
              key={meeting.id}
              isHighlighted={meeting.id === highlightMeetingId}
              meeting={meeting}
              onMutationSuccess={onMutationSuccess}
            />
          ))}
        </div>
      )}
    </div>
  )
}
