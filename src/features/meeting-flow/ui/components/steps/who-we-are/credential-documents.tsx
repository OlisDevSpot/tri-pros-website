'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import { DocumentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-card'
import { TapCue } from '@/features/meeting-flow/ui/components/steps/who-we-are/tap-cue'
import { Reveal } from '@/shared/components/presentation/reveal'

interface CredentialDocumentsProps {
  /** The contractor license, then the certificate of insurance. */
  documents: PresentationDocument[]
  /** The visible cue under the license, e.g. "Tap to view". */
  openLabel: string
  onOpen: (document: PresentationDocument) => void
}

/**
 * The license and the certificate of insurance laid like paper on the desk, filling the media
 * row. Both size from the row's height at their true proportions, and the license lies over the
 * certificate when the row is narrow. The one tap cue hangs under the license like a caption,
 * inside its tap target: every edge of a license carries print. Square to the slide, because
 * tilted type blurs on low-DPI screens.
 */
export function CredentialDocuments({ documents, openLabel, onOpen }: CredentialDocumentsProps) {
  return documents.map((document, position) => (
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
        onOpen={() => onOpen(document)}
      />
    </Reveal>
  ))
}
