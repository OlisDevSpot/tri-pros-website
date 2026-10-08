'use client'

import type { CustomerProfileProject } from '@/shared/entities/customers/types'

import { formatDistanceToNow } from 'date-fns'
import { FolderOpenIcon, MapPinIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { EntityActionMenu } from '@/shared/components/entities/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { ProjectMeetingList } from '@/shared/entities/meetings/components/project-meeting-list'
import { useProjectActionConfigs } from '@/shared/modules/projects/core/hooks/use-project-action-configs'

interface Props {
  project: CustomerProfileProject
  onMutationSuccess: () => void
  onNavigate?: () => void
  highlightMeetingId?: string
}

export function ProjectEntityCard({ project, onMutationSuccess, onNavigate, highlightMeetingId }: Props) {
  const router = useRouter()
  const handleViewProject = useCallback(() => {
    onNavigate?.()
    router.push(ROOTS.dashboard.projects.byId(project.id))
  }, [project.id, onNavigate, router])

  const { actions: projectActions, DeleteConfirmDialog } = useProjectActionConfigs({
    onEdit: handleViewProject,
  })

  return (
    <>
      <DeleteConfirmDialog />
      <Card className="border-l-4 border-l-status-success-dot/60">
        <CardContent className="p-0">
          {/* Project Header — compact */}
          <div className="flex items-center gap-2 px-3 py-2">
            <FolderOpenIcon className="size-3.5 shrink-0 text-status-success-fg" />
            <span className="text-sm font-semibold truncate flex-1">{project.title}</span>
            <Badge variant="outline" className="border-status-success-dot/40 bg-status-success-bg text-xs text-status-success-fg">
              {project.status}
            </Badge>
            {project.pipelineStage && (
              <Badge variant="secondary" className="text-xs">
                {project.pipelineStage.replace(/_/g, ' ')}
              </Badge>
            )}
            <EntityActionMenu
              entity={project}
              actions={projectActions}
              mode="compact"
              className="opacity-60 hover:opacity-100 transition-opacity"
            />
          </div>

          {/* Project meta */}
          <div className="flex items-center gap-3 px-3 pb-2 text-xs text-muted-foreground">
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

          {/* Meetings within this project */}
          {project.meetings.length > 0 && (
            <div className="border-t px-3 pt-2.5 pb-3 space-y-3">
              <span className="text-xs font-medium text-muted-foreground">
                {`Meetings (${project.meetings.length})`}
              </span>
              <ProjectMeetingList
                meetings={project.meetings}
                onMutationSuccess={onMutationSuccess}
                highlightMeetingId={highlightMeetingId}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
