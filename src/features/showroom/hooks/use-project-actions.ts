import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/trpc/helpers'

export function useProjectActions() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries(trpc.projectsRouter.getAllPortfolioProjects.queryOptions())

  const deleteProject = useMutation(trpc.projectsRouter.deleteProject.mutationOptions({
    onSuccess: () => {
      invalidate()
      toast.success('Project deleted')
    },
    onError: () => toast.error('Failed to delete project'),
  }))

  return { deleteProject }
}
