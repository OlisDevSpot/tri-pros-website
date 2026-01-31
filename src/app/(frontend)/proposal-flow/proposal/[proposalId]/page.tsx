import { Proposal, RelatedProjects } from '@/features/proposal-flow/ui/components/proposal'

export default async function ProposalPage() {
  return (
    <div className="h-full overflow-auto">
      <Proposal />
      {/* <RelatedProjects /> */}
    </div>
  )
}
