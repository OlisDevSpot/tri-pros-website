import { useSearchParams } from 'next/navigation'
import { useGetProposal } from '@/shared/data-client/proposals/use-get-proposals'

export function useCurrentProposal() {
  const proposalId = useSearchParams().get('proposalId')!

  return useGetProposal(proposalId)
}
