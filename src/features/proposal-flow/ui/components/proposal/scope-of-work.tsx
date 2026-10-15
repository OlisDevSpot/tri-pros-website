'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ProposalMediaGallery } from '@/features/proposal-flow/ui/components/proposal/proposal-media-gallery'
import { ScopeSpecCard } from '@/features/proposal-flow/ui/components/proposal/scope-spec-card'

export function ScopeOfWork() {
  const { proposal } = useProposalDocument()
  const { sow } = proposal.projectJSON.data
  const showPrice = proposal.priceDisplayMode === 'breakdown'

  return (
    <div className="surface px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scope of work</p>
          <h2 id="scope-of-work-title" className="text-3xl font-semibold text-balance">Exactly what we’ll do</h2>
          <p className="text-muted-foreground">{`${sow.length} ${sow.length === 1 ? 'part' : 'parts'}, written step by step before any work starts.`}</p>
        </header>
        {sow.length === 0
          ? <p className="text-muted-foreground">Scope being finalized.</p>
          : sow.map((section, i) => <ScopeSpecCard key={`${i}-${section.title}`} section={section} index={i} showPrice={showPrice} />)}
        <ProposalMediaGallery media={proposal.media ?? []} />
      </div>
    </div>
  )
}
