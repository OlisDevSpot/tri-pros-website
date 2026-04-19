'use client'

import type { CustomerProfileData } from '@/shared/entities/customers/types'

import { EmptyState } from '@/shared/components/states/empty-state'
import { ProjectEntityCard } from './project-entity-card'

interface Props {
  data: CustomerProfileData
  onMutationSuccess: () => void
  highlightMeetingId?: string
}

// Projects tab: shows real Projects only. Each project card already renders
// its own associated meetings. Meetings without a projectId (e.g. fresh
// pipeline meetings) belong on the Meetings tab — not here.
export function CustomerProjectsList({ data, onMutationSuccess, highlightMeetingId }: Props) {
  if (data.projects.length === 0) {
    return <EmptyState description="Projects are created when a meeting is converted" title="No Projects" />
  }

  return (
    <div className="space-y-4">
      {data.projects.map(project => (
        <ProjectEntityCard
          key={project.id}
          customerId={data.customer.id}
          highlightMeetingId={highlightMeetingId}
          onMutationSuccess={onMutationSuccess}
          project={project}
        />
      ))}
    </div>
  )
}
