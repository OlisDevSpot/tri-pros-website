'use client'

import type { ProjectRow } from '@/shared/entities/projects/lib/columns-registry'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { BaseSheet } from '@/shared/components/dialogs/sheets/base-sheet'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface ProjectDetailSheetProps {
  project: ProjectRow | null
  isOpen: boolean
  close: () => void
  onDelete?: () => void
}

export function ProjectDetailSheet({ project, isOpen, close, onDelete }: ProjectDetailSheetProps) {
  const router = useRouter()
  const trpc = useTRPC()

  const { data: allTrades = [] } = useQuery({
    ...trpc.notionRouter.trades.getAll.queryOptions(),
    enabled: isOpen && !!project,
  })
  const { data: allScopes = [] } = useQuery({
    ...trpc.notionRouter.scopes.getAll.queryOptions(),
    enabled: isOpen && !!project,
  })

  const tradeNames = useMemo(() => {
    if (!project || project.scopeIds.length === 0 || allScopes.length === 0 || allTrades.length === 0) {
      return [] as string[]
    }
    const scopeToTrade = new Map<string, string>()
    for (const scope of allScopes) {
      scopeToTrade.set(scope.id, scope.relatedTrade)
    }
    const tradeNameMap = new Map<string, string>()
    for (const trade of allTrades) {
      tradeNameMap.set(trade.id, trade.name)
    }
    const tradeIds = new Set<string>()
    for (const scopeId of project.scopeIds) {
      const tradeId = scopeToTrade.get(scopeId)
      if (tradeId) {
        tradeIds.add(tradeId)
      }
    }
    return [...tradeIds].map(id => tradeNameMap.get(id)).filter(Boolean) as string[]
  }, [project, allScopes, allTrades])

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
          {tradeNames.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trades</p>
              <div className="flex flex-wrap gap-1.5">
                {tradeNames.map(name => (
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
                router.push(ROOTS.dashboard.projects.byId(project.id))
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
