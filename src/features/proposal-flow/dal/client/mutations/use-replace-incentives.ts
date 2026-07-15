import { useMutation } from '@tanstack/react-query'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useReplaceIncentives() {
  const { invalidateProposal } = useInvalidation()

  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.incentives.replace.mutationOptions({
    onSuccess: (_data, variables) => {
      invalidateProposal({ proposalId: variables.proposalId })
    },
  }))
}
