'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { useRouter } from 'next/navigation'
import { BaseSheet } from '@/shared/components/dialogs/sheets/base-sheet'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { cn } from '@/shared/lib/utils'

type ProjectRow = inferRouterOutputs<AppRouter>['showroomRouter']['getAllProjects'][number] & {
  tradeNames: string[]
}

interface ProjectDetailSheetProps {
  project: ProjectRow | null
  isOpen: boolean
  close: () => void
  onDelete?: () => void
}

export function ProjectDetailSheet({ project, isOpen, close, onDelete }: ProjectDetailSheetProps) {
  const router = useRouter()

  const location = project
    ? (project.state ? `${project.city}, ${project.state}` : project.city)
    : null

  return (
    <BaseSheet
      isOpen={isOpen}
      close={close}
      title={project?.title ?? ''}
      description={location ?? undefined}
    >
      {project && (
        <div className="flex flex-col gap-6 pt-2">
          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
            <Badge
              className={cn(
                'w-fit text-xs',
                project.isPublic
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {project.isPublic ? 'Public' : 'Draft'}
            </Badge>
          </div>

          {/* Completion date */}
          {project.completedAt && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</p>
              <p className="text-sm">
                {new Date(project.completedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}

          {/* Trade names */}
          {project.tradeNames.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trades</p>
              <div className="flex flex-wrap gap-1.5">
                {project.tradeNames.map(name => (
                  <Badge key={name} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t">
            <Button
              className="w-full"
              onClick={() => {
                close()
                router.push(`${ROOTS.dashboard.root}?step=edit-project&editProjectId=${project.id}`)
              }}
            >
              Edit Project
            </Button>
            {project.isPublic && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.open(`${ROOTS.landing.portfolioProjects()}/${project.accessor}`, '_blank')
                }}
              >
                View on Site
              </Button>
            )}
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                // eslint-disable-next-line no-alert
                if (window.confirm('Are you sure you want to delete this project?')) {
                  close()
                  onDelete?.()
                }
              }}
            >
              Delete Project
            </Button>
          </div>
        </div>
      )}
    </BaseSheet>
  )
}
