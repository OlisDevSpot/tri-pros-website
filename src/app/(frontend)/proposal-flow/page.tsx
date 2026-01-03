import Link from 'next/link'
import { ROOTS } from '@/shared/config/roots'

export default function ProposalFlowPage() {
  return (
    <div className="w-full h-full flex flex-col gap-4 items-center justify-center">
      <h1>Proposal Flow</h1>
      <Link href={`${ROOTS.proposalFlow()}/form`}>Form</Link>
      <Link href={`${ROOTS.proposalFlow()}/proposal`}>Proposal</Link>
    </div>
  )
}
