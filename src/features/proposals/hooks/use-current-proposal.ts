import { useParams } from 'next/navigation'
import { useGetProposal } from '@/shared/dal/client/proposals/use-get-proposals'

export function useCurrentProposal() {
  const params = useParams() as { proposalId: string }

  return useGetProposal(params.proposalId)
}