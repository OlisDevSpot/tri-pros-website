'use client'

import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { format } from 'date-fns'

import { Badge } from '@/shared/components/ui/badge'
import { deriveProjectStatusBucket } from '@/shared/constants/enums'
import { cn } from '@/shared/lib/utils'
import { ProjectStatusBadge } from '@/shared/modules/projects/core/components/project-status-badge'

export function ProjectRowDetails({ project }: { project: ProjectRow }) {
  const bucket = deriveProjectStatusBucket(project.pipelineStage)
  const location = project.state ? `${project.city}, ${project.state}` : project.city
  return (
    <>
      <Badge className={cn('text-xs', project.isPublic ? 'bg-status-success-bg text-status-success-fg' : 'bg-muted text-muted-foreground')}>
        {project.isPublic ? 'Public' : 'Draft'}
      </Badge>
      <ProjectStatusBadge bucket={bucket} />
      {project.pipelineStage && <span className="capitalize">{project.pipelineStage.replace(/_/g, ' ')}</span>}
      {location && <span>{location}</span>}
      {project.completedAt && <span>{`Completed ${format(new Date(project.completedAt), 'MMM d, yyyy')}`}</span>}
    </>
  )
}
