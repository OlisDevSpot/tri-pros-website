import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useGetTrades(query?: string) {
  const trpc = useTRPC()
  return useQuery(trpc.notionRouter.getTradesByQuery.queryOptions({ query }))
}
