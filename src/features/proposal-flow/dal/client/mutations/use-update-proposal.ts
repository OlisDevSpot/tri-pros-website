import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateProposal } from '@/shared/dal/client/invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useUpdateProposal() {
  const queryClient = useQueryClient()

  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.crud.updateProposal.mutationOptions({
    onSuccess: (data) => {
      invalidateProposal(queryClient, data.id)
    },
  }))
}
