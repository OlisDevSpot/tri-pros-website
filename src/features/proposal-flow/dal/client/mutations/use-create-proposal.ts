import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useCreateProposal() {
  const queryClient = useQueryClient()

  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.createProposal.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.proposalsRouter.getProposals.queryOptions())
    },
  }))
}
