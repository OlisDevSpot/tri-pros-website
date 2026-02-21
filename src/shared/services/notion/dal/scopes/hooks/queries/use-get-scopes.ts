import type { QueryNotionScopesOptions } from '@/shared/services/notion/types'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useGetScopes(opts: QueryNotionScopesOptions) {
  const trpc = useTRPC()
  return useQuery(trpc.notionRouter.scopes.getScopesByQuery.queryOptions({ ...opts }))
}
