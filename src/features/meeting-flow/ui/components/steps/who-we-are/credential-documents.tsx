'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import { useState } from 'react'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { DocumentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-card'
import { DocumentDialog } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-dialog'

interface CredentialDocumentsProps {
  /** The contractor license, then the certificate of insurance. */
  documents: PresentationDocument[]
}

/**
 * The license and the certificate of insurance laid like paper on the desk, filling
 * the media row of the licensing beat. Both cards size from the row's height at
 * their true proportions; the license overlaps the certificate when the row is narrow.
 */
export function CredentialDocuments({ documents }: CredentialDocumentsProps) {
  const [openDocument, setOpenDocument] = useState<PresentationDocument | null>(null)

  return (
    <>
      {documents.map((document, position) => (
        <Reveal
          key={document.title}
          className={position === 0
            ? 'absolute top-[12%] left-0 z-10 h-[62%] max-w-[72%]'
            : 'absolute top-0 right-0 h-full max-w-[56%]'}
          order={position + 1}
        >
          <DocumentCard
            className={position === 0 ? '-rotate-2' : 'rotate-2'}
            document={document}
            onOpen={() => setOpenDocument(document)}
          />
        </Reveal>
      ))}

      <DocumentDialog document={openDocument} onClose={() => setOpenDocument(null)} />
    </>
  )
}
