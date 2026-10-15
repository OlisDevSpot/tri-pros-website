'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ContractStatusPanel } from '@/shared/components/contract-status-panel/ui/contract-status-panel'

export function NextSteps() {
  const { proposal } = useProposalDocument()
  return (
    <div className="bg-(--presentation-ground) px-4 py-12 text-on-media sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-(--presentation-accent)">Next steps</p>
          <h2 id="agreement-title" className="text-3xl font-semibold text-balance">Next steps</h2>
          <p className="text-on-media-muted">Here’s how we get your project started.</p>
        </header>
        <div className="rounded-lg bg-card p-5 text-card-foreground">
          <ContractStatusPanel
            proposalId={proposal.id}
            token={proposal.token ?? undefined}
            customerAge={proposal.customer?.customerAge ?? null}
          />
        </div>
      </div>
    </div>
  )
}
