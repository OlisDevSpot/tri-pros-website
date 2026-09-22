'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import { useState } from 'react'
import { DocumentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-card'
import { DocumentDialog } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-dialog'
import { TapCue } from '@/features/meeting-flow/ui/components/steps/who-we-are/tap-cue'
import { Reveal } from '@/shared/components/presentation/reveal'

interface CredentialDocumentsProps {
  /** The contractor license, then the certificate of insurance. */
  documents: PresentationDocument[]
  /** The visible cue under the license, e.g. "Tap to view". */
  openLabel: string
}

/**
 * The license and the certificate of insurance laid like paper on the desk, filling the
 * media row of the licensing slide. Both cards size from the row's height at their true
 * proportions; the license lies over the certificate when the row is narrow. The one tap cue
 * for both hangs under the license like a caption, inside the license's tap target: every edge
 * of a license carries print, so the cue never covers it (U11). Square to the slide: tilted type
 * blurs on low-DPI screens (U13).
 */
export function CredentialDocuments({ documents, openLabel }: CredentialDocumentsProps) {
  const [openDocument, setOpenDocument] = useState<PresentationDocument | null>(null)

  return (
    <>
      {documents.map((document, position) => (
        <Reveal
          key={document.title}
          className={position === 0
            ? 'absolute top-[12%] left-0 z-10 h-[62%] max-w-[72%]'
            : 'absolute top-0 right-0 h-full max-w-[56%]'}
          order={position}
        >
          <DocumentCard
            cue={position === 0 ? <TapCue label={openLabel} /> : undefined}
            document={document}
            onOpen={() => setOpenDocument(document)}
          />
        </Reveal>
      ))}

      <DocumentDialog document={openDocument} onClose={() => setOpenDocument(null)} />
    </>
  )
}
