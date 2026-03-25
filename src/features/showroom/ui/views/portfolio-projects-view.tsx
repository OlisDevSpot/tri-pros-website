'use client'

import type { ProjectRow } from '@/features/showroom/ui/components/table/columns'
import type { DataTableMultiSelectFilter } from '@/shared/components/data-table/types'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useCallback, useMemo, useState } from 'react'
import { dashboardStepParser } from '@/features/agent-dashboard/lib'
import { useProjectActions } from '@/features/showroom/hooks/use-project-actions'
import { ProjectDetailSheet } from '@/features/showroom/ui/components/project-detail-sheet'
import { PortfolioProjectsTable } from '@/features/showroom/ui/components/table'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useTRPC } from '@/trpc/helpers'

export function PortfolioProjectsView() {
  const trpc = useTRPC()
  const [, setStep] = useQueryState('step', dashboardStepParser)
  const projects = useQuery(trpc.showroomRouter.getAllProjects.queryOptions())
  const { data: allTrades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())
  const { data: allScopes = [] } = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const [filteredCount, setFilteredCount] = useState<number | null>(null)
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const { deleteProject } = useProjectActions()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete project',
    message: 'This will permanently delete this project and all its media. This cannot be undone.',
  })
  const handleFilteredCountChange = useCallback((count: number) => setFilteredCount(count), [])
  const handleRowClick = useCallback((project: ProjectRow) => {
    setSelectedProject(project)
    setIsSheetOpen(true)
  }, [])

  // Map scope IDs -> trade IDs, and build trade name lookup
  const { enrichedProjects, tradeFilter } = useMemo(() => {
    if (!projects.data) {
      return { enrichedProjects: [], tradeFilter: undefined }
    }

    const scopeToTrade = new Map<string, string>()
    for (const scope of allScopes) {
      scopeToTrade.set(scope.id, scope.relatedTrade)
    }

    const tradeNameMap = new Map<string, string>()
    for (const trade of allTrades) {
      tradeNameMap.set(trade.id, trade.name)
    }

    const usedTradeIds = new Set<string>()
    const enriched = projects.data.map((project) => {
      const tradeIds = new Set<string>()
      for (const scopeId of project.scopeIds) {
        const tradeId = scopeToTrade.get(scopeId)
        if (tradeId) {
          tradeIds.add(tradeId)
          usedTradeIds.add(tradeId)
        }
      }
      const tradeNames = [...tradeIds]
        .map(id => tradeNameMap.get(id))
        .filter(Boolean) as string[]
      return { ...project, tradeNames }
    })

    const filter: DataTableMultiSelectFilter = {
      id: 'trades',
      label: 'Trades',
      type: 'multi-select',
      placeholder: 'All trades',
      columnId: 'tradeNames',
      options: allTrades
        .filter(t => usedTradeIds.has(t.id))
        .map(t => ({ label: t.name, value: t.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    }

    return { enrichedProjects: enriched, tradeFilter: filter }
  }, [projects.data, allScopes, allTrades])

  if (projects.isLoading) {
    return (
      <LoadingState
        title="Loading Portfolio Projects"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!projects.data) {
    return (
      <ErrorState
        title="Error: Could not load portfolio projects"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  if (projects.data.length === 0) {
    return (
      <ErrorState
        title="No Projects Found"
        description="Create your first portfolio project"
        className="bg-card"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4"
    >
      <Card className="h-full w-full flex flex-col lg:p-6 border-0 lg:border bg-transparent lg:bg-card">
        <CardHeader className="shrink-0 px-0 flex-row items-center justify-between">
          <div>
            <CardTitle>Portfolio Projects</CardTitle>
            <CardDescription>
              {filteredCount !== null && filteredCount !== projects.data.length
                ? `${filteredCount} of ${projects.data.length} project${projects.data.length !== 1 ? 's' : ''}`
                : `${projects.data.length} total project${projects.data.length !== 1 ? 's' : ''}`}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setStep('create-project')}>
            <PlusIcon className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </CardHeader>
        <CardContent className="grow min-h-0 overflow-auto px-0">
          <PortfolioProjectsTable
            data={enrichedProjects}
            tradeFilter={tradeFilter}
            onFilteredCountChange={handleFilteredCountChange}
            onRowClick={handleRowClick}
          />
        </CardContent>
      </Card>
      <DeleteConfirmDialog />
      <ProjectDetailSheet
        project={selectedProject}
        isOpen={isSheetOpen}
        close={() => setIsSheetOpen(false)}
        onDelete={selectedProject
          ? async () => {
            const ok = await confirmDelete()
            if (ok) {
              deleteProject.mutate({ id: selectedProject.id })
            }
          }
          : undefined}
      />
    </motion.div>
  )
}
