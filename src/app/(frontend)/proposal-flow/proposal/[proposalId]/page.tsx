import type { SearchParams } from 'nuqs/server'
import { loadProposalSearchParams } from '@/features/proposal-flow/lib/search-params'
import { Proposal } from '@/features/proposal-flow/ui/components/proposal'

interface PageProps {
  searchParams: Promise<SearchParams>
}

export default async function ProposalPage({ searchParams }: PageProps) {
  // Seed nuqs with server-side search params so client components
  // calling useQueryState('view') get the correct value on first
  // render — prevents hydration mismatch in ProposalFlowShell.
  await loadProposalSearchParams(searchParams)

  return <Proposal />
}
