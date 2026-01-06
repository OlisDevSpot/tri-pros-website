import { useMutation } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useSendProposalEmail() {
  const trpc = useTRPC()
  return useMutation(trpc.proposalRouter.sendProposalEmail.mutationOptions())
}
