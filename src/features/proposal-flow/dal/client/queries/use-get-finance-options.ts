import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useGetFinanceOptions() {
  const trpc = useTRPC()
  return useQuery(trpc.proposalsRouter.crud.getFinanceOptions.queryOptions())
}
