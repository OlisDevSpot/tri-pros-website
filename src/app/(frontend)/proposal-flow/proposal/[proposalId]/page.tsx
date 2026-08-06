import type { Metadata } from 'next'
import type { SearchParams } from 'nuqs/server'
import { loadProposalSearchParams } from '@/features/proposal-flow/lib/search-params'
import { Proposal } from '@/features/proposal-flow/ui/components/proposal'

// Homeowner proposal view renders property photos + pricing behind an
// unguessable share URL. Keep it out of search indexes (the capability-URL
// model's main leak vector). Referrer-Policy is left to the browser default
// (strict-origin-when-cross-origin), so no next.config change is needed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

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
