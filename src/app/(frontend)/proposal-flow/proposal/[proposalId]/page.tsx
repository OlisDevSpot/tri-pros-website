import type { Metadata } from 'next'
import { Proposal } from '@/features/proposal-flow/ui/components/proposal'

// Homeowner proposal view renders property photos + pricing behind an
// unguessable share URL. Keep it out of search indexes (the capability-URL
// model's main leak vector). Referrer-Policy is left to the browser default
// (strict-origin-when-cross-origin), so no next.config change is needed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ProposalPage() {
  return <Proposal />
}
