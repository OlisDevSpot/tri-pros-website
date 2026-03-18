'use client'

import type { ProjectFormData } from '@/shared/entities/projects/schemas'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { dashboardStepParser } from '@/features/agent-dashboard/lib'
import { ProjectForm } from '@/features/showroom/ui/components/form'
import { EntityViewButton } from '@/shared/components/entity-actions/entity-view-button'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'
import { Form } from '@/shared/components/ui/form'
import { ROOTS } from '@/shared/config/roots'
import { projectFormDefaults, projectFormSchema } from '@/shared/entities/projects/schemas'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  projectId: string
}

export function EditProjectView({ projectId }: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [, setStep] = useQueryState('step', dashboardStepParser)

  const project = useQuery(trpc.showroomRouter.getProjectForEdit.queryOptions({ id: projectId }))

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: projectFormDefaults,
  })

  const updateProject = useMutation(trpc.showroomRouter.updateProject.mutationOptions())

  const initialValues = useMemo(() => {
    if (!project.data) {
      return undefined
    }

    const { project: p, scopeIds } = project.data

    return {
      title: p.title,
      accessor: p.accessor,
      description: p.description ?? null,
      backstory: p.backstory ?? null,
      isPublic: p.isPublic ?? false,
      address: p.address ?? null,
      city: p.city,
      state: p.state ?? 'CA',
      zip: p.zip ?? null,
      hoRequirements: p.hoRequirements ?? null,
      homeownerName: p.homeownerName ?? null,
      homeownerQuote: p.homeownerQuote ?? null,
      projectDuration: p.projectDuration ?? null,
      completedAt: p.completedAt ?? null,
      challengeDescription: p.challengeDescription ?? null,
      solutionDescription: p.solutionDescription ?? null,
      resultDescription: p.resultDescription ?? null,
      beforeDescription: p.beforeDescription ?? null,
      duringDescription: p.duringDescription ?? null,
      afterDescription: p.afterDescription ?? null,
      mainDescription: p.mainDescription ?? null,
      scopeIds,
    } satisfies ProjectFormData
  }, [project.data])

  if (project.isLoading) {
    return (
      <LoadingState
        title="Loading Project"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!project.data) {
    return (
      <ErrorState
        title="Error: Could not load project"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  function onSubmit(data: ProjectFormData) {
    updateProject.mutate({ id: projectId, data }, {
      onSuccess: () => {
        toast.success('Project updated')
        queryClient.invalidateQueries(trpc.showroomRouter.getProjectForEdit.queryOptions({ id: projectId }))
        queryClient.invalidateQueries(trpc.showroomRouter.getAllProjects.queryOptions())
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  function handleMediaUpdate() {
    queryClient.invalidateQueries(trpc.showroomRouter.getProjectForEdit.queryOptions({ id: projectId }))
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep('showroom')}
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Portfolio
        </Button>
        <EntityViewButton
          href={`${ROOTS.landing.portfolioProjects()}/${project.data.project.accessor}`}
          external
          showLabel
          size="sm"
          className="h-auto w-auto px-2"
        />
      </div>

      <div className="min-h-0 w-full grow pr-4 lg:flex lg:flex-col lg:overflow-hidden overflow-auto">
        <Form {...form}>
          <ProjectForm
            isLoading={project.isLoading || updateProject.isPending}
            initialValues={initialValues}
            onSubmit={onSubmit}
            projectId={projectId}
            mediaFiles={project.data.media}
            onMediaUpdate={handleMediaUpdate}
          />
        </Form>
      </div>
    </motion.div>
  )
}
