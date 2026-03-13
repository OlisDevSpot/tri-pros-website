import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/trpc/helpers'

export function useProposalActions() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries(trpc.proposalRouter.getProposals.queryOptions())

  const deleteProposal = useMutation(trpc.proposalRouter.deleteProposal.mutationOptions({
    onSuccess: invalidate,
    onError: () => toast.error('Failed to delete proposal'),
  }))

  const duplicateProposal = useMutation(trpc.proposalRouter.duplicateProposal.mutationOptions({
    onSuccess: () => {
      invalidate()
      toast.success('Proposal duplicated')
    },
    onError: () => toast.error('Failed to duplicate proposal'),
  }))

  const updateProposal = useMutation(trpc.proposalRouter.updateProposal.mutationOptions({
    onSuccess: () => {
      invalidate()
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  }))

  return { deleteProposal, duplicateProposal, updateProposal }
}
