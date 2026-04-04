import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateProposal } from '@/shared/dal/client/invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useCreateProposal() {
  const queryClient = useQueryClient()

  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.createProposal.mutationOptions({
    onSuccess: () => {
      invalidateProposal(queryClient)
    },
  }))
}
