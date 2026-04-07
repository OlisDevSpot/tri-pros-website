'use client'

import type { ProjectFormData } from '@/shared/entities/projects/schemas'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeftIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ProjectForm } from '@/features/project-management/ui/components/form'
import { Button } from '@/shared/components/ui/button'
import { Form } from '@/shared/components/ui/form'
import { ROOTS } from '@/shared/config/roots'
import { projectFormDefaults, projectFormSchema } from '@/shared/entities/projects/schemas'
import { useTRPC } from '@/trpc/helpers'

export function CreateProjectView() {
  const trpc = useTRPC()
  const router = useRouter()

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: projectFormDefaults,
  })

  const createProject = useMutation(trpc.projectsRouter.crud.create.mutationOptions())

  function onSubmit(data: ProjectFormData) {
    createProject.mutate(data, {
      onSuccess: () => {
        toast.success('Project created')
        router.push(ROOTS.dashboard.projects.root())
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4"
    >
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => router.push(ROOTS.dashboard.projects.root())}
      >
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Portfolio
      </Button>

      <div className="h-full w-full overflow-auto pr-4">
        <Form {...form}>
          <ProjectForm
            isLoading={createProject.isPending}
            onSubmit={onSubmit}
          />
        </Form>
      </div>
    </motion.div>
  )
}
