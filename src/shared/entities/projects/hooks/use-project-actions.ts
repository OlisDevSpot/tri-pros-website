import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useProjectActions() {
  const trpc = useTRPC()
  const { invalidateProject } = useInvalidation()

  const deleteProject = useMutation(trpc.projectsRouter.crud.delete.mutationOptions({
    onSuccess: () => {
      invalidateProject()
      toast.success('Project deleted')
    },
    onError: () => toast.error('Failed to delete project'),
  }))

  return { deleteProject }
}
