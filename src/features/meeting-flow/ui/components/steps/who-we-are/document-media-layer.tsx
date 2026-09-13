'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import { useState } from 'react'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { DocumentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-card'
import { DocumentDialog } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-dialog'
import { PlaceholderSlot } from '@/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot'

interface DocumentMediaLayerProps {
  documents: PresentationDocument[]
}

/**
 * Right-hand media for the licensing point: the contractor license and
 * certificate of insurance laid like paper on the desk. Owns the dialog state
 * so `PointMediaLayer` stays stateless; falls back to the honest placeholder
 * when the documents array is empty (R2 public domain unset).
 *
 * On lg+ the zone sits between the point's serif numeral (above) and its
 * title/line/proof block (below). That block is sized in `cqw`, so on short, wide
 * stages (1280×720, 1366×768) it rises past `38cqh`; the bottom therefore floors at
 * the block's own offset plus 22cqw. The top stays at 24cqh: any higher and the
 * licence card's corner reaches the numeral.
 */
export function DocumentMediaLayer({ documents }: DocumentMediaLayerProps) {
  const [openDocument, setOpenDocument] = useState<PresentationDocument | null>(null)

  return (
    <div className="absolute inset-x-[6cqw] top-[24cqh] bottom-[30cqh] lg:top-[24cqh] lg:right-[6cqw] lg:bottom-[max(38cqh,calc(max(6cqh,var(--stage-inset-b))+22cqw))] lg:left-auto lg:w-[50cqw]">
      {documents.length === 0
        ? <PlaceholderSlot className="inset-0" label="License and certificate of insurance" />
        : documents.map((document, position) => (
            <Reveal
              key={document.title}
              className={position === 0
                ? 'absolute top-[4%] left-0 z-10 aspect-[3/2] w-[62%]'
                : 'absolute top-[4%] right-0 h-[92%] w-[44%]'}
              order={position + 1}
            >
              <DocumentCard
                className={position === 0 ? '-rotate-3' : 'rotate-2'}
                document={document}
                onOpen={() => setOpenDocument(document)}
              />
            </Reveal>
          ))}

      <DocumentDialog document={openDocument} onClose={() => setOpenDocument(null)} />
    </div>
  )
}
