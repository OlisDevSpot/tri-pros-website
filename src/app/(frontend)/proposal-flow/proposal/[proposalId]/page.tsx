import { Proposal } from '@/features/proposals/ui/components/proposal'

export default async function ProposalPage() {
  return (
    <div className="container h-full px-8 overflow-auto">
      <Proposal />
    </div>
  )
}
