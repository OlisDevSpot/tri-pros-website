'use client'

import type { CSSProperties } from 'react'

import { useState } from 'react'
import { SCOPE_EYEBROW_H_PX } from '@/features/proposal-flow/constants/scope-sticky'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useIsStuck } from '@/features/proposal-flow/hooks/use-is-stuck'
import { ChapterEyebrow } from '@/features/proposal-flow/ui/components/proposal/chapter-eyebrow'
import { ChapterHeader } from '@/features/proposal-flow/ui/components/proposal/chapter-header'
import { ChapterInner } from '@/features/proposal-flow/ui/components/proposal/chapter-inner'
import { ProposalMediaGallery } from '@/features/proposal-flow/ui/components/proposal/proposal-media-gallery'
import { ScopeSpecCard } from '@/features/proposal-flow/ui/components/proposal/scope-spec-card'
import { cn } from '@/shared/lib/utils'

export function ScopeOfWork() {
  const { proposal } = useProposalDocument()
  const { sow } = proposal.projectJSON.data
  const showPrice = proposal.priceDisplayMode === 'breakdown'
  const [eyebrowRow, setEyebrowRow] = useState<HTMLDivElement | null>(null)
  const stuck = useIsStuck(eyebrowRow, 0)

  return (
    <div className="bg-background" style={{ '--scope-eyebrow-h': `${SCOPE_EYEBROW_H_PX}px` } as CSSProperties}>
      {/* The eyebrow row's own height replaces ChapterInner's top padding, so this spacer is that padding minus the row's centring offset. */}
      <div className="h-11.5 @min-[700px]/proposal:h-17.5" />
      <div ref={setEyebrowRow} className={cn('sticky top-0 z-3 h-(--scope-eyebrow-h) border-b bg-background', stuck ? 'border-border' : 'border-transparent')}>
        <div className="mx-auto flex h-full max-w-230 items-center px-4.5 @min-[700px]/proposal:px-10">
          <ChapterEyebrow chapter="scope" />
        </div>
      </div>
      <ChapterInner className="pt-0 @min-[700px]/proposal:pt-0">
        <ChapterHeader chapter="scope" eyebrow={false} title="Exactly what we’ll do" lede={`${sow.length} ${sow.length === 1 ? 'part' : 'parts'}, written step by step before any work starts.`} />
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
