'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ChapterHeader } from '@/features/proposal-flow/ui/components/proposal/chapter-header'
import { ChapterInner } from '@/features/proposal-flow/ui/components/proposal/chapter-inner'
import { ProposalMediaGallery } from '@/features/proposal-flow/ui/components/proposal/proposal-media-gallery'
import { ScopeSpecCard } from '@/features/proposal-flow/ui/components/proposal/scope-spec-card'

export function ScopeOfWork() {
  const { proposal } = useProposalDocument()
  const { sow } = proposal.projectJSON.data
  const showPrice = proposal.priceDisplayMode === 'breakdown'

  return (
    <div className="bg-background">
      <ChapterInner>
        <ChapterHeader chapter="scope" title="Exactly what we’ll do" lede={`${sow.length} ${sow.length === 1 ? 'part' : 'parts'}, written step by step before any work starts.`} />
        {sow.length === 0
          ? <p className="text-muted-foreground">Scope being finalized.</p>
          : sow.map((section, i) => (
              // SOW parts have no id; the list is read-only and never reordered.
              // eslint-disable-next-line react/no-array-index-key
              <ScopeSpecCard key={i} section={section} index={i} showPrice={showPrice} />
            ))}
        <ProposalMediaGallery media={proposal.media ?? []} />
      </ChapterInner>
    </div>
  )
}
