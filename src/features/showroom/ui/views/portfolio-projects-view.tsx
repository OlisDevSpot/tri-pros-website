'use client'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useCallback, useState } from 'react'
import { dashboardStepParser } from '@/features/agent-dashboard/lib'
import { PortfolioProjectsTable } from '@/features/showroom/ui/components/table'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useTRPC } from '@/trpc/helpers'

export function PortfolioProjectsView() {
  const trpc = useTRPC()
  const [, setStep] = useQueryState('step', dashboardStepParser)
  const projects = useQuery(trpc.showroomRouter.getAllProjects.queryOptions())
  const [filteredCount, setFilteredCount] = useState<number | null>(null)
  const handleFilteredCountChange = useCallback((count: number) => setFilteredCount(count), [])

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
          <PortfolioProjectsTable data={projects.data} onFilteredCountChange={handleFilteredCountChange} />
        </CardContent>
      </Card>
    </motion.div>
  )
}
