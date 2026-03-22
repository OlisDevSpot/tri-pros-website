import { useParams, useSearchParams } from 'next/navigation'
import { useGetProposal } from '@/features/proposal-flow/dal/client/queries/use-get-proposal'

export function useCurrentProposal() {
  const params = useParams() as { proposalId: string }
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? undefined

  return useGetProposal(params.proposalId, token)
}
