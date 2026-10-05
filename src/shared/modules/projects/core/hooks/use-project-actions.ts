import type { AppRouterOutputs } from '@/trpc/routers/app'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

type ProjectListPage = AppRouterOutputs['projectsRouter']['crud']['list']

export function useProjectActions() {
  const trpc = useTRPC()
  const { invalidateProject } = useInvalidation()
  const qc = useQueryClient()

  const deleteProject = useMutation(trpc.projectsRouter.crud.delete.mutationOptions({
    onSuccess: () => {
      invalidateProject()
      toast.success('Project deleted')
    },
    onError: () => toast.error('Failed to delete project'),
  }))

  // Every cached projects page (records table and dashboard sections) flips the row at once; no spinner, no wait.
  const setPortfolioVisibility = useMutation(trpc.projectsRouter.crud.update.mutationOptions({
    onMutate: async ({ id, data }) => {
      const lists = trpc.projectsRouter.crud.list.queryFilter()
      await qc.cancelQueries(lists)
      const previous = qc.getQueriesData<ProjectListPage>(lists)
      qc.setQueriesData<ProjectListPage>(lists, page => page && {
        ...page,
        rows: page.rows.map(row => (row.id === id ? { ...row, isPublic: data.isPublic ?? row.isPublic } : row)),
      })
      return { previous }
    },
    onError: (err, _variables, context) => {
      for (const [queryKey, page] of context?.previous ?? []) {
        qc.setQueryData(queryKey, page)
      }
      toast.error(err.message || 'Couldn\'t change portfolio visibility')
    },
    onSuccess: (_project, { data }) => toast.success(data.isPublic ? 'Shown on portfolio' : 'Hidden from portfolio'),
    onSettled: () => invalidateProject(),
  }))

  return { deleteProject, setPortfolioVisibility }
}
