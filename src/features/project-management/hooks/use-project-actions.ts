import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { invalidateProject } from '@/shared/dal/client/invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useProjectActions() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const deleteProject = useMutation(trpc.projectsRouter.crud.delete.mutationOptions({
    onSuccess: () => {
      invalidateProject(queryClient)
      toast.success('Project deleted')
    },
    onError: () => toast.error('Failed to delete project'),
  }))

  return { deleteProject }
}
