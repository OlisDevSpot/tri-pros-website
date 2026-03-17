import { useParams } from 'next/navigation'
import { useGetProposal } from '@/features/proposal-flow/dal/client/queries/use-get-proposal'

export function useCurrentProposal() {
  const params = useParams() as { proposalId: string }

  return useGetProposal(params.proposalId)
}
